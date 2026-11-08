import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Erro na requisição");
  return data;
}

const css = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
.wrap{max-width:720px;margin:0 auto;padding:16px}
.card{background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px}
h1,h2,h3{margin:0 0 12px}
label{display:block;font-size:13px;color:#94a3b8;margin:10px 0 4px}
input,select,textarea{width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0}
button{padding:10px 16px;border:0;border-radius:8px;background:#10b981;color:#04130d;font-weight:600;cursor:pointer}
button.sec{background:#334155;color:#e2e8f0}button.del{background:#ef4444;color:#fff}
button:disabled{opacity:.5;cursor:not-allowed}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row>*{flex:1}
.nav{display:flex;gap:8px;margin-bottom:16px}.nav button{flex:1}.nav .on{background:#10b981;color:#04130d}
.err{color:#fca5a5;font-size:14px;margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:6px;border-bottom:1px solid #334155}
.muted{color:#94a3b8;font-size:13px}
`;

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const data = await api(`/auth/${mode}`, { method: "POST", body: f });
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
      {mode === "register" && (
        <>
          <label>Nome</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </>
      )}
      <label>E-mail</label>
      <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      <label>Senha</label>
      <input type="password" minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        <button disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}</button>
        <button type="button" className="sec" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </form>
  );
}

function PlanView({ plan }) {
  return (
    <div>
      <h3>{plan.name}</h3>
      {plan.days.map((d, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <strong>{d.name}</strong> <span className="muted">{d.focus}</span>
          <table>
            <thead>
              <tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Descanso</th></tr>
            </thead>
            <tbody>
              {d.exercises.map((ex, j) => (
                <tr key={j}>
                  <td>{ex.name}</td><td>{ex.sets}</td><td>{ex.reps}</td><td>{ex.rest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function Generator({ token, onSaved }) {
  const [a, setA] = useState({
    goal: "hipertrofia",
    level: "iniciante",
    daysPerWeek: 3,
    equipment: "academia completa",
    minutes: 60,
    limitations: "",
  });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setA({ ...a, [k]: e.target.value });

  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setPlan(null);
    try {
      setPlan(await api("/plans/generate", { method: "POST", token, body: { answers: a } }));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    try {
      await api("/plans", { method: "POST", token, body: { name: plan.name, days: plan.days } });
      setPlan(null);
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <>
      <form className="card" onSubmit={generate}>
        <h2>Gerar treino com IA</h2>
        <label>Objetivo</label>
        <select value={a.goal} onChange={set("goal")}>
          <option>hipertrofia</option><option>força</option><option>emagrecimento</option><option>resistência</option>
        </select>
        <label>Nível</label>
        <select value={a.level} onChange={set("level")}>
          <option>iniciante</option><option>intermediário</option><option>avançado</option>
        </select>
        <div className="row">
          <div>
            <label>Dias por semana</label>
            <input type="number" min="1" max="7" value={a.daysPerWeek} onChange={set("daysPerWeek")} />
          </div>
          <div>
            <label>Minutos por treino</label>
            <input type="number" min="15" max="180" value={a.minutes} onChange={set("minutes")} />
          </div>
        </div>
        <label>Equipamento</label>
        <select value={a.equipment} onChange={set("equipment")}>
          <option>academia completa</option><option>halteres em casa</option><option>apenas peso do corpo</option>
        </select>
        <label>Limitações (opcional)</label>
        <textarea rows={2} value={a.limitations} onChange={set("limitations")} placeholder="Ex.: dor no joelho" />
        <div style={{ marginTop: 14 }}>
          <button disabled={busy}>{busy ? "Gerando..." : "Gerar plano"}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </form>

      {plan && (
        <div className="card">
          <PlanView plan={plan} />
          <div className="row">
            <button onClick={save}>Salvar plano</button>
            <button className="sec" onClick={() => setPlan(null)}>Descartar</button>
          </div>
        </div>
      )}
    </>
  );
}

function ManualPlan({ token, onSaved }) {
  const [name, setName] = useState("");
  const [days, setDays] = useState([{ name: "Treino A", focus: "", exercises: [] }]);
  const [err, setErr] = useState("");

  const upDay = (i, patch) => setDays(days.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const addEx = (i) =>
    upDay(i, { exercises: [...days[i].exercises, { name: "", sets: 3, reps: "10", rest: "60s" }] });
  const upEx = (i, j, patch) =>
    upDay(i, { exercises: days[i].exercises.map((ex, k) => (k === j ? { ...ex, ...patch } : ex)) });

  async function save() {
    setErr("");
    const clean = days
      .map((d) => ({ ...d, exercises: d.exercises.filter((e) => e.name.trim()) }))
      .filter((d) => d.exercises.length);
    if (!name.trim() || !clean.length) return setErr("Dê um nome e adicione ao menos um exercício.");
    try {
      await api("/plans", { method: "POST", token, body: { name, days: clean } });
      setName("");
      setDays([{ name: "Treino A", focus: "", exercises: [] }]);
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="card">
      <h2>Montar manualmente</h2>
      <label>Nome do plano</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      {days.map((d, i) => (
        <div key={i} style={{ marginTop: 16 }}>
          <div className="row">
            <input value={d.name} onChange={(e) => upDay(i, { name: e.target.value })} placeholder="Nome do dia" />
            <input value={d.focus} onChange={(e) => upDay(i, { focus: e.target.value })} placeholder="Foco" />
          </div>
          {d.exercises.map((ex, j) => (
            <div className="row" key={j} style={{ marginTop: 6 }}>
              <input style={{ flex: 3 }} value={ex.name} onChange={(e) => upEx(i, j, { name: e.target.value })} placeholder="Exercício" />
              <input type="number" min="1" max="10" value={ex.sets} onChange={(e) => upEx(i, j, { sets: Number(e.target.value) })} />
              <input value={ex.reps} onChange={(e) => upEx(i, j, { reps: e.target.value })} />
              <input value={ex.rest} onChange={(e) => upEx(i, j, { rest: e.target.value })} />
            </div>
          ))}
          <button type="button" className="sec" style={{ marginTop: 8 }} onClick={() => addEx(i)}>
            + Exercício
          </button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="sec" onClick={() => setDays([...days, { name: `Treino ${String.fromCharCode(65 + days.length)}`, focus: "", exercises: [] }])}>
          + Dia
        </button>
        <button onClick={save}>Salvar plano</button>
      </div>
      {err && <div className="err">{err}</div>}
    </div>
  );
}

function MyPlans({ token, refreshKey }) {
  const [plans, setPlans] = useState([]);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const data = await api("/plans", { token });
      setPlans(Array.isArray(data) ? data : data.plans || []);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, [refreshKey]);

  async function remove(id) {
    if (!confirm("Excluir este plano?")) return;
    try {
      await api(`/plans/${id}`, { method: "DELETE", token });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  const norm = (p) => ({ name: p.name, days: p.days ?? p.data?.days ?? [] });

  return (
    <div>
      {err && <div className="err">{err}</div>}
      {!plans.length && <div className="card muted">Nenhum plano salvo ainda.</div>}
      {plans.map((p) => (
        <div className="card" key={p.id}>
          <div className="row">
            <strong style={{ flex: 3 }}>{p.name}</strong>
            <button className="sec" onClick={() => setOpen(open === p.id ? null : p.id)}>
              {open === p.id ? "Fechar" : "Abrir"}
            </button>
            <button className="del" onClick={() => remove(p.id)}>Excluir</button>
          </div>
          {open === p.id && <div style={{ marginTop: 12 }}><PlanView plan={norm(p)} /></div>}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [tab, setTab] = useState("gerar");
  const [refreshKey, setRefreshKey] = useState(0);

  function onAuth(t, u) {
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u || null));
    setToken(t);
    setUser(u);
  }
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }
  const saved = () => { setRefreshKey((k) => k + 1); setTab("planos"); };

  return (
    <div className="wrap">
      <style>{css}</style>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ flex: 3 }}>💪 uWorkout</h1>
        {token && <button className="sec" onClick={logout}>Sair{user?.name ? ` (${user.name})` : ""}</button>}
      </div>

      {!token ? (
        <Auth onAuth={onAuth} />
      ) : (
        <>
          <div className="nav">
            {[["gerar", "Gerar com IA"], ["manual", "Manual"], ["planos", "Meus planos"]].map(([k, l]) => (
              <button key={k} className={tab === k ? "on" : "sec"} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === "gerar" && <Generator token={token} onSaved={saved} />}
          {tab === "manual" && <ManualPlan token={token} onSaved={saved} />}
          {tab === "planos" && <MyPlans token={token} refreshKey={refreshKey} />}
        </>
      )}
    </div>
  );
}
