import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useAdminAuth } from "../adminAuth";
import { createAdminSocket } from "../socket";

type Contact = {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  extension?: string | null;
  isActive?: boolean;
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

type ConversationItem = {
  id: string;
  updatedAt: string;
  otherUser: { id: string; username: string; name: string };
  lastMessage:
    | {
        id: string;
        createdAt: string;
        bodyPreview: string;
        senderId: string;
      }
    | null;
};

type Message = {
  id: string;
  createdAt: string;
  conversationId: string;
  senderId: string;
  body: string;
  sender: { id: string; username: string; name: string };
};

type PagedContacts = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: Contact[];
};

type PagedMessages = {
  ok: boolean;
  items: Message[];
  nextCursor: string | null;
};

type GlobalHit = {
  id: string;
  createdAt: string;
  bodyPreview: string;
  conversationId: string;
  sender: { id: string; username: string; name: string };
  conversation: {
    id: string;
    userA: { id: string; username: string; name: string };
    userB: { id: string; username: string; name: string };
  };
};

type ViewMode = "contacts" | "userConversations" | "conversation";

export function AdminHistoryPage() {
  const { api, token, logout } = useAdminAuth();

  const [mode, setMode] = useState<ViewMode>("contacts");

  // ====== CONTATOS ======
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsQ, setContactsQ] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsMsg, setContactsMsg] = useState<string | null>(null);

  // filtros opcionais (se quiser usar depois)
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // ====== BUSCA GLOBAL ======
  const [globalQ, setGlobalQ] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [globalHits, setGlobalHits] = useState<GlobalHit[]>([]);

  // ====== CONVERSAS DO USUÁRIO ======
  const [selectedUser, setSelectedUser] = useState<Contact | null>(null);
  const [userConvs, setUserConvs] = useState<ConversationItem[]>([]);
  const [userConvsLoading, setUserConvsLoading] = useState(false);
  const [userConvsMsg, setUserConvsMsg] = useState<string | null>(null);

  // ====== CHAT ======
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMsg, setChatMsg] = useState<string | null>(null);

  const [inChatSearch, setInChatSearch] = useState("");
  const [inChatApplied, setInChatApplied] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // ====== LOAD CONTATOS ======
  async function loadContacts() {
    setContactsLoading(true);
    setContactsMsg(null);
    try {
      const params: any = { page: 1, pageSize: 60 };

      const q = contactsQ.trim();
      if (q) params.q = q;

      if (companyId) params.companyId = companyId;
      if (departmentId) params.departmentId = departmentId;

      const res = await api.get<PagedContacts>("/admin/history/contacts", { params });
      setContacts(res.data.items ?? []);
    } catch (e: any) {
      if (e?.response?.status === 401) return logout();
      setContactsMsg(e?.response?.data?.message ?? "Falha ao carregar contatos");
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "contacts") return;
    const t = setTimeout(() => loadContacts(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactsQ, companyId, departmentId, mode]);

  useEffect(() => {
    if (mode === "contacts") loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filteredContacts = useMemo(() => {
    const q = contactsQ.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => (c.name ?? "").toLowerCase().includes(q) || (c.username ?? "").toLowerCase().includes(q));
  }, [contacts, contactsQ]);

  // ====== BUSCA GLOBAL ======
  async function runGlobalSearch() {
    const q = globalQ.trim();
    if (q.length < 2) {
      setGlobalErr("Digite pelo menos 2 caracteres.");
      setGlobalHits([]);
      return;
    }

    setGlobalLoading(true);
    setGlobalErr(null);
    try {
      const res = await api.get<{ ok: boolean; items: GlobalHit[] }>("/admin/history/search", {
        params: {
          q,
          page: 1,
          pageSize: 60,
          ...(companyId ? { companyId } : {}),
          ...(departmentId ? { departmentId } : {}),
        },
      });
      setGlobalHits(res.data.items ?? []);
    } catch (e: any) {
      if (e?.response?.status === 401) return logout();
      setGlobalErr(e?.response?.data?.message ?? "Falha na busca global");
      setGlobalHits([]);
    } finally {
      setGlobalLoading(false);
    }
  }

  // ====== LOAD CONVERSAS DO USER ======
  async function openUser(u: Contact) {
    setSelectedUser(u);
    setMode("userConversations");

    setUserConvsLoading(true);
    setUserConvsMsg(null);
    try {
      const res = await api.get<{ ok: boolean; items: ConversationItem[] }>(`/admin/history/users/${u.id}/conversations`);
      setUserConvs(res.data.items ?? []);
    } catch (e: any) {
      if (e?.response?.status === 401) return logout();
      setUserConvsMsg(e?.response?.data?.message ?? "Falha ao carregar conversas");
      setUserConvs([]);
    } finally {
      setUserConvsLoading(false);
    }
  }

  // ====== LOAD CHAT (mensagens) ======
  async function loadFirstPage(conversationId: string, appliedQ: string) {
    setChatLoading(true);
    setChatMsg(null);
    try {
      const res = await api.get<PagedMessages>(`/admin/history/conversations/${conversationId}/messages`, {
        params: { take: 60, ...(appliedQ.trim() ? { q: appliedQ.trim() } : {}) },
      });

      const items = res.data.items ?? [];
      setMessages(items);
      setNextCursor(res.data.nextCursor ?? null);
      setHasMore(!!res.data.nextCursor);

      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (e: any) {
      if (e?.response?.status === 401) return logout();
      setChatMsg(e?.response?.data?.message ?? "Falha ao carregar mensagens");
      setMessages([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setChatLoading(false);
    }
  }

  async function loadMoreTop(conversationId: string) {
    if (!hasMore || chatLoading) return;
    if (!nextCursor) return;

    const el = listRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;

    setChatLoading(true);
    try {
      const res = await api.get<PagedMessages>(`/admin/history/conversations/${conversationId}/messages`, {
        params: {
          take: 60,
          cursor: nextCursor,
          ...(inChatApplied.trim() ? { q: inChatApplied.trim() } : {}),
        },
      });

      const newItems = res.data.items ?? [];
      setMessages((prev) => [...newItems, ...prev]);

      setNextCursor(res.data.nextCursor ?? null);
      setHasMore(!!res.data.nextCursor);

      requestAnimationFrame(() => {
        const el2 = listRef.current;
        if (!el2) return;
        const newScrollHeight = el2.scrollHeight;
        el2.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
      });
    } catch (e: any) {
      if (e?.response?.status === 401) return logout();
      setHasMore(false);
    } finally {
      setChatLoading(false);
    }
  }

  async function openConversation(conv: ConversationItem) {
    setSelectedConv(conv);
    setMode("conversation");
    setInChatSearch("");
    setInChatApplied("");
    await loadFirstPage(conv.id, "");
  }

  // ====== SOCKET: realtime no chat aberto ======
  useEffect(() => {
    // só conecta quando está vendo conversa
    if (mode !== "conversation") return;
    if (!token) return;
    if (!selectedConv?.id) return;

    const s = createAdminSocket(token);
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("conversation:join", { conversationId: selectedConv.id });
    });

    s.on("message:new", (msg: Message) => {
      if (msg?.conversationId !== selectedConv.id) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;

        // se houver busca aplicada, você escolhe:
        // A) WhatsApp-like: mostra mesmo assim
        // B) "certinho": só adiciona se bater na busca
        // Vou manter WhatsApp-like (mais útil).
        return [...prev, msg];
      });

      requestAnimationFrame(() => {
        const el = listRef.current;
        if (!el) return;

        const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
        const nearBottom = distanceFromBottom < 140;
        if (nearBottom) el.scrollTop = el.scrollHeight;
      });
    });

    s.on("disconnect", () => {});

    return () => {
      try {
        s.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [mode, token, selectedConv?.id]);

  // ====== quando aplica busca dentro do chat ======
  useEffect(() => {
    if (mode !== "conversation") return;
    if (!selectedConv?.id) return;
    loadFirstPage(selectedConv.id, inChatApplied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inChatApplied]);

  // ====== UI ======
  const headerSubtitle = useMemo(() => {
    if (mode === "contacts") return "Históricos • contatos e busca global";
    if (mode === "userConversations") return selectedUser ? `Históricos • chats de ${selectedUser.name}` : "Históricos • chats do usuário";
    if (mode === "conversation") {
      const u = selectedUser?.name ?? "Usuário";
      const other = selectedConv?.otherUser?.name ?? "Contato";
      return `Históricos • ${u} ↔ ${other}`;
    }
    return "Históricos";
  }, [mode, selectedUser, selectedConv]);

  return (
    <div style={{ width: "min(1100px, 100%)", margin: "0 auto", padding: "18px 16px 56px" }}>
      <h1 style={{ margin: 0, marginBottom: 6 }}>Históricos</h1>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>{headerSubtitle}</div>

      {mode === "contacts" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <Card title="Buscar em tudo (Global)" colSpan={12}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={globalQ}
                onChange={(e) => setGlobalQ(e.target.value)}
                placeholder='Ex: "salário"'
                style={inputStyle({ flex: 1, minWidth: 260 })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runGlobalSearch();
                }}
              />

              <button
                onClick={runGlobalSearch}
                disabled={globalLoading || globalQ.trim().length < 2}
                style={primaryBtn(globalLoading || globalQ.trim().length < 2)}
              >
                {globalLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>

            {globalErr ? <div style={{ marginTop: 10, color: "#ff8a8a", fontSize: 13 }}>{globalErr}</div> : null}

            {globalHits.length > 0 ? (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {globalHits.map((h) => {
                  const a = h.conversation.userA;
                  const b = h.conversation.userB;
                  return (
                    <div
                      key={h.id}
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {a.name} ↔ {b.name} • {fmt(h.createdAt)} • por {h.sender.name}
                      </div>
                      <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{h.bodyPreview}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
                {globalLoading ? "Buscando..." : "—"}
              </div>
            )}
          </Card>

          <Card
            title="Contatos"
            colSpan={12}
            right={
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={loadContacts} style={ghostBtn(contactsLoading)}>
                  {contactsLoading ? "Atualizando..." : "Atualizar"}
                </button>
                <div style={{ color: "var(--muted)" }}>
                  {contactsLoading ? "Carregando..." : `${filteredContacts.length} contato(s)`}
                </div>
              </div>
            }
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <input
                value={contactsQ}
                onChange={(e) => setContactsQ(e.target.value)}
                placeholder="Buscar contato (nome / username)"
                style={inputStyle({ flex: 1, minWidth: 260 })}
              />
            </div>

            {contactsMsg ? <div style={{ marginBottom: 10, color: "#ff8a8a", fontSize: 13 }}>{contactsMsg}</div> : null}

            <div style={{ display: "grid", gap: 10 }}>
              {contactsLoading ? (
                <div style={{ color: "var(--muted)" }}>Carregando…</div>
              ) : filteredContacts.length === 0 ? (
                <div style={{ color: "var(--muted)" }}>Nenhum contato encontrado.</div>
              ) : (
                filteredContacts.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openUser(u)}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid var(--border)",
                      background: "var(--card-bg)",
                      boxShadow: "var(--shadow)",
                      cursor: "pointer",
                      color: "var(--fg)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>@{u.username}</div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : mode === "userConversations" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <Card
            title={`Chats de ${selectedUser?.name ?? ""}`}
            colSpan={12}
            right={
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={() => {
                    setMode("contacts");
                    setSelectedUser(null);
                    setUserConvs([]);
                  }}
                  style={ghostBtn(false)}
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => {
                    if (selectedUser) openUser(selectedUser);
                  }}
                  style={ghostBtn(userConvsLoading)}
                >
                  {userConvsLoading ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
            }
          >
            {userConvsMsg ? <div style={{ marginBottom: 10, color: "#ff8a8a", fontSize: 13 }}>{userConvsMsg}</div> : null}

            <div style={{ display: "grid", gap: 10 }}>
              {userConvsLoading ? (
                <div style={{ color: "var(--muted)" }}>Carregando…</div>
              ) : userConvs.length === 0 ? (
                <div style={{ color: "var(--muted)" }}>Nenhuma conversa encontrada.</div>
              ) : (
                userConvs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c)}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid var(--border)",
                      background: "var(--card-bg)",
                      boxShadow: "var(--shadow)",
                      cursor: "pointer",
                      color: "var(--fg)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{c.otherUser.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>@{c.otherUser.username}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmt(c.updatedAt)}</div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                      {c.lastMessage ? c.lastMessage.bodyPreview : "Sem mensagens ainda"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : (
        // mode === "conversation"
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <Card
            title={`${selectedUser?.name ?? "Usuário"} ↔ ${selectedConv?.otherUser?.name ?? "Contato"}`}
            colSpan={12}
            right={
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={() => {
                    setMode("userConversations");
                    setSelectedConv(null);
                    setMessages([]);
                    setNextCursor(null);
                    setHasMore(true);
                    setInChatApplied("");
                    setInChatSearch("");
                  }}
                  style={ghostBtn(false)}
                >
                  ← Voltar
                </button>

                <button
                  onClick={() => {
                    if (selectedConv?.id) loadFirstPage(selectedConv.id, inChatApplied);
                  }}
                  style={ghostBtn(chatLoading)}
                  title="Recarregar"
                >
                  {chatLoading ? "Carregando..." : "Atualizar"}
                </button>
              </div>
            }
          >
            {/* Busca dentro */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <input
                value={inChatSearch}
                onChange={(e) => setInChatSearch(e.target.value)}
                placeholder='Buscar dentro da conversa (ex: "sorte")'
                style={inputStyle({ flex: 1, minWidth: 260 })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setInChatApplied(inChatSearch.trim());
                }}
              />

              <button onClick={() => setInChatApplied(inChatSearch.trim())} style={primaryBtn(false)}>
                Buscar
              </button>

              {inChatApplied.trim() ? (
                <button
                  onClick={() => {
                    setInChatSearch("");
                    setInChatApplied("");
                  }}
                  style={ghostBtn(false)}
                  title="Limpar busca"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            {chatMsg ? <div style={{ marginBottom: 10, color: "#ff8a8a", fontSize: 13 }}>{chatMsg}</div> : null}

            {/* Chat */}
            <div
              ref={listRef}
              onScroll={() => {
                const el = listRef.current;
                if (!el) return;
                if (el.scrollTop < 120 && selectedConv?.id) loadMoreTop(selectedConv.id);
              }}
              style={{
                height: "min(70vh, 720px)",
                overflow: "auto",
                padding: 12,
                borderRadius: 18,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.06)",
              }}
            >
              {hasMore ? (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "6px 0 12px" }}>
                  {chatLoading ? "Carregando…" : "Role pra cima para carregar mais"}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "6px 0 12px" }}>
                  Início da conversa
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      maxWidth: 780,
                      padding: 10,
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                      background: "var(--card-bg)",
                      boxShadow: "var(--shadow)",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                      {m.sender.name} • {fmt(m.createdAt)}
                    </div>
                    <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{m.body}</div>
                  </div>
                ))}

                {messages.length === 0 && !chatLoading ? (
                  <div style={{ color: "var(--muted)" }}>Nenhuma mensagem encontrada.</div>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
              Tempo real: {token ? "ativo" : "—"} (mensagens novas aparecem automaticamente quando a conversa está aberta)
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** ===== UI helpers no estilo do seu admin ===== */
function Card({
  title,
  colSpan,
  right,
  children,
}: {
  title: string;
  colSpan: number;
  right?: React.ReactNode;
  children: any;
}) {
  return (
    <div
      style={{
        gridColumn: `span ${colSpan}`,
        padding: 16,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {right ? <div>{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-fg)",
    outline: "none",
    ...extra,
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--btn-bg)",
    color: "var(--btn-fg)",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--fg)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    opacity: disabled ? 0.7 : 1,
  };
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}
