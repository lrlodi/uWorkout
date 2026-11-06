import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { GROUPS, RUN_KINDS, uid, generatePlan } from "./engine.js";

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const Days = z.array(z.object({
  type: z.enum(["strength", "run"]),
  name: z.string(),
  exercises: z.array(z.object({
    group: z.enum(GROUPS), name: z.string(),
    sets: z.number(), reps: z.string(), rest: z.number(),
  })).optional(),
  run: z.object({ kind: z.enum(RUN_KINDS), duration: z.number(), details: z.string() }).optional(),
})).min(1).max(7);

const SYSTEM = `Você é um personal trainer. Receba o questionário em JSON e responda SOMENTE com um array JSON de dias de treino, sem texto extra.
Formato: [{"type":"strength","name":"Treino A — Peito + Tríceps","exercises":[{"group":"Peito","name":"Supino reto","sets":4,"reps":"8-12","rest":75}]},{"type":"run","name":"Corrida Leve","run":{"kind":"Leve","duration":30,"details":"5' aquecimento • ..."}}]
Regras: exatamente "days" dias; "group" deve ser um de: ${GROUPS.join(", ")}; "kind" deve ser um de: ${RUN_KINDS.join(", ")}; respeite "time" (minutos por sessão), "level", objetivos, "split" e "emphasis"; descanso em segundos.`;

export async function aiPlan(q) {
  if (!client) throw new Error("IA não configurada");
  const msg = await client.messages.create({
    model: process.env.AI_MODEL, max_tokens: 4000, system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(q) }],
  });
  const t = msg.content[0].text;
  const days = Days.parse(JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)));
  const plan = generatePlan(q); // reaproveita nome, objetivo e metadados
  plan.days = days.map((d) => ({
    id: uid(), type: d.type, name: d.name, done: false,
    ...(d.type === "run"
      ? { run: d.run }
      : { exercises: (d.exercises || []).map((e) => ({ id: uid(), ...e })) }),
  }));
  return plan;
}
