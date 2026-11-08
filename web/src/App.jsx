import { useEffect, useState } from "react";
import { api, getToken, setToken, AUTH_EXPIRED } from "./api.js";
import ExerciseAnim from "./ExerciseAnim.jsx";

// Mantenha em sincronia com server/src/engine.js
const GROUPS = ["Peito", "Costas", "Pernas", "Ombros", "Bíceps", "Tríceps", "Abdômen", "Glúteos"];
const RUN_KINDS = ["Leve", "Intervalado", "Tempo", "Longo", "Regenerativo"];
const MODALITIES = { musculacao: "Musculação", corrida: "Corrida", ambos: "Musculação + corrida" };
const LEVELS = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };
const OBJ_S = { hipertrofia: "Hipertrofia", forca: "Força", emagrecimento: "Emagrecimento", condicionamento: "Condicionamento" };
const OBJ_R = { saude: "Saúde", "5k": "5 km", "10k": "10 km", meia: "Meia maratona" };
const SPLITS = { "": "Automática", full: "Corpo todo (full body)", abc: "ABC", ul: "Superiores / inferiores", ppl: "Push / Pull / Legs" };

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const fmtRest = (s) => (s >= 60 ? `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ""}` : `${s}s`);
const emptyEx = () => ({ id: newId(), group: "Peito", name: "", sets: 3, reps: "10-12", rest: 60 });
const emptyDay = (type, n) =>
  type === "run"
    ? { id: newId(), type: "run", name: "Corrida Leve", done: false, run: { kind: "Leve", duration: 30, details: "" } }
    : { id: newId(), type: "strength", name: `Treino ${String.fromCharCode(65 + n)}`, done: false, exercises: [emptyEx()] };

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

// ---------- Login / cadastro ----------
function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const data = await (mode === "login" ? api.login(f) : api.register(f));
      onAuth(data.token, data.user);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{mode === "login" ? "Entrar" : "Criar conta"}</h2>
      <label>E-mail</label>
      <input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      <label>Senha</label>
      <input
        type="password" minLength={8} required
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
      />
      {mode === "register" && <div className="muted">Mínimo de 8 caracteres.</div>}
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        <button disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}</button>
        <button type="button" className="sec" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
          {mode === "login" ? "Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </form>
  );
}

// ---------- Visualização ----------
function ExerciseModal({ ex, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={ex.name} onClick={(e) => e.stopPropagation()}>
        <ExerciseAnim name={ex.name} group={ex.group} size={220} className="ea-big" />
        <h3 style={{ margin: "12px 0 4px" }}>{ex.name}</h3>
        <div className="muted">{ex.group} • {ex.sets} séries × {ex.reps} • descanso {fmtRest(ex.rest)}</div>
        <button style={{ marginTop: 16, width: "100%" }} onClick={onClose} autoFocus>Fechar</button>
      </div>
    </div>
  );
}

