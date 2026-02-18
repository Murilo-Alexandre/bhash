import React, { useState } from "react";
import { useAdminAuth } from "../adminAuth";
import { useTheme } from "../theme";
import { TopNav } from "../components/TopNav";

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const { theme, toggle, logoUrl } = useTheme();

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
      setError("Usuário ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopNav
        title="BHASH • Admin"
        subtitle="Painel administrativo"
        theme={theme}
        onToggleTheme={toggle}
        logoSrc={logoUrl ?? "/logo_bhash.png"}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "40px 16px 60px",
        }}
      >
        <div
          style={{
            width: "min(520px, 100%)",
            padding: 24,
            borderRadius: 18,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            boxShadow: "var(--shadow)",
          }}
        >
          <h1 style={{ textAlign: "center", marginBottom: 20 }}>BHASH - Admin</h1>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuário"
              autoComplete="username"
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--input-border)",
                background: "var(--input-bg)",
                color: "var(--input-fg)",
              }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="senha"
              type="password"
              autoComplete="current-password"
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--input-border)",
                background: "var(--input-bg)",
                color: "var(--input-fg)",
              }}
            />

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                fontWeight: 800,
                background: "var(--btn-bg)",
                color: "var(--btn-fg)",
                border: "1px solid var(--border)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {error && <div style={{ fontSize: 13, color: "#ff8a8a" }}>{error}</div>}

            <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
              Use as credenciais configuradas na instalação.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
