import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { createSocket } from "../socket";
import type { Socket } from "socket.io-client";
import { TopNav } from "../components/TopNav";

type UserMini = { id: string; username: string; name: string };

type Conversation = {
  id: string;
  userA: UserMini;
  userB: UserMini;
};

type Message = {
  id: string;
  createdAt: string;
  conversationId: string;
  senderId: string;
  body: string;
  sender: UserMini;
};

type Me = {
  sub: string;
  username: string;
  role: "ADMIN" | "USER";
};

type ApiPaged<T> = { items: T[] };

const LS_KEY_HIDDEN_CONVS = "bhash_hidden_conversations";
const LS_KEY_HIDDEN_MSGS = "bhash_hidden_messages";

function readHiddenConvs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_HIDDEN_CONVS) ?? "[]");
  } catch {
    return [];
  }
}

function writeHiddenConvs(ids: string[]) {
  localStorage.setItem(LS_KEY_HIDDEN_CONVS, JSON.stringify(ids));
}

function readHiddenMsgs(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_HIDDEN_MSGS) ?? "{}");
  } catch {
    return {};
  }
}

function writeHiddenMsgs(map: Record<string, string[]>) {
  localStorage.setItem(LS_KEY_HIDDEN_MSGS, JSON.stringify(map));
}

