#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-/opt/bhash}"
RUN_USER="${2:-${SUDO_USER:-$USER}}"

if [[ $EUID -ne 0 ]]; then
  echo "Execute como root: sudo ./scripts/linux/install-systemd-service.sh \"$PROJECT_ROOT\" \"$RUN_USER\""
  exit 1
fi

if ! id "$RUN_USER" >/dev/null 2>&1; then
  echo "Usuario invalido: $RUN_USER"
  exit 1
fi

RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
PM2_CMD="$PROJECT_ROOT/node_modules/.bin/pm2"
SERVICE_FILE="/etc/systemd/system/bhash-pm2-resurrect.service"

if [[ ! -x "$PM2_CMD" ]]; then
  echo "PM2 local nao encontrado em: $PM2_CMD"
  echo "Rode antes: npm install (na raiz do projeto)"
  exit 1
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=BHash PM2 Resurrect
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=oneshot
User=$RUN_USER
Environment=PM2_HOME=$RUN_HOME/.pm2
WorkingDirectory=$PROJECT_ROOT
ExecStart=$PM2_CMD resurrect
ExecReload=$PM2_CMD reload all --update-env
ExecStop=$PM2_CMD save
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now bhash-pm2-resurrect.service

echo "Servico systemd instalado: bhash-pm2-resurrect.service"
echo "Valide com:"
echo "  systemctl status bhash-pm2-resurrect.service"
