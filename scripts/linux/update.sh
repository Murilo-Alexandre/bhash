#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-/opt/bhash}"

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "Projeto nao encontrado em: $PROJECT_ROOT"
  exit 1
fi

cd "$PROJECT_ROOT"

echo "==> Atualizando codigo (git pull)..."
git pull --ff-only

echo "==> Rebuild e reload dos servicos..."
npm run setup:server
npm run services:reload
npm run services:save

echo "Update concluido."
