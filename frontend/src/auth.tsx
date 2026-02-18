import React, { createContext, useContext, useMemo, useState } from "react";
import { createApi } from "./api";

type LoginResponse = { access_token: string };

type AuthContextType = {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  api: ReturnType<typeof createApi>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "bhash_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const api = useMemo(() => createApi(token ?? undefined), [token]);

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      isAuthenticated: !!token,
      api,
      login: async (username, password) => {
        try {
          const res = await createApi().post<LoginResponse>("/auth/login", { username, password });
          const t = res.data.access_token;
          localStorage.setItem(TOKEN_KEY, t);
          setToken(t);
        } catch (e) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          throw e;
        }
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      },
    }),
    [token, api]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
