import React, { createContext, useContext, useMemo, useState } from "react";
import { createAdminApi } from "./api";

type LoginResponse = { access_token: string };

type AdminContextType = {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  api: ReturnType<typeof createAdminApi>;
};

const AdminAuthContext = createContext<AdminContextType | null>(null);
const TOKEN_KEY = "bhash_admin_token";

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const api = useMemo(() => createAdminApi(token ?? undefined), [token]);

  const value = useMemo<AdminContextType>(
    () => ({
      token,
      isAuthenticated: !!token,
      api,
      login: async (username, password) => {
        const res = await createAdminApi().post<LoginResponse>("/admin/auth/login", {
          username,
          password,
        });
        const t = res.data.access_token;
        localStorage.setItem(TOKEN_KEY, t);
        setToken(t);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      },
    }),
    [token, api]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
