// Animações de exercícios em SVG (boneco de palitos animado com SMIL).
// Cada padrão de movimento tem duas poses (A = início, B = fim); a animação vai A → B → A.
// Sem dependências: gera a marcação SVG como string a partir de dados estáticos (nenhum texto do usuário entra no SVG).
//
// Juntas: h cabeça, s ombro, e cotovelo, w mão, p quadril, k joelho, a tornozelo, t ponta do pé.
// e2/w2/k2/a2/t2 = membro do outro lado (desenhado mais claro).
// Coordenadas no viewBox "0 -8 100 104" (chão em y = 93).

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const STAND = { h: [50, 15], s: [50, 26], e: [54, 41], w: [57, 56], p: [50, 54], k: [51, 73], a: [50, 91] };
const FRONT = { h: [50, 15], s: [50, 26], p: [50, 54], k: [45, 73], a: [43, 91], k2: [55, 73], a2: [57, 91] };
const LYING = { h: [15, 69], s: [26, 72], p: [54, 72], k: [71, 70], a: [74, 91] };
const BENCH = [[10, 77, 60, 77], [16, 77, 16, 93], [54, 77, 54, 93]];

const PATTERNS = {
  squat: {
    A: { h: [50, 15], s: [50, 26], e: [40, 32], w: [47, 25], p: [50, 54], k: [52, 73], a: [50, 91] },
    B: { h: [56, 35], s: [52, 44], e: [42, 50], w: [49, 43], p: [40, 69], k: [60, 72] },
    props: [{ c: "w", r: 5 }],
  },
  lunge: {
    A: { ...STAND, e: [50, 42], w: [50, 57], k: [53, 73], a: [55, 91], k2: [47, 73], a2: [45, 91] },
    B: { h: [48, 27], s: [48, 38], e: [48, 54], w: [48, 68], p: [48, 66], k: [66, 72], a: [66, 91], k2: [44, 84], a2: [28, 86], t2: [34, 92] },
    props: [{ c: "w", r: 3, fill: true }],
  },
  hinge: {
    A: STAND,
    B: { h: [76, 43], s: [67, 47], e: [67, 62], w: [67, 76], p: [41, 56], k: [47, 74] },
    props: [{ c: "w", r: 5 }],
  },
  legPress: {
    A: { h: [14, 44], s: [20, 52], e: [30, 62], w: [40, 70], p: [38, 74], k: [46, 55], a: [65, 60], t: [67, 53] },
    B: { k: [56, 66], a: [76, 58], t: [78, 51] },
    props: [{ seg: "a", d: [[4, -12], [4, 8]] }],
    scene: [[44, 82, 12, 44], [30, 82, 52, 82], [40, 82, 40, 93]],
  },
  legExt: {
    A: { h: [35, 24], s: [36, 34], e: [40, 48], w: [46, 60], p: [40, 62], k: [60, 62], a: [61, 82] },
    B: { a: [78, 56], t: [77, 49] },
    scene: [[30, 65, 62, 65], [32, 65, 28, 30], [34, 65, 34, 93]],
  },
  legCurl: {
    A: { h: [14, 58], s: [24, 63], e: [12, 68], w: [6, 68], p: [52, 64], k: [72, 64], a: [92, 64], t: [92, 70] },
    B: { a: [78, 46], t: [84, 44] },
    scene: [[12, 69, 78, 69], [20, 69, 20, 93], [70, 69, 70, 93]],
  },
  calf: {
    A: { ...STAND, a: [50, 90], t: [58, 91] },
    B: { h: [50, 9], s: [50, 20], e: [50, 36], w: [51, 51], p: [50, 48], k: [50, 66], a: [50, 84], t: [57, 91] },
    props: [{ c: "w", r: 3, fill: true }],
    dur: 1.6,
  },
  bench: {
    A: { ...LYING, e: [14, 70], w: [27, 60] },
    B: { e: [26, 56], w: [26, 42] },
    props: [{ c: "w", r: 5 }],
    scene: BENCH,
  },
  incline: {
    A: { h: [23, 51], s: [30, 58], e: [20, 66], w: [32, 58], p: [50, 78], k: [68, 74], a: [70, 91] },
    B: { e: [30, 42], w: [28, 28] },
    props: [{ c: "w", r: 5 }],
    scene: [[56, 82, 22, 48], [52, 82, 52, 93]],
  },
  pushup: {
    A: { a: [14, 88], t: [12, 93], k: [31, 81], p: [48, 73], s: [72, 62], h: [81, 58], e: [72, 77], w: [72, 92] },
    B: { k: [30, 86], p: [47, 83], s: [70, 80], h: [80, 79], e: [61, 86] },
  },
  fly: {
    front: true,
    A: { ...FRONT, e: [35, 30], w: [20, 36], e2: [65, 30], w2: [80, 36] },
    B: { e: [41, 40], w: [49, 52], e2: [59, 40], w2: [51, 52] },
    props: [{ c: "w", r: 3, fill: true }, { c: "w2", r: 3, fill: true }],
  },
  lateral: {
    front: true,
    A: { ...FRONT, e: [45, 41], w: [42, 56], e2: [55, 41], w2: [58, 56] },
    B: { e: [35, 27], w: [20, 27], e2: [65, 27], w2: [80, 27] },
    props: [{ c: "w", r: 3, fill: true }, { c: "w2", r: 3, fill: true }],
  },
  frontRaise: {
    A: STAND,
    B: { e: [65, 24], w: [80, 22] },
    props: [{ c: "w", r: 3, fill: true }],
  },
  press: {
    front: true,
    A: { ...FRONT, e: [36, 32], w: [37, 18], e2: [64, 32], w2: [63, 18] },
    B: { e: [42, 12], w: [44, -2], e2: [58, 12], w2: [56, -2] },
    props: [{ c: "w", r: 3, fill: true }, { c: "w2", r: 3, fill: true }],
  },
  pulldown: {
    front: true,
    A: { ...FRONT, e: [39, 13], w: [31, 0], e2: [61, 13], w2: [69, 0] },
    B: { e: [35, 33], w: [32, 19], e2: [65, 33], w2: [68, 19] },
    props: [{ b: ["w", "w2"] }],
  },
  row: {
    A: { h: [75, 42], s: [66, 46], e: [66, 62], w: [66, 76], p: [42, 56], k: [46, 74], a: [50, 91] },
    B: { e: [52, 44], w: [62, 56] },
    props: [{ c: "w", r: 5 }],
  },
  rowSeated: {
    A: { h: [33, 50], s: [32, 60], e: [46, 64], w: [60, 66], p: [30, 88], k: [50, 84], a: [70, 88], t: [72, 82] },
    B: { e: [18, 66], w: [32, 70] },
    props: [{ cable: "w", to: [94, 82] }],
    scene: [[74, 72, 74, 93]],
  },
  curl: {
    A: STAND,
    B: { w: [65, 29] },
    props: [{ c: "w", r: 3, fill: true }],
  },
  curlAlt: {
    A: { ...STAND, e2: [54, 41], w2: [65, 29] },
    B: { w: [65, 29], w2: [57, 56] },
    props: [{ c: "w", r: 3, fill: true }, { c: "w2", r: 3, fill: true }],
  },
  pushdown: {
    A: { ...STAND, w: [66, 30] },
    B: { w: [57, 56] },
    props: [{ cable: "w", to: [64, -6] }],
  },
  skull: {
    A: { ...LYING, e: [26, 56], w: [26, 42] },
    B: { w: [14, 59] },
    props: [{ c: "w", r: 5 }],
    scene: BENCH,
  },
  overheadExt: {
    A: { ...STAND, e: [52, 10], w: [53, -4] },
    B: { w: [40, 18] },
    props: [{ c: "w", r: 3, fill: true }],
  },
  dip: {
    A: { h: [35, 28], s: [36, 38], e: [32, 52], w: [28, 66], p: [38, 66], k: [56, 74], a: [72, 90] },
    B: { h: [35, 40], s: [36, 50], e: [22, 56], p: [38, 78], k: [57, 77] },
    scene: [[8, 67, 32, 67], [12, 67, 12, 93], [28, 67, 28, 93]],
  },
  plank: {
    A: { a: [14, 86], t: [12, 92], k: [31, 80], p: [48, 75], s: [70, 70], h: [79, 67], e: [70, 88], w: [84, 88] },
    B: { k: [31, 82], p: [48, 78] },
    dur: 3,
  },
  crunch: {
    A: { h: [14, 82], s: [24, 86], e: [24, 76], w: [12, 80], p: [52, 87], k: [64, 70], a: [78, 88] },
    B: { h: [22, 71], s: [31, 76], e: [34, 66], w: [20, 66] },
  },
  legRaise: {
    A: { h: [14, 84], s: [24, 87], e: [36, 89], w: [48, 89], p: [52, 87], k: [72, 87], a: [91, 87], t: [92, 81] },
    B: { k: [54, 67], a: [56, 47], t: [62, 46] },
  },
  hipThrust: {
    A: { h: [15, 63], s: [24, 68], e: [32, 78], w: [42, 84], p: [44, 86], k: [61, 72], a: [64, 91] },
    B: { e: [34, 70], w: [46, 66], p: [48, 68], k: [66, 68], a: [66, 91] },
    props: [{ c: "p", r: 5 }],
    scene: [[8, 70, 28, 70], [12, 70, 12, 93], [24, 70, 24, 93]],
  },
  abduction: {
    front: true,
    A: { ...FRONT, e: [40, 40], w: [46, 52], e2: [60, 40], w2: [54, 52] },
    B: { k2: [62, 72], a2: [74, 88] },
  },
};

