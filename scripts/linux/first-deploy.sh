#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-/opt/bhash}"

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "Projeto nao encontrado em: $PROJECT_ROOT"
  exit 1
fi

cd "$PROJECT_ROOT"

echo "==> Subindo infra Docker (Postgres/Redis)..."
npm run infra:up

echo "==> Instalando dependencias, Prisma e builds..."
npm run setup:server

echo "==> Subindo servicos PM2..."
npm run services:start
npm run services:save

echo "Deploy inicial concluido."
echo "Proximo passo: habilitar startup no Linux:"
echo "  sudo ./scripts/linux/install-systemd-service.sh \"$PROJECT_ROOT\" \"$USER\""
