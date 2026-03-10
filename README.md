# BHASH - Guia Completo de Implantacao

Mensageiro corporativo on-premise com:

- `backend` (NestJS + Prisma + PostgreSQL + Socket.IO)
- `frontend` (chat do usuario)
- `frontend-admin` (painel administrativo)

Este README e o guia principal de deploy e operacao.

## Estrutura do Projeto

```
bhash/
  backend/
  frontend/
  frontend-admin/
  scripts/
    linux/
    windows/
  docker-compose.yml
  ecosystem.config.cjs
```

## Portas Padrao

- Backend API/WebSocket: `3000`
- Frontend Chat (preview/producao): `5173`
- Frontend Admin (preview/producao): `5174`
- PostgreSQL: `5432`
- Redis: `6379`

## Pre-Requisitos

### Linux (recomendado para servidor)

- Node.js 20+ (preferencialmente LTS)
- npm 10+
- Docker Engine + Docker Compose Plugin
- Git

### Windows (suporte)

- Node.js 20+
- npm 10+
- Docker Desktop
- PowerShell

## Variaveis de Ambiente

Arquivo principal: `backend/.env`.

Minimo necessario:

```env
DATABASE_URL=postgresql://bhash:bhashpass@localhost:5432/bhash
JWT_SECRET=troque-por-uma-chave-forte
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,LAN
```

## Desenvolvimento Local

Subir infra:

```bash
npm run infra:up
```

Rodar tudo em modo dev:

```bash
npm run dev:all
```

## Producao Linux (servidor terminal)

### 1) Preparar servidor

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git curl
sudo systemctl enable --now docker
```

Instalar Node.js 20+ (via NodeSource, nvm ou pacote da sua distribuicao).

### 2) Clonar projeto

```bash
sudo mkdir -p /opt/bhash
sudo chown -R $USER:$USER /opt/bhash
git clone <SEU_REPO> /opt/bhash
cd /opt/bhash
```

### 3) Configurar `.env`

Edite `backend/.env` com valores do servidor.

### 4) Deploy inicial

Opcao automatica:

```bash
chmod +x scripts/linux/*.sh
./scripts/linux/first-deploy.sh /opt/bhash
```

Opcao manual equivalente:

```bash
npm run infra:up
npm run setup:server
npm run services:start
npm run services:save
```

### 5) Habilitar auto start no boot (Linux)

Instala servico `systemd` que executa `pm2 resurrect`:

```bash
sudo ./scripts/linux/install-systemd-service.sh /opt/bhash $USER
```

Validar:

```bash
systemctl status bhash-pm2-resurrect.service
```

### 6) Verificar status

```bash
./scripts/linux/status.sh /opt/bhash
```

Ou manual:

```bash
docker ps
npm run services:status
```

### 7) Atualizar versao em producao

Opcao automatica:

```bash
./scripts/linux/update.sh /opt/bhash
```

Opcao manual:

```bash
git pull --ff-only
npm run setup:server
npm run services:reload
npm run services:save
```

## Producao Windows (resumo)

```powershell
cd C:\dev\bhash
npm run infra:up
npm run setup:server
npm run services:start
npm run services:save
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-startup-task.ps1
```

Para startup da maquina (SYSTEM), usar PowerShell como administrador:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-startup-task.ps1 -ForceSystemStartup
```

## Como o Auto Start Funciona

1. PM2 guarda os processos em `dump.pm2` via `npm run services:save`.
2. No boot/logon, um gatilho do sistema executa `pm2 resurrect`.
3. PM2 restaura backend/chat/admin sem terminal aberto.
4. Docker religa Postgres/Redis por `restart: unless-stopped`.

## Comandos Operacionais Uteis

```bash
npm run infra:status
npm run infra:logs
npm run services:status
npm run services:logs
npm run services:restart
npm run services:stop
npm run services:delete
```

## Troubleshooting

### `EPERM ... esbuild.exe` (Windows)

```powershell
taskkill /F /IM node.exe
npm run services:delete
```

Depois execute novamente `npm run setup:server`.

### PM2 vazio apos reboot

- Verifique se `services:save` foi executado.
- Verifique se a tarefa/systemd de startup esta ativa.

### Backend sobe e cai

Checar logs:

```bash
npm run services:logs
```

Normalmente e `DATABASE_URL`, `JWT_SECRET` ou migracao pendente.

## READMEs por Modulo

- [Backend](backend/README.md)
- [Frontend Chat](frontend/README.md)
- [Frontend Admin](frontend-admin/README.md)

## Electron (cliente instalavel)

Roadmap: [docs/electron-rollout.md](docs/electron-rollout.md)
