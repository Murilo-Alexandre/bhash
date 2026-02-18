import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { LoginPage } from "./pages/LoginPage";
import { ChatPage } from "./pages/ChatPage";
import { FirstLoginChangePasswordPage } from "./pages/FirstLoginChangePasswordPage";

type Me = {
  id: string;
  username: string;
  name: string;
  mustChangePassword: boolean;
};

export default function App() {
  const { isAuthenticated, api, logout } = useAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  async function loadMe() {
    setLoadingMe(true);
    try {
      const res = await api.get<Me>("/auth/me");
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

  if (!isAuthenticated) return <LoginPage />;

  if (loadingMe || !me) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--muted)" }}>
        Carregando…
      </div>
    );
  }

  if (me.mustChangePassword) {
    return <FirstLoginChangePasswordPage onDone={loadMe} />;
  }

  return <ChatPage />;
}
