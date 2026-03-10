# BHASH Electron Rollout

## Objetivo
Cliente instalável no Windows com:

- inicialização automática junto com o sistema
- notificação em background (mesmo sem navegador aberto)
- atualização automática de versão

## Arquitetura recomendada

1. **Servidor**
- `backend` (NestJS) como serviço
- `frontend` e `frontend-admin` em modo build + serviço
- PostgreSQL como serviço (ou container com restart policy)

2. **Cliente**
- App Electron do chat (usuário final)
- app inicia com Windows
- socket com backend para receber eventos em tempo real
- Notification nativa do Windows + som local

## Ordem de implementação

1. Criar `desktop-electron` (main/preload/renderer bootstrap)
2. Embutir login/chat apontando para backend (`VITE_API_BASE`)
3. Implementar auto-start no Windows
4. Implementar tray + janela minimizada
5. Implementar notificações nativas com som
6. Implementar auto-update (`electron-builder` + `electron-updater`)
7. Pipeline de release (artefatos/versionamento)

## Infra de atualização

Para atualizar automaticamente os instalados, é necessário:

- versionamento de releases
- local de hospedagem dos pacotes de update (HTTP interno, GitHub Releases, S3, etc.)
- assinatura de build (ideal para reduzir alertas do Windows)