// Ordem importa: regras mais específicas primeiro.
const RULES = [
  [/inverso|reverse fly|face pull/, "lateral"],
  [/crucifixo|crossover|cross over|voador|peck|fly/, "fly"],
  [/supino.*inclinad|inclinad.*supino|incline/, "incline"],
  [/supino|bench press|chest press/, "bench"],
  [/flexao|push ?up/, "pushup"],
  [/puxada|pulldown|pull down|barra fixa|pull ?up|chin ?up/, "pulldown"],
  [/remada (baixa|sentad)|seated row|cable row/, "rowSeated"],
  [/remada|serrote|row/, "row"],
  [/leg press|legpress/, "legPress"],
  [/extensora|leg extension/, "legExt"],
  [/flexora|leg curl|hamstring curl/, "legCurl"],
  [/panturrilha|gemeos|calf/, "calf"],
  [/afundo|avanco|passada|lunge|bulgar|split squat/, "lunge"],
  [/agachamento|squat|hack|goblet/, "squat"],
  [/stiff|terra|deadlift|rdl|good morning|bom dia/, "hinge"],
  [/elevacao pelvica|hip thrust|ponte|glute bridge/, "hipThrust"],
  [/elevacao de pernas|abdominal infra|infra|leg raise/, "legRaise"],
  [/elevacao lateral|lateral raise/, "lateral"],
  [/elevacao frontal|front raise/, "frontRaise"],
  [/desenvolvimento|militar|arnold|overhead press|shoulder press/, "press"],
  [/testa|skull/, "skull"],
  [/frances|overhead extension|triceps overhead|triceps nuca/, "overheadExt"],
  [/mergulho|paralela|dip/, "dip"],
  [/rosca.*alternad|alternat.*curl/, "curlAlt"],
  [/rosca|curl|biceps/, "curl"],
  [/triceps|corda|pulley|pushdown|push down|coice|kickback/, "pushdown"],
  [/prancha|plank/, "plank"],
  [/abdominal|crunch|supra/, "crunch"],
  [/abdutora|adutora|abducao|aducao/, "abduction"],
];

