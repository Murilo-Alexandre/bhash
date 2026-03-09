import { useEffect, useState } from "react";
import { useAdminAuth } from "./adminAuth";
import { useTheme } from "./theme";
import { TopNav } from "./components/TopNav";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminAppConfigPage } from "./pages/AdminAppConfigPage";
import { AdminFirstLoginPage } from "./pages/AdminFirstLoginPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminOrgPage } from "./pages/AdminOrgPage";
import { AdminHistoryPage } from "./pages/AdminHistoryPage";

type PageKey = "dashboard" | "appConfig" | "users" | "org" | "history" | "audit";

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

  if (loadingMe || !me) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--muted)" }}>
        Carregando…
      </div>
    );
  }

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
          <button onClick={logout} className="admin-logoutBtn">
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
          <div className="admin-navActions">
            <button
              onClick={() => setPage("dashboard")}
              className={`admin-navBtn ${page === "dashboard" ? "is-active" : ""}`}
              aria-current={page === "dashboard" ? "page" : undefined}
            >
              Dashboard
            </button>
            <button
              onClick={() => setPage("appConfig")}
              className={`admin-navBtn ${page === "appConfig" ? "is-active" : ""}`}
              aria-current={page === "appConfig" ? "page" : undefined}
            >
              Config App
            </button>
            <button
              onClick={() => setPage("users")}
              className={`admin-navBtn ${page === "users" ? "is-active" : ""}`}
              aria-current={page === "users" ? "page" : undefined}
            >
              Usuários
            </button>

            <button
              onClick={() => setPage("org")}
              className={`admin-navBtn ${page === "org" ? "is-active" : ""}`}
              aria-current={page === "org" ? "page" : undefined}
            >
              Empresas/Setores
            </button>

            <button
              onClick={() => setPage("history")}
              className={`admin-navBtn ${page === "history" ? "is-active" : ""}`}
              aria-current={page === "history" ? "page" : undefined}
            >
              Históricos
            </button>

            <button onClick={logout} className="admin-logoutBtn">
              Sair
            </button>
          </div>
        }
      />

      <div style={{ flex: 1 }}>
        {page === "dashboard" ? (
          <AdminDashboard />
        ) : page === "appConfig" ? (
          <AdminAppConfigPage />
        ) : page === "users" ? (
          <AdminUsersPage />
        ) : page === "org" ? (
          <AdminOrgPage />
        ) : page === "history" ? (
          <AdminHistoryPage />
        ) : null}
      </div>
    </div>
  );
}
