export type AppConfigDto = {
  primaryColor: string;
  logoUrl?: string | null;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export function getApiBase() {
  return API_BASE;
}

export async function fetchAppConfig(): Promise<AppConfigDto> {
  const res = await fetch(`${API_BASE}/app-config`, { method: "GET" });
  if (!res.ok) throw new Error(`Failed to fetch /app-config (${res.status})`);
  return res.json();
}

export function resolveLogoUrl(logoUrl: string | null | undefined) {
  if (!logoUrl) return null;

  if (/^(https?:)?\/\//i.test(logoUrl) || logoUrl.startsWith("data:")) return logoUrl;

  if (logoUrl === "/logo_bhash.png") return logoUrl;

  if (logoUrl.startsWith("/static/")) return `${API_BASE}${logoUrl}`;

  if (logoUrl.startsWith("/")) return `${API_BASE}${logoUrl}`;

  return logoUrl;
}
