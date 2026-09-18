const isViteDev = typeof window !== "undefined" && window.location.port === "5173";
const defaultOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
const defaultHost = typeof window !== "undefined" ? window.location.host : "localhost:8080";
const defaultWsProto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";

const API = import.meta.env.VITE_API_URL || (isViteDev ? "http://localhost:8080/api" : `${defaultOrigin}/api`);
const WS = import.meta.env.VITE_WS_URL || (isViteDev ? "ws://localhost:8080/ws" : `${defaultWsProto}//${defaultHost}/ws`);

async function request(path, options = {}) {
  const token = localStorage.getItem("pulse_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const api = {
  signup: (body) => request("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  googleLogin: (body) => request("/auth/google", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),
  createPoll: (body) => request("/polls", { method: "POST", body: JSON.stringify(body) }),
  mine: () => request("/polls/mine"),
  getPoll: (id) => request(`/polls/${id}`),
  vote: (id, body) => request(`/polls/${id}/vote`, { method: "POST", body: JSON.stringify(body) }),
  status: (id, status) => request(`/polls/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deletePoll: (id) => request(`/polls/${id}`, { method: "DELETE" }),
  getExport: (id, format = "json") => request(`/polls/${id}/export?format=${format}`),
  exportUrl: (id, format = "csv") => `${API}/polls/${id}/export?format=${format}`,
};

export function pollSocket(id) {
  return new WebSocket(`${WS}/polls/${id}`);
}
