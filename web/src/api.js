const BASE = import.meta.env.VITE_API_URL;
export const getToken = () => localStorage.getItem("token");
export const setToken = (t) => (t ? localStorage.setItem("token", t) : localStorage.removeItem("token"));

async function req(path, method = "GET", body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(getToken() && { Authorization: "Bearer " + getToken() }) },
    body: body && JSON.stringify(body),
  });
  if (r.status === 401 && getToken()) { setToken(null); location.reload(); }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erro " + r.status);
  return r.status === 204 ? null : r.json();
}

export const api = {
  login: (b) => req("/auth/login", "POST", b),
  register: (b) => req("/auth/register", "POST", b),
  list: () => req("/plans"),
  create: (p) => req("/plans", "POST", p),
  update: (p) => req("/plans/" + p.id, "PUT", p),
  remove: (id) => req("/plans/" + id, "DELETE"),
  generate: (q) => req("/plans/generate", "POST", q),
  deleteAccount: () => req("/me", "DELETE"),
};
