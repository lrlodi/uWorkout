import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generatePlan } from "./engine.js";
import { aiPlan } from "./ai.js";

const prisma = new PrismaClient();
const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGINS || "http://localhost:5173").split(",") }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

const sign = (u) => jwt.sign({ sub: u.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
const auth = (req, res, next) => {
  try {
    req.uid = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET).sub;
    next();
  } catch { res.status(401).json({ error: "Não autenticado" }); }
};

// ---------- Auth ----------
const Cred = z.object({ email: z.string().email(), password: z.string().min(8) });

app.post("/auth/register", async (req, res) => {
  const { email, password } = Cred.parse(req.body);
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "E-mail já cadastrado" });
  const u = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 10) } });
  res.json({ token: sign(u) });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = Cred.parse(req.body);
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return res.status(401).json({ error: "Credenciais inválidas" });
  res.json({ token: sign(u) });
});

// Exigido pelo Google Play: exclusão de conta dentro do app
app.delete("/me", auth, async (req, res) => {
  await prisma.user.delete({ where: { id: req.uid } });
  res.sendStatus(204);
});

// ---------- Planos ----------
const PlanIn = z.object({
  name: z.string().min(1).max(100), goal: z.string().default(""),
  modality: z.string(), level: z.string(), time: z.number().int().min(10).max(240),
  created: z.string().default("manual"), days: z.array(z.any()).max(14),
});
const out = ({ userId, createdAt, updatedAt, ...p }) => p;

app.get("/plans", auth, async (req, res) => {
  const ps = await prisma.plan.findMany({ where: { userId: req.uid }, orderBy: { createdAt: "desc" } });
  res.json(ps.map(out));
});

app.post("/plans", auth, async (req, res) => {
  const data = PlanIn.parse(req.body);
  res.json(out(await prisma.plan.create({ data: { ...data, userId: req.uid } })));
});

app.put("/plans/:id", auth, async (req, res) => {
  const r = await prisma.plan.updateMany({ where: { id: req.params.id, userId: req.uid }, data: PlanIn.parse(req.body) });
  res.sendStatus(r.count ? 204 : 404);
});

app.delete("/plans/:id", auth, async (req, res) => {
  await prisma.plan.deleteMany({ where: { id: req.params.id, userId: req.uid } });
  res.sendStatus(204);
});

// ---------- Geração com IA (com cota diária) ----------
const Q = z.object({
  name: z.string().max(100).default(""),
  modality: z.enum(["musculacao", "corrida", "ambos"]),
  objS: z.enum(["hipertrofia", "forca", "emagrecimento", "condicionamento"]),
  objR: z.enum(["saude", "5k", "10k", "meia"]),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  runBase: z.number().min(0).max(120),
  days: z.number().int().min(1).max(6),
  time: z.number().int().min(30).max(120),
  split: z.string(), emphasis: z.array(z.string()).max(10),
});

app.post("/plans/generate", auth, async (req, res) => {
  const q = Q.parse(req.body);
  const today = new Date().toISOString().slice(0, 10);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.uid } });
  const used = u.aiDate === today ? u.aiUsed : 0;
  if (used >= (+process.env.FREE_DAILY || 2)) return res.status(429).json({ error: "Limite diário de gerações atingido" });

  let plan;
  try { plan = await aiPlan(q); } catch (e) { console.error("IA falhou:", e.message); plan = generatePlan(q); }
  plan.created = "IA";
  const { id, ...data } = plan;

  await prisma.user.update({ where: { id: req.uid }, data: { aiUsed: used + 1, aiDate: today } });
  res.json(out(await prisma.plan.create({ data: { ...data, userId: req.uid } })));
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.use((err, req, res, next) => res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message }));

app.listen(process.env.PORT || 3000, () => console.log("API on :" + (process.env.PORT || 3000)));
