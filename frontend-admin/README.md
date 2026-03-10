# BHASH Frontend Admin

Painel administrativo do sistema.

## Stack

- React
- TypeScript
- Vite
- Socket.IO Client

## Configuracao

Opcional em desenvolvimento: criar `.env` com:

```env
VITE_API_BASE=http://localhost:3000
```

Se nao definir, o frontend-admin tenta resolver automaticamente para `<host-atual>:3000`.

## Instalar dependencias

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

Porta padrao: `5174`.

## Build de producao

```bash
npm run build
```

## Preview local (producao)

```bash
npm run preview -- --host 0.0.0.0 --port 5174 --strictPort
```

## Integracao com deploy da raiz

No ambiente de servidor, nao rode isolado.
Use os comandos da raiz:

```bash
cd ..
npm run setup:server
npm run services:start
```
