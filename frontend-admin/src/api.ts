import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export function createAdminApi(token?: string) {
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
