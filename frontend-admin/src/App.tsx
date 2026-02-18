import { useEffect, useState } from "react";
import { useAdminAuth } from "./adminAuth";
import { useTheme } from "./theme";
import { TopNav } from "./components/TopNav";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminAppConfigPage } from "./pages/AdminAppConfigPage";
import { AdminFirstLoginPage } from "./pages/AdminFirstLoginPage";

type PageKey = "dashboard" | "appConfig";

type Me = {
  id: string;
  username: string;
  name: string;
  isSuperAdmin: boolean;
  mustChangeCredentials: boolean;
};

export default function App() {
  const { isAuthenticated, logout, api } = useAdminAuth();
  const { theme, toggle, logoUrl } = useTheme();
  const [page, setPage] = useState<PageKey>("dashboard");

  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  async function loadMe() {
    setLoadingMe(true);
    try {
      const res = await api.get<Me>("/admin/auth/me");
      setMe(res.data);
    } catch {
      logout();
    } finally {
      setLoadingMe(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setMe(null);
      return;
    }
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) return <AdminLoginPage />;

  // aguardando /me
  if (loadingMe || !me) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--muted)" }}>
        Carregando…
      </div>
    );
  }

  // 🔒 trava tudo até trocar credenciais (somente superadmin faz sentido)
  if (me.mustChangeCredentials) {
    if (!me.isSuperAdmin) {
      logout();
      return null;
    }

    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopNav
          title="BHASH • Admin"
          subtitle="Painel administrativo"
          theme={theme}
          onToggleTheme={toggle}
          logoSrc={logoUrl}
          rightSlot={
            <button
              onClick={logout}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(0,0,0,0.20)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Sair
            </button>
          }
        />
        <AdminFirstLoginPage />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopNav
        title="BHASH • Admin"
        subtitle="Painel administrativo"
        theme={theme}
        onToggleTheme={toggle}
        logoSrc={logoUrl}
        rightSlot={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setPage("dashboard")} style={tabBtn(page === "dashboard")}>
              Dashboard
            </button>
            <button onClick={() => setPage("appConfig")} style={tabBtn(page === "appConfig")}>
              Config do App
            </button>
            <button
              onClick={logout}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(0,0,0,0.20)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Sair
            </button>
          </div>
        }
      />

      <div style={{ flex: 1 }}>
        {page === "dashboard" ? <AdminDashboard /> : <AdminAppConfigPage />}
      </div>
    </div>
  );
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.22)",
    background: active ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.14)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  };
}
