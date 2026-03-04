import React from "react";
import { ThemeToggle } from "./ThemeToggle";

export function TopNav({
  title,
  subtitle,
  theme,
  onToggleTheme,
  logoSrc = "/logo_bhash.png",
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  logoSrc?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div style={{ width: "min(1100px, 100%)", margin: "0 auto", padding: "18px 16px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 18,
          border: "1px solid rgba(252, 0, 0, 0.12)",
          background: `
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--bhash-primary) 90%, black),
              color-mix(in srgb, var(--bhash-primary) 70%, black)
            )
          `,
          boxShadow: "var(--shadow)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <img
            src={logoSrc}
            alt="BHASH"
            style={{ height: 40, width: "auto", objectFit: "contain" }}
            onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
          />
          <div style={{ minWidth: 0, lineHeight: 1.15 }}>
            <div style={{ fontWeight: 900, letterSpacing: 0.2, whiteSpace: "nowrap", color: "#fff" }}>
              {title}
            </div>
            {subtitle ? (
              <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.78)", marginTop: 2, whiteSpace: "nowrap" }}>
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {rightSlot ? rightSlot : null}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </div>
  );
}