const BY_GROUP = {
  Peito: "bench", Costas: "row", Pernas: "squat", Ombros: "press",
  "Bíceps": "curl", "Tríceps": "pushdown", "Abdômen": "crunch", "Glúteos": "hipThrust",
};

export function patternFor(name, group) {
  const n = norm(name);
  for (const [re, key] of RULES) if (re.test(n)) return key;
  return BY_GROUP[group] || "curl";
}

// ---------- renderização ----------
const SEGS = [["s", "p"], ["s", "e"], ["e", "w"], ["p", "k"], ["k", "a"], ["a", "t"]];
const SEGS2 = [["p", "k2"], ["k2", "a2"], ["a2", "t2"], ["s", "e2"], ["e2", "w2"]];

function complete(pattern) {
  const rawA = pattern.A;
  const rawB = pattern.B || {};
  const A = { ...rawA };
  const B = { ...rawA, ...rawB };
  const foot = (a, side) => (pattern.front ? [a[0] + (side === 2 ? 6 : -6), a[1]] : [a[0] + 7, a[1]]);
  for (const [t, a, side] of [["t", "a", 1], ["t2", "a2", 2]]) {
    if (!A[a]) continue;
    A[t] = rawA[t] || foot(A[a], side);
    B[t] = rawB[t] || (rawB[a] ? foot(B[a], side) : A[t]);
  }
  return { A, B };
}

