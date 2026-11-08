import { randomUUID } from "node:crypto";

export const GROUPS = ["Peito", "Costas", "Pernas", "Ombros", "Bíceps", "Tríceps", "Abdômen", "Glúteos"];
export const RUN_KINDS = ["Leve", "Intervalado", "Tempo", "Longo", "Regenerativo"];
export const uid = () => randomUUID();

const LIB = {
  Peito: ["Supino reto", "Supino inclinado com halteres", "Crucifixo", "Crossover", "Flexão de braço"],
  Costas: ["Puxada frontal", "Remada curvada", "Remada baixa", "Pulldown", "Remada unilateral"],
  Pernas: ["Agachamento", "Leg press", "Cadeira extensora", "Mesa flexora", "Panturrilha em pé"],
  Ombros: ["Desenvolvimento com halteres", "Elevação lateral", "Elevação frontal", "Crucifixo inverso"],
  Bíceps: ["Rosca direta", "Rosca alternada", "Rosca martelo", "Rosca scott"],
  Tríceps: ["Tríceps corda", "Tríceps testa", "Tríceps francês", "Mergulho no banco"],
  Abdômen: ["Prancha", "Abdominal supra", "Abdominal infra", "Elevação de pernas"],
  Glúteos: ["Elevação pélvica", "Afundo", "Stiff", "Cadeira abdutora"],
};

const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const T = {
  full: [
    ["Corpo todo A", ["Peito", "Costas", "Pernas", "Ombros", "Abdômen"]],
    ["Corpo todo B", ["Costas", "Peito", "Pernas", "Bíceps", "Tríceps"]],
  ],
  abc: [
    ["Treino A — Peito + Tríceps", ["Peito", "Tríceps", "Ombros"]],
    ["Treino B — Costas + Bíceps", ["Costas", "Bíceps", "Abdômen"]],
    ["Treino C — Pernas + Glúteos", ["Pernas", "Glúteos", "Abdômen"]],
  ],
  ul: [
    ["Superiores", ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"]],
    ["Inferiores", ["Pernas", "Glúteos", "Abdômen"]],
  ],
  ppl: [
    ["Push — Peito + Ombros + Tríceps", ["Peito", "Ombros", "Tríceps"]],
    ["Pull — Costas + Bíceps", ["Costas", "Bíceps", "Abdômen"]],
    ["Legs — Pernas + Glúteos", ["Pernas", "Glúteos", "Abdômen"]],
  ],
};

function pickTemplate(split, n) {
  const s = norm(split);
  if (/ppl|push/.test(s)) return T.ppl;
  if (/^ul$|upper|superior|inferior/.test(s)) return T.ul;
  if (/full|corpo/.test(s)) return T.full;
  if (/abc|abcd/.test(s)) return T.abc;
  if (n <= 2) return T.full;
  if (n === 3) return T.abc;
  if (n === 4) return T.ul;
  return T.ppl;
}

function scheme(objS, level) {
  const o = norm(objS);
  let r = { reps: "8-12", rest: 75 };
  if (o === "forca") r = { reps: "4-6", rest: 150 };
  else if (o === "emagrecimento") r = { reps: "12-15", rest: 45 };
  else if (o === "condicionamento") r = { reps: "15-20", rest: 30 };
  r.sets = level === "iniciante" ? 3 : 4;
  return r;
}

function strengthDay(name, groups, cycle, q) {
  const { reps, rest, sets } = scheme(q.objS, q.level);
  const emph = new Set((q.emphasis || []).map(norm));
  const target = Math.min(10, Math.max(4, Math.round(q.time / 10)));
  const base = Math.max(1, Math.round(target / groups.length));
  const exercises = groups.flatMap((g) => {
    const k = Math.min(LIB[g].length, base + (emph.has(norm(g)) ? 1 : 0));
    return Array.from({ length: k }, (_, i) => ({
      id: uid(),
      group: g,
      name: LIB[g][(i + cycle) % LIB[g].length],
      sets,
      reps,
      rest,
    }));
  });
  return { id: uid(), type: "strength", name, done: false, exercises };
}

function runDay(i, q) {
  const kinds = q.level === "iniciante" ? ["Leve", "Intervalado", "Longo"] : ["Leve", "Intervalado", "Tempo", "Longo"];
  const kind = kinds[i % kinds.length];
  const base = Math.max(20, q.runBase || 0);
  const cap = Math.max(20, q.time);
  const dur = {
    Leve: Math.min(cap, base),
    Intervalado: Math.min(cap, 30),
    Tempo: Math.min(cap, 35),
    Longo: Math.min(Math.round(base * 1.3), 120),
    Regenerativo: Math.min(cap, 20),
  }[kind];
  const main = dur - 10;
  const details = {
    Leve: `5' aquecimento • ${main}' corrida leve em ritmo confortável • 5' desaceleração`,
    Intervalado: `5' aquecimento • ${Math.max(2, Math.floor(main / 3))}x (2' forte + 1' leve) • 5' desaceleração`,
    Tempo: `5' aquecimento • ${main}' em ritmo moderado-forte constante • 5' desaceleração`,
    Longo: `5' aquecimento • ${main}' em ritmo leve e constante • 5' desaceleração`,
    Regenerativo: `${dur}' trote bem leve ou caminhada`,
  }[kind];
  return { id: uid(), type: "run", name: `Corrida ${kind}`, done: false, run: { kind, duration: dur, details } };
}

export function generatePlan(q) {
  const n = q.days || 3;
  const mod = q.modality || "musculacao";
  const runs = mod === "corrida" ? n : mod === "ambos" && n >= 2 ? Math.max(1, Math.round(n / 3)) : 0;
  const strength = n - runs;

  const tpl = pickTemplate(q.split, strength);
  const sDays = Array.from({ length: strength }, (_, i) => {
    const [name, groups] = tpl[i % tpl.length];
    const label = strength > tpl.length ? `${name} (${Math.floor(i / tpl.length) + 1})` : name;
    return strengthDay(label, groups, Math.floor(i / tpl.length), q);
  });
  const rDays = Array.from({ length: runs }, (_, i) => runDay(i, q));

  // intercala musculação e corrida
  const days = [];
  while (sDays.length || rDays.length) {
    if (sDays.length) days.push(sDays.shift());
    if (rDays.length && (days.length % 2 === 0 || !sDays.length)) days.push(rDays.shift());
  }

  const goalS = { hipertrofia: "Hipertrofia", forca: "Força", emagrecimento: "Emagrecimento", condicionamento: "Condicionamento" }[q.objS] || "";
  const goalR = { saude: "Saúde", "5k": "5 km", "10k": "10 km", meia: "Meia maratona" }[q.objR] || "";
  const goal = mod === "corrida" ? goalR : mod === "ambos" ? `${goalS} + ${goalR}` : goalS;

  return {
    id: uid(),
    name: q.name?.trim() || `Plano ${goal} — ${n}x/semana`,
    goal,
    modality: mod,
    level: q.level,
    time: q.time,
    created: "manual",
    days,
  };
}
