# 🏢 BHASH — Mensageiro Corporativo On-Premise

O **BHASH** é um mensageiro corporativo interno, desenvolvido para rodar totalmente dentro da infraestrutura da empresa (on-premise), garantindo controle total dos dados, governança administrativa e personalização visual.

A proposta é ser o **“WhatsApp interno da empresa”**, sem dependência de serviços externos e com foco em segurança, auditoria e replicabilidade.

---

## 🏗 Arquitetura

O sistema é dividido em três aplicações:

### 🔹 Backend
- NestJS
- Prisma ORM
- PostgreSQL
- Redis (preparado para tempo real)

Responsável por:
- Autenticação de usuários (chat)
- Autenticação de administradores
- Regras de conversas e mensagens
- Persistência de dados
- Configuração visual (logo/cor)
- Estrutura preparada para auditoria

### 🔹 Frontend Chat
- React + Vite  
Usuários comuns:
- Login
- Lista de usuários disponíveis
- Conversas privadas 1:1
- Histórico persistente
- Envio de mensagens
- Tema dinâmico (cor e logo)

### 🔹 Frontend Admin
- React + Vite  
Administradores:
- Login separado
- SuperAdmin obrigatório no primeiro acesso
- Configuração de cor e logo
- Gestão de usuários

---

## ✅ O Que Já Está Pronto

### 💬 Chat
- Conversas 1:1 funcionando
- Histórico persistente
- Lista de usuários
- Controle de usuário ativo/inativo
- Estrutura multiempresa preparada

(Ajustes pendentes apenas de UX e refinamento visual)

### 🎨 Branding
- Alteração de cor primária
- Upload de logo personalizada
- Reset para padrão
- Persistência via AppConfig

### 👤 Gestão de Usuários
- Criar, editar e excluir usuários
- Resetar senha
- Forçar troca de senha no primeiro login
- Ativar/desativar usuários
- Filtros por empresa, setor e status
- Paginação

(Pequenos ajustes visuais ainda pendentes no painel)

---

## 🔎 Próxima Implementação

### 📜 Visualização Administrativa de Conversas

Administradores poderão:
- Visualizar histórico completo de qualquer usuário
- Filtrar por:
  - Empresa
  - Setor
  - Usuário
  - Período
  - Palavra-chave
- Paginação eficiente

### 🔐 Regra Importante
Usuários nunca apagam mensagens definitivamente.  
Eles apenas ocultam para si.  
O administrador sempre terá acesso ao histórico completo.

---

## 📊 Auditoria (Planejado)

O sistema terá registro completo de ações:

- Quem criou, editou ou excluiu usuários
- Quem resetou senha
- Quem enviou mensagem
- Quem removeu mensagem
- Alterações administrativas
- Data, hora e responsável por cada ação


---

## 🧠 Filosofia do Projeto

O BHASH é construído com foco em:

- On-premise (controle total do dado)
- Multiempresa
- Governança
- Auditoria estruturada
- Deploy replicável via Docker
- Separação clara entre usuário e administrador
- SuperAdmin obrigatório no primeiro acesso
- Evolução modular

---

## 📦 Evolução do Projeto

O código será analisado em duas etapas:

1. Frontend (Chat + Admin)
2. Backend + Prisma + Docker

Isso permitirá finalizar:
- Visualização administrativa de conversas
- Sistema completo de auditoria
- Ajustes finais de governança

---

## 🚀 Diferenciais

- Controle total dos dados
- Governança corporativa real
- Personalização por empresa
- Instalação simples
- Arquitetura escalável

---

**BHASH é mais que um chat.  
É uma plataforma interna de comunicação com controle, segurança e rastreabilidade.**