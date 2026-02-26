📌 Visão Geral do Projeto

Este projeto consiste em um sistema corporativo de comunicação interna, desenvolvido com foco em:

Segurança

Controle administrativo

Organização por empresa e setor

Auditoria completa

Personalização visual (branding)

Ele é dividido em dois grandes módulos:

Chat Corporativo (usuários comuns)

Painel Administrativo (gestão e governança)

A arquitetura é separada em:

Frontend Chat

Frontend Admin

Backend (NestJS + Prisma + PostgreSQL)

Autenticação separada para usuários e administradores

Banco estruturado com Company, Department, User, AdminAccount, Conversations, Messages

✅ Funcionalidades Já Implementadas
💬 1. Módulo de Chat (Usuários)

Já está funcional:

Login de usuário

Listagem de usuários disponíveis para conversa

Envio e recebimento de mensagens

Persistência das mensagens no banco

Estrutura preparada para múltiplas empresas e setores

Identificação de usuário ativo/inativo

Obrigatoriedade de troca de senha no primeiro login (quando configurado)

Pendências de frontend (UX):

Tela de informações do usuário (estilo WhatsApp)

Melhorias visuais no layout

Organização de menus e navegação

Ajustes de experiência e refinamento visual

🎨 2. Customização Visual

Já funcional:

Alteração de cor primária do sistema

Alteração da logo via AppConfig

Persistência dessas configurações no banco

Isso permite que o sistema seja adaptado visualmente para identidade da empresa.

👤 3. Painel Administrativo

Já funcional:

Login separado para administradores

CRUD completo de usuários:

Criar usuário

Editar usuário

Ativar / desativar

Excluir

Trocar senha

Vinculação de usuário a:

Empresa

Setor

Filtros combinados:

Empresa

Setor

Status (ativo/inativo)

Busca textual

Paginação

Forçar troca de senha no próximo login

Pendências de frontend:

Opção para tornar usuário admin diretamente na tela de edição

Ajustes na listagem (ocultar campos desnecessários)

Pequenos refinamentos visuais

🔍 Próxima Grande Funcionalidade: Visualização de Conversas pelo Admin

A principal funcionalidade ainda pendente é:

📜 Histórico Administrativo de Conversas

Administradores poderão:

Visualizar conversas de qualquer usuário

Pesquisar mensagens

Filtrar por:

Empresa

Setor

Usuário

Data inicial/final

Palavra-chave

Filtrar por:

Mensagens enviadas

Mensagens recebidas

Conversas específicas entre dois usuários

Modelo de pesquisa desejado

Exemplos de filtros que deverão funcionar:

Ver todas as conversas de usuários da Permetal

Ver todas as mensagens enviadas pelo setor PCP

Ver conversas entre dois usuários específicos

Buscar por palavra-chave dentro das mensagens

Buscar mensagens dentro de um período específico

Filtrar por empresa + setor + intervalo de datas

Filtrar mensagens apagadas (soft delete)

A ideia é que o painel admin tenha uma tela dedicada de:

Histórico / Auditoria de Conversas

Com filtros combináveis e paginação eficiente.

🔐 Regras Importantes do Sistema
🔒 Exclusão de mensagens

Usuário comum:

Nunca apaga definitivamente uma mensagem

Apenas “oculta para si”

Admin:

Sempre consegue visualizar o histórico completo

Independente de exclusão do lado do usuário

Isso significa que o sistema trabalha com:

Soft delete para usuários

Histórico permanente no banco

🧾 Sistema de Auditoria (LOGS)

Um dos pilares do sistema será a auditoria completa.

O sistema deverá registrar:

👤 Auditoria de Usuários

Quem criou um usuário

Quando foi criado

Quem alterou dados

Quem alterou senha

Quem desativou

Quem excluiu

Alterações de empresa/setor

💬 Auditoria de Mensagens

Quem enviou

Para quem enviou

Quando enviou

IP (se aplicável futuramente)

Se a mensagem foi ocultada pelo usuário

Se foi removida administrativamente

Quando foi removida

Por qual admin foi removida

🔐 Auditoria Administrativa

Login de admin

Tentativas falhas

Alterações em configurações

Alterações em AppConfig (cor/logo)

Alterações estruturais (empresas/setores)

A intenção é ter uma tabela dedicada, algo como:

AuditLog:

id

action

entityType

entityId

performedByAdminId

performedByUserId

metadata (JSON)

createdAt

Isso permite rastreabilidade completa do sistema.

🏗️ Arquitetura e Estratégia de Construção

O projeto está sendo construído com foco em:

Separação clara entre User e Admin

JWT com tipo de token (user/admin)

Estrutura relacional consistente

Company e Department como entidades próprias

Preparação para sistema multiempresa

Controle fino de permissões no futuro

Evolução futura para papéis (roles) administrativos

A ideia é manter:

Backend modular (NestJS)

ORM com Prisma

Banco PostgreSQL

Frontend separado para Chat e Admin

Projeto preparado para crescer sem reestruturação drástica

📦 Organização do Projeto

Estrutura atual:

frontend-chat

frontend-admin

backend

prisma

docker-compose

.env

Próximos ajustes importantes:

Melhorar README detalhando:

Setup local

Variáveis de ambiente

Seeds

Comandos de migrate

Ajustar .gitignore:

node_modules

dist

.env

.env.local

arquivos de build

Separar documentação técnica

Documentar endpoints principais

📤 Próximos Passos na Evolução

Implementar módulo de visualização de conversas pelo admin

Implementar sistema de auditoria

Refinar UX do chat

Refinar UX do painel admin

Implementar controle de papéis administrativos (roles)

Melhorar busca textual avançada