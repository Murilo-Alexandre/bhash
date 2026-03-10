import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminAuth } from "../adminAuth";
import { useTheme } from "../theme";
import { API_BASE } from "../api";

type AppConfig = { primaryColor: string; logoUrl?: string | null };

type UploadedLogoItem = {
  name: string;
  url: string;
  size: number;
  updatedAt: string;
  isCurrent: boolean;
};

type LogosResponse = {
  ok: boolean;
  currentLogoUrl?: string | null;
  items: UploadedLogoItem[];
};

const DEFAULT_PRIMARY = "#001F3F";
const COLOR_PRESETS = ["#001F3F", "#0B4E8C", "#1D4ED8", "#0F766E", "#B45309", "#BE123C", "#5B21B6"];

export function AdminAppConfigPage() {
  const { api } = useAdminAuth();
  const { reloadAppConfig } = useTheme();

  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);

  const [logos, setLogos] = useState<UploadedLogoItem[]>([]);
  const [logosLoading, setLogosLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoActionKey, setLogoActionKey] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const logoPreview = useMemo(() => {
    if (!cfg?.logoUrl) return "/logo_bhash.png";
    return withApiBase(cfg.logoUrl);
  }, [cfg?.logoUrl]);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([refreshCfgFromApi(), loadUploadedLogos()]);
      } catch {
        setMsg("Falha ao carregar configuração do app.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshCfgFromApi() {
    const res = await api.get<AppConfig>("/app-config");
    const color = normalizeHexColor(res.data.primaryColor) ?? DEFAULT_PRIMARY;
    setCfg(res.data);
    setPrimaryColor(color);
  }

  async function loadUploadedLogos() {
    setLogosLoading(true);
    try {
      const res = await api.get<LogosResponse>("/admin/app-config/logos");
      setLogos(res.data.items ?? []);
    } catch {
      setLogos([]);
      setMsg("Falha ao carregar logos enviadas.");
    } finally {
      setLogosLoading(false);
    }
  }

  async function saveColor() {
    const normalized = normalizeHexColor(primaryColor);
    if (!normalized) {
      setMsg("Cor inválida. Use formato #RRGGBB.");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const res = await api.put<AppConfig>("/admin/app-config", { primaryColor: normalized });
      setCfg(res.data);
      setPrimaryColor(normalized);
      setMsg("Cor primária atualizada.");
      await reloadAppConfig();
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? "Falha ao salvar cor.");
    } finally {
      setSaving(false);
    }
  }

  async function resetColorDefault() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.put<AppConfig>("/admin/app-config", { primaryColor: DEFAULT_PRIMARY });
      setCfg(res.data);
      setPrimaryColor(DEFAULT_PRIMARY);
      setMsg("Cor primária restaurada para o padrão.");
      await reloadAppConfig();
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? "Falha ao restaurar cor padrão.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      await api.post("/admin/app-config/logo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await Promise.all([refreshCfgFromApi(), loadUploadedLogos()]);
      setMsg("Logo enviada com sucesso.");
      await reloadAppConfig();
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? "Falha no upload da logo.");
    } finally {
      setUploading(false);
    }
  }

  async function setLogoFromGallery(item: UploadedLogoItem) {
    if (item.isCurrent) return;

    const key = `select:${item.name}`;
    setLogoActionKey(key);
    setMsg(null);
    try {
      await api.put<AppConfig>("/admin/app-config", { logoUrl: item.url });
      await Promise.all([refreshCfgFromApi(), loadUploadedLogos()]);
      setMsg("Logo aplicada.");
      await reloadAppConfig();
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? "Falha ao aplicar logo.");
    } finally {
      setLogoActionKey(null);
    }
  }

  async function deleteUploadedLogo(item: UploadedLogoItem) {
    const ok = confirm(`Excluir a logo "${item.name}"?`);
    if (!ok) return;

    const key = `delete:${item.name}`;
    setLogoActionKey(key);
    setMsg(null);
    try {
      await api.delete(`/admin/app-config/logos/${encodeURIComponent(item.name)}`);
      await Promise.all([refreshCfgFromApi(), loadUploadedLogos()]);
      setMsg("Logo excluída.");
      await reloadAppConfig();
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? "Falha ao excluir logo.");
    } finally {
      setLogoActionKey(null);
    }
  }

  async function resetLogoDefault() {
    setUploading(true);
    setMsg(null);
    try {
      await api.put<AppConfig>("/admin/app-config", { logoUrl: null });
      await Promise.all([refreshCfgFromApi(), loadUploadedLogos()]);
      setMsg("Logo padrão restaurada.");
      await reloadAppConfig();
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? "Falha ao restaurar logo padrão.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-page">
      <h1 style={{ margin: 0, marginBottom: 12 }}>Config do App</h1>

      <div className="appcfg-grid">
        <Card title="Identidade visual" colSpan={8}>
          <div className="appcfg-currentLogoPanel">
            <div className="appcfg-currentLogoMedia">
              <img
                src={logoPreview}
                alt="Logo atual"
                className="appcfg-currentLogoImage"
                onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
              />
            </div>

            <div className="appcfg-currentLogoInfo">
              <div className="appcfg-currentLogoTitle">Logo atual</div>
              <div className="appcfg-currentLogoSub">
                {cfg?.logoUrl ? "Logo personalizada em uso" : "Logo padrão em uso"}
              </div>
              <div className="appcfg-currentLogoUrl">{cfg?.logoUrl ?? "/logo_bhash.png (padrão)"}</div>
            </div>
          </div>

          <div className="appcfg-actionsRow">
            <button
              className="appcfg-primaryBtn"
              disabled={uploading}
              onClick={() => uploadInputRef.current?.click()}
            >
              <UploadIcon />
              <span>{uploading ? "Enviando..." : "Enviar nova logo"}</span>
            </button>

            <button className="appcfg-ghostBtn" onClick={() => void resetLogoDefault()} disabled={uploading}>
              Usar logo padrão
            </button>
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadLogo(f);
              e.currentTarget.value = "";
            }}
          />

          <div className="appcfg-uploadHint">PNG/JPG/WEBP até 2MB.</div>

          <div className="appcfg-sectionTitle">Logos já enviadas</div>
          {logosLoading ? (
            <div className="appcfg-empty">Carregando logos...</div>
          ) : logos.length === 0 ? (
            <div className="appcfg-empty">Nenhuma logo personalizada enviada ainda.</div>
          ) : (
            <div className="appcfg-logoGrid">
              {logos.map((item) => {
                const selecting = logoActionKey === `select:${item.name}`;
                const deleting = logoActionKey === `delete:${item.name}`;
                return (
                  <div key={item.name} className={`appcfg-logoCard ${item.isCurrent ? "is-current" : ""}`}>
                    <div className="appcfg-logoThumb">
                      <img src={withApiBase(item.url)} alt={item.name} />
                    </div>

                    <div className="appcfg-logoDetails">
                      <div className="appcfg-logoName" title={item.name}>
                        {item.name}
                      </div>
                      <div className="appcfg-logoMeta">
                        {formatDateTime(item.updatedAt)} • {formatBytes(item.size)}
                      </div>
                    </div>

                    <div className="appcfg-logoActions">
                      <button
                        className={`appcfg-useBtn ${item.isCurrent ? "is-current" : ""}`}
                        disabled={item.isCurrent || selecting || deleting}
                        onClick={() => void setLogoFromGallery(item)}
                      >
                        {item.isCurrent ? "Em uso" : selecting ? "Aplicando..." : "Usar"}
                      </button>

                      <button
                        className="admin-actionBtn is-danger"
                        title="Excluir logo"
                        disabled={selecting || deleting}
                        onClick={() => void deleteUploadedLogo(item)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Cor primária" colSpan={4}>
          <div className="appcfg-colorPreview">
            <div className="appcfg-colorSwatch" style={{ background: primaryColor }} />
            <div className="appcfg-colorText">{primaryColor.toUpperCase()}</div>
          </div>

          <div className="appcfg-colorInputs">
            <input
              type="color"
              value={normalizeHexColor(primaryColor) ?? DEFAULT_PRIMARY}
              onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
              className="appcfg-colorPicker"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
              placeholder={DEFAULT_PRIMARY}
              className="admin-searchField__input"
            />
          </div>

          <div className="appcfg-presetRow">
            {COLOR_PRESETS.map((color) => {
              const active = (normalizeHexColor(primaryColor) ?? "").toUpperCase() === color.toUpperCase();
              return (
                <button
                  key={color}
                  className={`appcfg-presetBtn ${active ? "is-active" : ""}`}
                  title={color}
                  onClick={() => setPrimaryColor(color)}
                >
                  <span className="appcfg-presetDot" style={{ background: color }} />
                </button>
              );
            })}
          </div>

          <div className="appcfg-actionsRow">
            <button className="appcfg-primaryBtn" onClick={() => void saveColor()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar cor"}
            </button>
            <button className="appcfg-ghostBtn" onClick={() => void resetColorDefault()} disabled={saving}>
              Restaurar padrão
            </button>
          </div>
        </Card>

        {msg ? (
          <Card title="Status" colSpan={12}>
            <div style={{ color: "var(--muted)" }}>{msg}</div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Card({
  title,
  colSpan,
  children,
}: {
  title: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="admin-card"
      style={{
        gridColumn: `span ${colSpan}`,
        padding: 16,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function withApiBase(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
}

function normalizeHexColor(value?: string | null) {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(v)) return v;

  const raw = v.replace(/^#/, "");
  if (/^[0-9A-F]{6}$/.test(raw)) return `#${raw}`;

  return null;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function UploadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m7 9 5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 6l1 14h8l1-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
