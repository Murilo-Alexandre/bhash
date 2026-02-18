import React, { useState } from "react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { TopNav } from "../components/TopNav";

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme, resolvedLogoUrl } = useTheme();

  // ✅ não preenche automaticamente
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Falha no login";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopNav
        title="BHASH • Chat"
        subtitle=""
        theme={theme}
        onToggleTheme={toggleTheme}
        logoSrc={resolvedLogoUrl}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "36px 16px 56px",
        }}
      >
        <div
          style={{
            width: "min(520px, 100%)",
            padding: 22,
            borderRadius: 18,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            boxShadow: "var(--shadow)",
            backdropFilter: "blur(10px)",
          }}
        >
          <h1 style={{ margin: 0, marginBottom: 14, textAlign: "center", letterSpacing: 0.2 }}>
            BHASH - Chat
          </h1>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuário"
              autoComplete="username"
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--input-border)",
                background: "var(--input-bg)",
                color: "var(--input-fg)",
                outline: "none",
              }}
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="senha"
              type="password"
              autoComplete="current-password"
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--input-border)",
                background: "var(--input-bg)",
                color: "var(--input-fg)",
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              style={{
                marginTop: 6,
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 800,
                background: "var(--btn-bg)",
                color: "var(--btn-fg)",
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {error && <div style={{ marginTop: 6, fontSize: 13, color: "#ff8a8a" }}>{error}</div>}

            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              Use as credenciais fornecidas pelo administrador.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
