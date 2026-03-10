import axios from "axios";

const LOCALHOST_BASE_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|::1|\[::1\])(?::\d{1,5})?$/i;
const LOCALHOST_HOST_RE = /^(?:localhost|127\.0\.0\.1|::1|\[::1\])$/i;

function resolveApiBase() {
  const envBase = import.meta.env.VITE_API_BASE?.trim();
  const runtimeBase =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : "http://localhost:3000";

  if (!envBase) return runtimeBase;

  const runningOnLocalhost =
    typeof window === "undefined" || LOCALHOST_HOST_RE.test(window.location.hostname);

  // Evita quebrar acesso via LAN quando .env estiver fixo em localhost.
  if (LOCALHOST_BASE_RE.test(envBase) && !runningOnLocalhost) {
    return runtimeBase;
  }

  return envBase;
}

export const API_BASE = resolveApiBase();

export function createAdminApi(token?: string) {
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
