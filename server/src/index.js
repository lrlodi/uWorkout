import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generatePlan, GROUPS, RUN_KINDS, uid } from "./engine.js";
import { aiPlan } from "./ai.js";

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  console.error("JWT_SECRET não definido. Configure a variável de ambiente antes de iniciar a API.");
  process.exit(1);
}

const prisma = new PrismaClient();
const app = express();

// Render (e a maioria dos PaaS) fica atrás de um proxy: sem isso o rate limit
// enxerga todo mundo com o mesmo IP e o express-rate-limit emite erro de validação.
app.set("trust proxy", 1);

// CORS_ORIGINS: lista separada por vírgula. Aceita curingas, ex.: https://*.vercel.app
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const originOk = (o) =>
  origins.some((p) =>
    p.includes("*")
      ? new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+") + "$").test(o)
      : p === o
  );
app.use(cors({ origin: (o, cb) => cb(null, !o || originOk(o)) }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, message: { error: "Muitas tentativas. Tente novamente em alguns minutos." } });

const sign = (u) => jwt.sign({ sub: u.id }, JWT_SECRET, { expiresIn: "30d" });
const auth = (req, res, next) => {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado" });
  try {
    req.uid = jwt.verify(h.slice(7), JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: "Sessão expirada. Entre novamente." });
  }
};

// ---------- Auth ----------
const Cred = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(200),
});
const userOut = (u) => ({ id: u.id, email: u.email });

app.post("/auth/register", authLimiter, async (req, res) => {
  const { email, password } = Cred.parse(req.body);
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "E-mail já cadastrado" });
  const u = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 10) } });
  res.status(201).json({ token: sign(u), user: userOut(u) });
});

app.post("/auth/login", authLimiter, async (req, res) => {
  const { email, password } = Cred.parse(req.body);
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return res.status(401).json({ error: "Credenciais inválidas" });
  res.json({ token: sign(u), user: userOut(u) });
});

const dailyLimit = () => Number(process.env.FREE_DAILY) || 2;
const today = () => new Date().toISOString().slice(0, 10);

app.get("/me", auth, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.uid } });
  if (!u) return res.status(401).json({ error: "Conta não encontrada" });
  const used = u.aiDate === today() ? u.aiUsed : 0;
  res.json({ ...userOut(u), aiUsed: used, aiLimit: dailyLimit() });
});

// Exigido pelo Google Play: exclusão de conta dentro do app
app.delete("/me", auth, async (req, res) => {
  await prisma.user.deleteMany({ where: { id: req.uid } });
  res.sendStatus(204);
});

// ---------- Planos ----------
const Exercise = z.object({
  id: z.string().optional(),
  group: z.enum(GROUPS),
  name: z.string().trim().min(1).max(100),
  sets: z.coerce.number().int().min(1).max(20),
  reps: z.coerce.string().max(20),
  rest: z.coerce.number().int().min(0).max(900),
});
const Day = z.discriminatedUnion("type", [
  z.object({
    id: z.string().optional(), type: z.literal("strength"), name: z.string().trim().min(1).max(100),
    done: z.boolean().default(false), exercises: z.array(Exercise).max(30),
  }),
  z.object({
    id: z.string().optional(), type: z.literal("run"), name: z.string().trim().min(1).max(100),
    done: z.boolean().default(false),
    run: z.object({ kind: z.enum(RUN_KINDS), duration: z.coerce.number().int().min(5).max(300), details: z.string().max(500).default("") }),
  }),
]);
const PlanIn = z.object({
  name: z.string().trim().min(1).max(100),
  goal: z.string().max(100).default(""),
  modality: z.enum(["musculacao", "corrida", "ambos"]),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  time: z.coerce.number().int().min(10).max(240),
  created: z.string().max(20).default("manual"),
  days: z.array(Day).min(1).max(14),
});
const withIds = (days) =>
  days.map((d) => ({
    ...d,
    id: d.id || uid(),
    ...(d.type === "strength" && { exercises: d.exercises.map((e) => ({ ...e, id: e.id || uid() })) }),
  }));
const out = ({ userId, updatedAt, ...p }) => p;

app.get("/plans", auth, async (req, res) => {
  const ps = await prisma.plan.findMany({ where: { userId: req.uid }, orderBy: { createdAt: "desc" } });
  res.json(ps.map(out));
});

app.post("/plans", auth, async (req, res) => {
  const data = PlanIn.parse(req.body);
  data.days = withIds(data.days);
  res.status(201).json(out(await prisma.plan.create({ data: { ...data, userId: req.uid } })));
});

app.put("/plans/:id", auth, async (req, res) => {
  const data = PlanIn.parse(req.body);
  data.days = withIds(data.days);
  const r = await prisma.plan.updateMany({ where: { id: req.params.id, userId: req.uid }, data });
  if (!r.count) return res.status(404).json({ error: "Plano não encontrado" });
  res.json(out(await prisma.plan.findUnique({ where: { id: req.params.id } })));
});

app.delete("/plans/:id", auth, async (req, res) => {
  const r = await prisma.plan.deleteMany({ where: { id: req.params.id, userId: req.uid } });
  res.sendStatus(r.count ? 204 : 404);
});

// ---------- Geração com IA (com cota diária) ----------
const Q = z.object({
  name: z.string().max(100).default(""),
  modality: z.enum(["musculacao", "corrida", "ambos"]).default("musculacao"),
  objS: z.enum(["hipertrofia", "forca", "emagrecimento", "condicionamento"]).default("hipertrofia"),
  objR: z.enum(["saude", "5k", "10k", "meia"]).default("saude"),
  level: z.enum(["iniciante", "intermediario", "avancado"]).default("iniciante"),
  runBase: z.coerce.number().min(0).max(120).default(0),
  days: z.coerce.number().int().min(1).max(6).default(3),
  time: z.coerce.number().int().min(30).max(120).default(60),
  split: z.string().max(50).default(""),
  emphasis: z.array(z.enum(GROUPS)).max(GROUPS.length).default([]),
  notes: z.string().max(300).default(""),
});

app.post("/plans/generate", auth, async (req, res) => {
  const q = Q.parse(req.body);
  const day = today();
  const u = await prisma.user.findUnique({ where: { id: req.uid } });
  if (!u) return res.status(401).json({ error: "Conta não encontrada" });
  const used = u.aiDate === day ? u.aiUsed : 0;
  if (used >= dailyLimit()) return res.status(429).json({ error: "Limite diário de gerações com IA atingido. Tente amanhã." });

  let plan;
  let source = "IA";
  try {
    plan = await aiPlan(q);
  } catch (e) {
    console.error("IA falhou, usando gerador local:", e.message);
    plan = generatePlan(q);
    source = "auto";
  }
  plan.created = source;
  const { id, ...data } = plan;

  // só consome a cota quando a IA realmente gerou o plano
  if (source === "IA") await prisma.user.update({ where: { id: req.uid }, data: { aiUsed: used + 1, aiDate: day } });
  res.status(201).json(out(await prisma.plan.create({ data: { ...data, userId: req.uid } })));
});

app.get("/health", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true, ai: !!process.env.ANTHROPIC_API_KEY });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.use((req, res) => res.status(404).json({ error: "Rota não encontrada" }));
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) {
    const i = err.issues[0];
    return res.status(400).json({ error: (i.path.length ? i.path.join(".") + ": " : "") + i.message, issues: err.issues });
  }
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido" });
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API on :" + port));
