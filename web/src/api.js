const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

export const getToken = () => localStorage.getItem("token");
export const setToken = (t) => (t ? localStorage.setItem("token", t) : localStorage.removeItem("token"));

// Disparado quando o token expira/é inválido, para o App voltar à tela de login
export const AUTH_EXPIRED = "uworkout:auth-expired";

async function req(path, method = "GET", body) {
  const token = getToken();
  let r;
  try {
    r = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível conectar à API. Se ela está no plano gratuito do Render, aguarde ~1 min e tente de novo.");
  }
  if (r.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event(AUTH_EXPIRED));
  }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erro " + r.status);
  return r.status === 204 ? null : r.json();
}

export const api = {
  login: (b) => req("/auth/login", "POST", b),
  register: (b) => req("/auth/register", "POST", b),
  me: () => req("/me"),
  deleteAccount: () => req("/me", "DELETE"),
  list: () => req("/plans"),
  create: (p) => req("/plans", "POST", p),
  update: (p) => req("/plans/" + p.id, "PUT", p),
  remove: (id) => req("/plans/" + id, "DELETE"),
  generate: (q) => req("/plans/generate", "POST", q),
};