function PlanView({ plan, onToggleDay }) {
  const [show, setShow] = useState(null);
  return (
    <div>
      {show && <ExerciseModal ex={show} onClose={() => setShow(null)} />}
      <div className="muted" style={{ marginBottom: 10 }}>
        {[MODALITIES[plan.modality], LEVELS[plan.level], plan.goal, plan.time && `${plan.time} min/sessão`].filter(Boolean).join(" • ")}
      </div>
      {plan.days.map((d, i) => (
        <div key={d.id || i} className={"day" + (d.done ? " done" : "")}>
          <div className="row">
            <strong style={{ flex: 3 }}>{d.name}</strong>
            {onToggleDay && (
              <label className="check">
                <input type="checkbox" checked={!!d.done} onChange={() => onToggleDay(i)} /> Feito
              </label>
            )}
          </div>
          {d.type === "run" ? (
            <p className="muted">{d.run?.kind} • {d.run?.duration} min{d.run?.details ? ` — ${d.run.details}` : ""}</p>
          ) : (
            <div className="scroll">
              <table>
                <thead>
                  <tr><th>Exercício</th><th>Grupo</th><th>Séries</th><th>Reps</th><th>Descanso</th></tr>
                </thead>
                <tbody>
                  {(d.exercises || []).map((ex, j) => (
                    <tr key={ex.id || j}>
                      <td>
                        <button type="button" className="ex-link" onClick={() => setShow(ex)} title="Ver movimento">
                          <ExerciseAnim name={ex.name} group={ex.group} size={52} />
                          <span>{ex.name}</span>
                        </button>
                      </td>
                      <td>{ex.group}</td><td>{ex.sets}</td><td>{ex.reps}</td><td>{fmtRest(ex.rest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Geração com IA ----------
function Generator({ onSaved }) {
  const [q, setQ] = useState({
    name: "", modality: "musculacao", objS: "hipertrofia", objR: "saude", level: "iniciante",
    runBase: 0, days: 3, time: 60, split: "", emphasis: [], notes: "",
  });
  const [plan, setPlan] = useState(null);
  const [quota, setQuota] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (v) => setQ({ ...q, [k]: v });
  const num = (k) => (e) => setQ({ ...q, [k]: e.target.value === "" ? "" : Number(e.target.value) });
  const toggleEmph = (g) => set("emphasis")(q.emphasis.includes(g) ? q.emphasis.filter((x) => x !== g) : [...q.emphasis, g]);
  const hasS = q.modality !== "corrida";
  const hasR = q.modality !== "musculacao";

  const loadQuota = () => api.me().then(setQuota).catch(() => {});
  useEffect(() => { loadQuota(); }, []);

  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setPlan(null);
    try {
      setPlan(await api.generate(q)); // o backend já salva o plano gerado
      loadQuota();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    try { await api.remove(plan.id); } catch { /* ignora */ }
    setPlan(null);
  }

  return (
    <>
      <form className="card" onSubmit={generate}>
        <h2>Gerar treino com IA</h2>
        {quota && <div className="muted">Gerações com IA hoje: {quota.aiUsed}/{quota.aiLimit}</div>}
        <label>Nome do plano (opcional)</label>
        <input value={q.name} maxLength={100} onChange={(e) => set("name")(e.target.value)} />
        <div className="row">
          <div><label>Modalidade</label><Select value={q.modality} onChange={set("modality")} options={MODALITIES} /></div>
          <div><label>Nível</label><Select value={q.level} onChange={set("level")} options={LEVELS} /></div>
        </div>
        <div className="row">
          {hasS && <div><label>Objetivo (musculação)</label><Select value={q.objS} onChange={set("objS")} options={OBJ_S} /></div>}
          {hasR && <div><label>Objetivo (corrida)</label><Select value={q.objR} onChange={set("objR")} options={OBJ_R} /></div>}
        </div>
        <div className="row">
          <div><label>Dias por semana</label><input type="number" min="1" max="6" required value={q.days} onChange={num("days")} /></div>
          <div><label>Minutos por sessão</label><input type="number" min="30" max="120" step="5" required value={q.time} onChange={num("time")} /></div>
          {hasR && <div><label>Já corre (min)</label><input type="number" min="0" max="120" value={q.runBase} onChange={num("runBase")} /></div>}
        </div>
        {hasS && (
          <>
            <label>Divisão</label>
            <Select value={q.split} onChange={set("split")} options={SPLITS} />
            <label>Grupos para priorizar</label>
            <div className="chips">
              {GROUPS.map((g) => (
                <button type="button" key={g} className={q.emphasis.includes(g) ? "chip on" : "chip"} onClick={() => toggleEmph(g)}>{g}</button>
              ))}
            </div>
          </>
        )}
        <label>Limitações / observações (opcional)</label>
        <textarea rows={2} maxLength={300} value={q.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Ex.: dor no joelho, treino em casa com halteres" />
        <div style={{ marginTop: 14 }}>
          <button disabled={busy}>{busy ? "Gerando... (pode levar até 1 min)" : "Gerar plano"}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </form>

      {plan && (
        <div className="card">
          <h3>{plan.name}</h3>
          {plan.created !== "IA" && <div className="muted" style={{ marginBottom: 8 }}>A IA não estava disponível; este plano foi montado pelo gerador automático e não consumiu sua cota.</div>}
          <PlanView plan={plan} />
          <div className="row">
            <button onClick={onSaved}>Ver em Meus planos</button>
            <button className="sec" onClick={discard}>Descartar</button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Criação / edição manual ----------
function PlanEditor({ initial, onSaved, onCancel }) {
  const [p, setP] = useState(
    () => initial || { name: "", goal: "", modality: "musculacao", level: "iniciante", time: 60, created: "manual", days: [emptyDay("strength", 0)] }
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const upDay = (i, patch) => setP({ ...p, days: p.days.map((d, k) => (k === i ? { ...d, ...patch } : d)) });
  const upEx = (i, j, patch) => upDay(i, { exercises: p.days[i].exercises.map((ex, k) => (k === j ? { ...ex, ...patch } : ex)) });
  const delEx = (i, j) => upDay(i, { exercises: p.days[i].exercises.filter((_, k) => k !== j) });
  const addDay = (type) => setP({ ...p, days: [...p.days, emptyDay(type, p.days.filter((d) => d.type === "strength").length)] });
  const delDay = (i) => setP({ ...p, days: p.days.filter((_, k) => k !== i) });
  const moveDay = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= p.days.length) return;
    const days = [...p.days];
    [days[i], days[j]] = [days[j], days[i]];
    setP({ ...p, days });
  };

  async function save() {
    setErr("");
    const days = p.days
      .map((d) => (d.type === "strength" ? { ...d, exercises: d.exercises.filter((e) => e.name.trim()) } : d))
      .filter((d) => d.type === "run" || d.exercises.length);
    if (!p.name.trim()) return setErr("Dê um nome ao plano.");
    if (!days.length) return setErr("Adicione ao menos um dia com exercícios.");
    setBusy(true);
    try {
      const body = { ...p, days };
      await (p.id ? api.update(body) : api.create(body));
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>{p.id ? "Editar plano" : "Montar manualmente"}</h2>
      <label>Nome do plano</label>
      <input value={p.name} maxLength={100} onChange={(e) => setP({ ...p, name: e.target.value })} />
      <div className="row">
        <div><label>Modalidade</label><Select value={p.modality} onChange={(v) => setP({ ...p, modality: v })} options={MODALITIES} /></div>
        <div><label>Nível</label><Select value={p.level} onChange={(v) => setP({ ...p, level: v })} options={LEVELS} /></div>
        <div><label>Min/sessão</label><input type="number" min="10" max="240" value={p.time} onChange={(e) => setP({ ...p, time: Number(e.target.value) })} /></div>
      </div>
      <label>Objetivo (opcional)</label>
      <input value={p.goal} maxLength={100} onChange={(e) => setP({ ...p, goal: e.target.value })} placeholder="Ex.: Hipertrofia" />

      {p.days.map((d, i) => (
        <div key={d.id} className="day">
          <div className="row">
            <input style={{ flex: 3 }} value={d.name} onChange={(e) => upDay(i, { name: e.target.value })} placeholder="Nome do dia" />
            <button type="button" className="sec icon" title="Subir" onClick={() => moveDay(i, -1)}>↑</button>
            <button type="button" className="sec icon" title="Descer" onClick={() => moveDay(i, 1)}>↓</button>
            <button type="button" className="del icon" title="Remover dia" onClick={() => delDay(i)}>✕</button>
          </div>
          {d.type === "run" ? (
            <>
              <div className="row">
                <div><label>Tipo</label>
                  <select value={d.run.kind} onChange={(e) => upDay(i, { run: { ...d.run, kind: e.target.value } })}>
                    {RUN_KINDS.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div><label>Duração (min)</label>
                  <input type="number" min="5" max="300" value={d.run.duration} onChange={(e) => upDay(i, { run: { ...d.run, duration: Number(e.target.value) } })} />
                </div>
              </div>
              <label>Detalhes</label>
              <input value={d.run.details} maxLength={500} onChange={(e) => upDay(i, { run: { ...d.run, details: e.target.value } })} placeholder="Ex.: 5' aquecimento • 20' leve • 5' desaceleração" />
            </>
          ) : (
            <>
              <div className="exhead row muted">
                <span className="thumb" /><span style={{ flex: 3 }}>Exercício</span><span style={{ flex: 2 }}>Grupo</span><span>Séries</span><span>Reps</span><span>Desc. (s)</span><span className="icon" />
              </div>
              {d.exercises.map((ex, j) => (
                <div className="row ex" key={ex.id}>
                  <ExerciseAnim name={ex.name} group={ex.group} size={40} className="thumb" />
                  <input className="ex-name" style={{ flex: 3 }} value={ex.name} onChange={(e) => upEx(i, j, { name: e.target.value })} placeholder="Exercício" />
                  <select style={{ flex: 2 }} value={ex.group} onChange={(e) => upEx(i, j, { group: e.target.value })}>
                    {GROUPS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                  <input type="number" min="1" max="20" value={ex.sets} onChange={(e) => upEx(i, j, { sets: Number(e.target.value) })} />
                  <input value={ex.reps} maxLength={20} onChange={(e) => upEx(i, j, { reps: e.target.value })} />
                  <input type="number" min="0" max="900" step="15" value={ex.rest} onChange={(e) => upEx(i, j, { rest: Number(e.target.value) })} />
                  <button type="button" className="del icon" title="Remover exercício" onClick={() => delEx(i, j)}>✕</button>
                </div>
              ))}
              <button type="button" className="sec" style={{ marginTop: 8 }} onClick={() => upDay(i, { exercises: [...d.exercises, emptyEx()] })}>
                + Exercício
              </button>
            </>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="sec" onClick={() => addDay("strength")}>+ Dia de musculação</button>
        <button type="button" className="sec" onClick={() => addDay("run")}>+ Dia de corrida</button>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar plano"}</button>
        {onCancel && <button className="sec" onClick={onCancel}>Cancelar</button>}
      </div>
      {err && <div className="err">{err}</div>}
    </div>
  );
}

// ---------- Meus planos ----------
function MyPlans({ onEdit }) {
  const [plans, setPlans] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setPlans(await api.list());
    } catch (e) {
      setErr(e.message);
      setPlans([]);
    }
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!confirm("Excluir este plano?")) return;
    try {
      await api.remove(id);
      setPlans(plans.filter((p) => p.id !== id));
    } catch (e) {
      setErr(e.message);
    }
  }

  async function toggleDay(plan, i) {
    const updated = { ...plan, days: plan.days.map((d, k) => (k === i ? { ...d, done: !d.done } : d)) };
    setPlans(plans.map((p) => (p.id === plan.id ? updated : p)));
    try {
      await api.update(updated);
    } catch (e) {
      setErr(e.message);
      setPlans(plans); // desfaz
    }
  }

  async function resetWeek(plan) {
    const updated = { ...plan, days: plan.days.map((d) => ({ ...d, done: false })) };
    try {
      await api.update(updated);
      setPlans(plans.map((p) => (p.id === plan.id ? updated : p)));
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!plans) return <div className="card muted">Carregando...</div>;
  return (
    <div>
      {err && <div className="err">{err}</div>}
      {!plans.length && <div className="card muted">Nenhum plano salvo ainda.</div>}
      {plans.map((p) => {
        const done = p.days.filter((d) => d.done).length;
        return (
          <div className="card" key={p.id}>
            <div className="row">
              <div style={{ flex: 3 }}>
                <strong>{p.name}</strong>
                <div className="muted">{p.days.length} dias • {done}/{p.days.length} feitos{p.created === "IA" ? " • gerado por IA" : ""}</div>
              </div>
              <button className="sec" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Fechar" : "Abrir"}</button>
            </div>
            {open === p.id && (
              <div style={{ marginTop: 12 }}>
                <PlanView plan={p} onToggleDay={(i) => toggleDay(p, i)} />
                <div className="row">
                  <button className="sec" onClick={() => onEdit(p)}>Editar</button>
                  <button className="sec" onClick={() => resetWeek(p)} disabled={!done}>Zerar semana</button>
                  <button className="del" onClick={() => remove(p.id)}>Excluir</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Conta ----------
function Account({ user, onDeleted }) {
  const [err, setErr] = useState("");
  async function del() {
    if (!confirm("Excluir sua conta e todos os seus planos? Esta ação não pode ser desfeita.")) return;
    try {
      await api.deleteAccount();
      onDeleted();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <div className="card">
      <h2>Conta</h2>
      <p className="muted">{user?.email}</p>
      <button className="del" onClick={del}>Excluir minha conta</button>
      {err && <div className="err">{err}</div>}
    </div>
  );
}

export default function App() {
  const [token, setTok] = useState(getToken);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [tab, setTab] = useState("planos");
  const [editing, setEditing] = useState(null);

  function onAuth(t, u) {
    setToken(t);
    localStorage.setItem("user", JSON.stringify(u || null));
    setTok(t);
    setUser(u);
    setTab("gerar");
  }
  function logout() {
    setToken(null);
    localStorage.removeItem("user");
    setTok(null);
    setUser(null);
  }
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED, logout);
    return () => window.removeEventListener(AUTH_EXPIRED, logout);
  }, []);

  const go = (t) => { setEditing(null); setTab(t); };
  const tabs = [["planos", "Meus planos"], ["gerar", "Gerar com IA"], ["manual", "Manual"], ["conta", "Conta"]];

  return (
    <div className="wrap">
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ flex: 3 }}>💪 uWorkout</h1>
        {token && <button className="sec" style={{ flex: "none" }} onClick={logout}>Sair</button>}
      </div>

      {!token ? (
        <Auth onAuth={onAuth} />
      ) : (
        <>
          <div className="nav">
            {tabs.map(([k, l]) => (
              <button key={k} className={tab === k && !editing ? "on" : "sec"} onClick={() => go(k)}>{l}</button>
            ))}
          </div>
          {editing ? (
            <PlanEditor key={editing.id} initial={editing} onSaved={() => go("planos")} onCancel={() => setEditing(null)} />
          ) : (
            <>
              {tab === "gerar" && <Generator onSaved={() => go("planos")} />}
              {tab === "manual" && <PlanEditor onSaved={() => go("planos")} />}
              {tab === "planos" && <MyPlans onEdit={(p) => setEditing(structuredClone(p))} />}
              {tab === "conta" && <Account user={user} onDeleted={logout} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