const r1 = (v) => Math.round(v * 10) / 10;

function makeAnim(dur) {
  return (attr, a, b) =>
    a === b
      ? ""
      : `<animate attributeName="${attr}" values="${a};${b};${a}" keyTimes="0;0.5;1" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>`;
}

function line(p1A, p2A, p1B, p2B, cls, anim, animate) {
  const [x1, y1] = animate ? p1A : p1B;
  const [x2, y2] = animate ? p2A : p2B;
  const kids = animate
    ? anim("x1", p1A[0], p1B[0]) + anim("y1", p1A[1], p1B[1]) + anim("x2", p2A[0], p2B[0]) + anim("y2", p2A[1], p2B[1])
    : "";
  return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${kids}</line>`;
}

function circle(cA, cB, r, cls, anim, animate) {
  const [cx, cy] = animate ? cA : cB;
  const kids = animate ? anim("cx", cA[0], cB[0]) + anim("cy", cA[1], cB[1]) : "";
  return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}">${kids}</circle>`;
}

const cache = new Map();

/** Retorna a marcação <svg> animada para o exercício. `animate: false` mostra só a pose final, parada. */
export function exerciseSvg(name, group, { animate = true } = {}) {
  const key = patternFor(name, group);
  const ck = key + (animate ? "" : ":static");
  if (cache.has(ck)) return cache.get(ck);

  const pattern = PATTERNS[key];
  const { A, B } = complete(pattern);
  const anim = makeAnim(pattern.dur || 2.4);
  const out = [];

  out.push(`<line class="ea-floor" x1="4" y1="93" x2="96" y2="93"/>`);
  for (const [x1, y1, x2, y2] of pattern.scene || []) out.push(`<line class="ea-scene" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);

  // membros do lado de trás primeiro
  for (const [j1, j2] of SEGS2) if (A[j1] && A[j2]) out.push(line(A[j1], A[j2], B[j1], B[j2], "ea-fig ea-far", anim, animate));
  for (const [j1, j2] of SEGS) if (A[j1] && A[j2]) out.push(line(A[j1], A[j2], B[j1], B[j2], "ea-fig", anim, animate));
  out.push(circle(A.h, B.h, 6, "ea-head", anim, animate));

  for (const pr of pattern.props || []) {
    if (pr.c) out.push(circle(A[pr.c], B[pr.c], pr.r, pr.fill ? "ea-prop ea-fill" : "ea-prop", anim, animate));
    else if (pr.b) out.push(line(A[pr.b[0]], A[pr.b[1]], B[pr.b[0]], B[pr.b[1]], "ea-prop", anim, animate));
    else if (pr.cable) out.push(line(A[pr.cable], pr.to, B[pr.cable], pr.to, "ea-cable", anim, animate));
    else if (pr.seg) {
      const off = (p, d) => [r1(p[0] + d[0]), r1(p[1] + d[1])];
      const [d1, d2] = pr.d;
      out.push(line(off(A[pr.seg], d1), off(A[pr.seg], d2), off(B[pr.seg], d1), off(B[pr.seg], d2), "ea-prop", anim, animate));
    }
  }

  const svg = `<svg class="ea" viewBox="0 -8 100 104" aria-hidden="true" focusable="false">${out.join("")}</svg>`;
  cache.set(ck, svg);
  return svg;
}

export const PATTERN_KEYS = Object.keys(PATTERNS);
