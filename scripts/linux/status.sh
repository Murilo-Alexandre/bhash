#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-/opt/bhash}"

cd "$PROJECT_ROOT"

echo "==== Docker ===="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo "==== PM2 ===="
npm run services:status
