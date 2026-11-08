import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { GROUPS, RUN_KINDS, uid, generatePlan } from "./engine.js";

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ timeout: 90_000, maxRetries: 1 }) : null;
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";

const Days = z.array(
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("strength"),
      name: z.string().min(1),
      exercises: z.array(z.object({
        group: z.enum(GROUPS), name: z.string().min(1),
        sets: z.coerce.number().int().min(1).max(10), reps: z.coerce.string(), rest: z.coerce.number().int().min(0).max(600),
      })).min(1),
    }),
    z.object({
      type: z.literal("run"),
      name: z.string().min(1),
      run: z.object({ kind: z.enum(RUN_KINDS), duration: z.coerce.number().int().min(5).max(300), details: z.string() }),
    }),
  ])
).min(1).max(7);

const SYSTEM = `Você é um personal trainer. Receba o questionário em JSON e responda SOMENTE com um array JSON de dias de treino, sem texto extra.
Formato: [{"type":"strength","name":"Treino A — Peito + Tríceps","exercises":[{"group":"Peito","name":"Supino reto","sets":4,"reps":"8-12","rest":75}]},{"type":"run","name":"Corrida Leve","run":{"kind":"Leve","duration":30,"details":"5' aquecimento • ..."}}]
Regras:
- Gere exatamente "days" dias.
- "modality": "musculacao" = só dias "strength"; "corrida" = só dias "run"; "ambos" = mistura dos dois.
- "group" deve ser um de: ${GROUPS.join(", ")}.
- "kind" deve ser um de: ${RUN_KINDS.join(", ")}.
- Respeite "time" (minutos por sessão), "level", os objetivos ("objS" para musculação, "objR" para corrida), "runBase" (minutos que a pessoa já corre), "split", "emphasis" (grupos a priorizar) e "notes" (limitações/observações).
- "rest" é o descanso em segundos; "duration" é em minutos.`;

export async function aiPlan(q) {
  if (!client) throw new Error("IA não configurada (ANTHROPIC_API_KEY ausente)");
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(q) }],
  });
  if (msg.stop_reason === "refusal") throw new Error("Pedido recusado pelo modelo");
  if (msg.stop_reason === "max_tokens") throw new Error("Resposta da IA truncada");

  // Modelos atuais podem devolver blocos de "thinking" antes do texto
  const t = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Resposta da IA sem JSON");
  const days = Days.parse(JSON.parse(t.slice(start, end + 1)));

  const plan = generatePlan(q); // reaproveita nome, objetivo e metadados
  plan.days = days.map((d) => ({
    id: uid(), type: d.type, name: d.name, done: false,
    ...(d.type === "run"
      ? { run: d.run }
      : { exercises: d.exercises.map((e) => ({ id: uid(), ...e })) }),
  }));
  return plan;
}