export function ChatPage() {
  const { logout, api, token } = useAuth();
  const { theme, toggleTheme, resolvedLogoUrl } = useTheme();

  const [me, setMe] = useState<Me | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const msgListRef = useRef<HTMLDivElement | null>(null);

  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConvIdRef.current = activeConv?.id ?? null;
  }, [activeConv?.id]);

  const [hiddenConvIds, setHiddenConvIds] = useState<string[]>(() => readHiddenConvs());
  const [hiddenMsgIdsByConv, setHiddenMsgIdsByConv] = useState<Record<string, string[]>>(() => readHiddenMsgs());

  function hideConversation(convId: string) {
    const next = Array.from(new Set([...hiddenConvIds, convId]));
    setHiddenConvIds(next);
    writeHiddenConvs(next);

    if (activeConv?.id === convId) {
      setActiveConv(null);
      setMessages([]);
    }
  }

  function unhideConversation(convId: string) {
    const next = hiddenConvIds.filter((x) => x !== convId);
    setHiddenConvIds(next);
    writeHiddenConvs(next);
  }

  function hideMessage(convId: string, msgId: string) {
    const map = { ...hiddenMsgIdsByConv };
    const list = map[convId] ?? [];
    map[convId] = Array.from(new Set([...list, msgId]));
    setHiddenMsgIdsByConv(map);
    writeHiddenMsgs(map);
  }

  const hiddenMsgIds = useMemo(() => {
    if (!activeConv) return new Set<string>();
    return new Set(hiddenMsgIdsByConv[activeConv.id] ?? []);
  }, [activeConv, hiddenMsgIdsByConv]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [users, setUsers] = useState<UserMini[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  function getOtherUser(conv: Conversation) {
    if (!me) return conv.userA;
    return conv.userA.id === me.sub ? conv.userB : conv.userA;
  }

  async function loadMe() {
    const res = await api.get<Me>("/auth/me");
    setMe(res.data);
  }

  async function loadConversations() {
    setLoadingConvs(true);
    try {
      const res = await api.get<Conversation[]>("/conversations");
      const visible = res.data.filter((c) => !hiddenConvIds.includes(c.id));
      setConversations(visible);
    } finally {
      setLoadingConvs(false);
    }
  }

  async function openConversation(conv: Conversation) {
    setActiveConv(conv);
    setLoadingMsgs(true);

    socketRef.current?.emit("conversation:join", { conversationId: conv.id });

    try {
      const res = await api.get<ApiPaged<Message>>(`/conversations/${conv.id}/messages`);
      setMessages(res.data.items);
      requestAnimationFrame(() => {
        const el = msgListRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function sendMessage() {
    if (!activeConv || !text.trim()) return;

    socketRef.current?.emit("message:send", {
      conversationId: activeConv.id,
      body: text.trim(),
    });

    setText("");
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setPickerError(null);
    try {
      const res = await api.get<UserMini[]>("/users");
      const list = me ? res.data.filter((u) => u.id !== me.sub) : res.data;
      setUsers(list);
    } catch (e: any) {
      setPickerError(e?.response?.data?.message ?? e?.message ?? "Falha ao carregar usuários");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function startDirect(otherUserId: string) {
    const conv = await api.post<Conversation>("/conversations/direct", { otherUserId }).then((r) => r.data);

    if (hiddenConvIds.includes(conv.id)) {
      unhideConversation(conv.id);
    }

    await loadConversations();
    setPickerOpen(false);
    await openConversation(conv);
  }

  useEffect(() => {
    if (!token) return;

    const s = createSocket(token);
    socketRef.current = s;

    s.on("message:new", (msg: Message) => {
      const currentConvId = activeConvIdRef.current;
      if (!currentConvId) return;
      if (msg.conversationId !== currentConvId) return;

      setMessages((prev) => [...prev, msg]);

      requestAnimationFrame(() => {
        const el = msgListRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
        const nearBottom = distanceFromBottom < 120;
        if (nearBottom) el.scrollTop = el.scrollHeight;
      });
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    (async () => {
      await loadMe();
      await loadConversations();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users, userSearch]);

  const primary = "var(--bhash-primary)";
  const bg = "var(--bg)";
  const fg = "var(--fg)";
  const cardBg = "var(--card-bg)";
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";
  const border = "var(--bhash-border, rgba(255,255,255,0.12))";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: bg, color: fg }}>
      <TopNav
        title="BHASH • Chat"
        subtitle={`${me?.username ?? "—"} • ${me?.role ?? "—"}`}
        theme={theme}
        onToggleTheme={toggleTheme}
        logoSrc={resolvedLogoUrl}
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

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px 1fr", minHeight: 0, padding: "12px 16px 16px" }}>
        <aside
          style={{
            minHeight: 0,
            border: `1px solid ${border}`,
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            background: theme === "dark" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.45)",
            backdropFilter: "blur(10px)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Conversas</div>

            <button
              onClick={() => setPickerOpen(true)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${border}`,
                background: primary,
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
              title="Nova conversa"
            >
              + Nova
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {loadingConvs ? (
              <div style={{ opacity: 0.8 }}>Carregando conversas…</div>
            ) : conversations.length === 0 ? (
              <div style={{ opacity: 0.8 }}>Nenhuma conversa ainda.</div>
            ) : (
              conversations.map((c) => {
                const other = getOtherUser(c);
                const active = activeConv?.id === c.id;

                return (
                  <div
                    key={c.id}
                    style={{
                      border: `1px solid ${border}`,
                      background: active ? (theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)") : cardBg,
                      borderRadius: 14,
                      padding: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <button
                      onClick={() => openConversation(c)}
                      style={{
                        flex: 1,
                        textAlign: "left",
                        border: "none",
                        background: "transparent",
                        color: fg,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{other.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>@{other.username}</div>
                    </button>

                    <button
                      onClick={() => hideConversation(c.id)}
                      style={{
                        borderRadius: 10,
                        border: `1px solid ${border}`,
                        background: "transparent",
                        color: fg,
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                      title="Remover da lista (somente visual)"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {hiddenConvIds.length > 0 && (
            <div style={{ padding: 12, borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Ocultas (somente você)</div>
              <button
                onClick={() => {
                  setHiddenConvIds([]);
                  writeHiddenConvs([]);
                  loadConversations();
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${border}`,
                  background: "transparent",
                  color: fg,
                  cursor: "pointer",
                }}
              >
                Restaurar todas
              </button>
            </div>
          )}
        </aside>

        <main style={{ minHeight: 0, display: "flex", flexDirection: "column", marginLeft: 12 }}>
          <div
            style={{
              padding: 12,
              border: `1px solid ${border}`,
              borderRadius: 18,
              background: theme === "dark" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.6)",
              backdropFilter: "blur(10px)",
            }}
          >
            {activeConv ? (
              <>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Chat com {getOtherUser(activeConv).name}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>@{getOtherUser(activeConv).username}</div>
              </>
            ) : (
              <div style={{ fontWeight: 900 }}>Selecione uma conversa</div>
            )}
          </div>

          <div
            ref={msgListRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 12,
              border: `1px solid ${border}`,
              borderRadius: 18,
              background:
                theme === "dark"
                  ? "radial-gradient(1200px 600px at 50% 0%, rgba(0,31,63,0.18), transparent 60%)"
                  : "radial-gradient(1200px 600px at 50% 0%, rgba(0,31,63,0.10), transparent 60%)",
            }}
          >
            {!activeConv ? (
              <div style={{ opacity: 0.75 }}>Abra uma conversa para ver as mensagens.</div>
            ) : loadingMsgs ? (
              <div style={{ opacity: 0.75 }}>Carregando mensagens…</div>
            ) : (
              messages
                .filter((m) => !hiddenMsgIds.has(m.id))
                .map((m) => {
                  const isMine = me?.sub === m.senderId;

                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isMine ? "flex-end" : "flex-start",
                        maxWidth: 560,
                        borderRadius: 14,
                        border: `1px solid ${border}`,
                        padding: 10,
                        background: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700 }}>
                          {m.sender.name} • {new Date(m.createdAt).toLocaleString()}
                        </div>

                        <button
                          onClick={() => activeConv && hideMessage(activeConv.id, m.id)}
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${border}`,
                            background: "transparent",
                            color: fg,
                            padding: "6px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          title="Ocultar mensagem (somente você)"
                        >
                          🗑️
                        </button>
                      </div>

                      <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{m.body}</div>
                    </div>
                  );
                })
            )}
          </div>

          <div
            style={{
              padding: 12,
              border: `1px solid ${border}`,
              borderRadius: 18,
              display: "flex",
              gap: 10,
              background: theme === "dark" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.6)",
              backdropFilter: "blur(10px)",
              marginTop: 12,
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={activeConv ? "Digite sua mensagem..." : "Selecione uma conversa..."}
              style={{
                flex: 1,
                padding: "12px 12px",
                borderRadius: 12,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: fg,
                outline: "none",
              }}
              disabled={!activeConv}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />

            <button
              onClick={sendMessage}
              disabled={!activeConv || !text.trim()}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${border}`,
                background: primary,
                color: "#fff",
                fontWeight: 900,
                cursor: !activeConv || !text.trim() ? "not-allowed" : "pointer",
                opacity: !activeConv || !text.trim() ? 0.55 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </main>
      </div>

      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              maxHeight: "min(680px, 90vh)",
              display: "flex",
              flexDirection: "column",
              borderRadius: 18,
              border: `1px solid ${border}`,
              background: cardBg,
              color: fg,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${border}` }}>
              <div style={{ fontWeight: 900 }}>Nova conversa</div>
              <button
                onClick={() => setPickerOpen(false)}
                style={{ borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: fg, padding: "8px 10px", cursor: "pointer" }}
              >
                Fechar
              </button>
            </div>

            <div style={{ padding: 12, display: "flex", gap: 10, borderBottom: `1px solid ${border}` }}>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nome ou @username"
                style={{
                  flex: 1,
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: fg,
                  outline: "none",
                }}
              />
              <button
                onClick={() => loadUsers()}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${border}`,
                  background: primary,
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                title="Recarregar usuários"
              >
                Atualizar
              </button>
            </div>

            <div style={{ padding: 12, overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingUsers ? (
                <div style={{ opacity: 0.8 }}>Carregando usuários…</div>
              ) : pickerError ? (
                <div style={{ color: "#ff8a8a" }}>{pickerError}</div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ opacity: 0.8 }}>Nenhum usuário encontrado.</div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startDirect(u.id)}
                    style={{
                      border: `1px solid ${border}`,
                      background: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
                      color: fg,
                      borderRadius: 14,
                      padding: 12,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{u.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>@{u.username}</div>
                  </button>
                ))
              )}
            </div>

            <div style={{ padding: 12, borderTop: `1px solid ${border}`, fontSize: 12, opacity: 0.8 }}>
              * Abrir conversa aqui cria (ou reutiliza) uma conversa direta.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
