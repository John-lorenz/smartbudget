# SmartBudget - Sprint 2

Sistema web para controle de gastos pessoais.  
**Equipe:** Gabriel Tenfen, Lucas Francelino e João Arthur

## Acesse o projeto

**Aplicação online:** https://smartbudget-one-delta-fxsnlkg38d.vercel.app

Basta abrir o link, cadastrar uma conta e começar a usar. Funciona no navegador do celular e do computador.

## Funcionalidades

- **Cadastro de Usuário** — registro com nome, email e senha
- **Login** — autenticação JWT com persistência de sessão
- **Registrar Transação** — receitas e despesas com categorias, valor, data e descrição
- **Criar Metas** — metas financeiras com valor alvo, valor atual, prazo e barra de progresso
- **Recuperar Senha** — geração de código de recuperação e redefinição de senha
- **Gerar Relatório** — resumo por período, categorias e compartilhamento via WhatsApp
- **Indicadores na Tela Inicial** — saldo do mês, variação de gastos, maior gasto e taxa de economia
- **Monitorar Ações** — lista de ações acompanhadas com preço alvo e cotação atual
- **Monitorar Criptomoedas** — lista de criptos acompanhadas com preço alvo e cotação em reais

## Stack

| Camada   | Tecnologia                 |
|----------|----------------------------|
| Frontend | React + Vite + Tailwind CSS |
| Backend  | Node.js + Express           |
| Banco    | PostgreSQL                  |
| Auth     | JWT (jsonwebtoken + bcryptjs) |

## Pré-requisitos

- **Node.js** 18+
- **PostgreSQL** instalado e rodando
- **npm** ou **yarn**

## Setup

### 1. Banco de Dados

Crie o banco no PostgreSQL:

```sql
CREATE DATABASE smartbudget;
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edite o .env com suas credenciais do PostgreSQL
npm install
npm run migrate   # Cria as tabelas
npm run dev       # Inicia em http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev       # Inicia em http://localhost:5173
```

O frontend já possui proxy configurado para o backend (`/api` → `localhost:3001`).

## Endpoints da API

### Auth
| Método | Rota             | Descrição          | Auth |
|--------|------------------|---------------------|------|
| POST   | /api/auth/register | Cadastro de usuário | Não  |
| POST   | /api/auth/login    | Login               | Não  |
| POST   | /api/auth/forgot-password | Gerar código de recuperação | Não |
| POST   | /api/auth/reset-password  | Redefinir senha com código | Não |
| GET    | /api/auth/me       | Dados do usuário    | Sim  |

### Transações
| Método | Rota                      | Descrição               | Auth |
|--------|---------------------------|--------------------------|------|
| GET    | /api/transactions         | Listar transações        | Sim  |
| GET    | /api/transactions/summary | Resumo (receitas/despesas/saldo) | Sim  |
| GET    | /api/transactions/indicators | Indicadores mensais | Sim |
| GET    | /api/transactions/report  | Relatório por período | Sim |
| POST   | /api/transactions         | Criar transação          | Sim  |
| PUT    | /api/transactions/:id     | Editar transação         | Sim  |
| DELETE | /api/transactions/:id     | Remover transação        | Sim  |

### Metas
| Método | Rota             | Descrição      | Auth |
|--------|------------------|----------------|------|
| GET    | /api/goals       | Listar metas   | Sim  |
| POST   | /api/goals       | Criar meta     | Sim  |
| PUT    | /api/goals/:id   | Editar meta    | Sim  |
| DELETE | /api/goals/:id   | Remover meta   | Sim  |

### Ações
| Método | Rota                  | Descrição              | Auth |
|--------|-----------------------|------------------------|------|
| GET    | /api/stocks           | Listar ações monitoradas | Sim |
| POST   | /api/stocks           | Adicionar/atualizar ação | Sim |
| GET    | /api/stocks/quote/:symbol | Buscar cotação atual | Sim |
| DELETE | /api/stocks/:id       | Remover ação monitorada | Sim |

### Criptomoedas
| Método | Rota                  | Descrição              | Auth |
|--------|-----------------------|------------------------|------|
| GET    | /api/crypto           | Listar criptomoedas monitoradas | Sim |
| POST   | /api/crypto           | Adicionar/atualizar criptomoeda | Sim |
| GET    | /api/crypto/quote/:coinId | Buscar cotação atual | Sim |
| DELETE | /api/crypto/:id       | Remover criptomoeda monitorada | Sim |

## Deploy na Vercel

Há **dois projetos** na Vercel (backend + frontend). **Quem usa o sistema só precisa da URL do frontend**: a API é acessada em `/api` no mesmo domínio (proxy configurado em `frontend/vercel.json`).

### URLs de produção (exemplo deste time)

- **App (use esta no celular / navegador):** [https://smartbudget-one-delta-fxsnlkg38d.vercel.app](https://smartbudget-one-delta-fxsnlkg38d.vercel.app)
- **API (interna):** `https://backend-beryl-seven-72ce1rm5yc.vercel.app` — não precisa abrir no navegador; o app chama `/api/...` no frontend.

### Deixar o link “mais bonito” (.vercel.app mais curto)

1. Vercel → abra o projeto **frontend** → **Settings** → **General** → **Project Name**
2. Renomeie para algo como `smartbudget` ou `smartbudget-app` e salve
3. A URL de produção do projeto passa a usar esse nome (fica mais legível que `frontend-one-delta-...`)
4. Se mudar a URL do **backend** na Vercel, atualize os endereços em `frontend/vercel.json` (rewrites) e faça **Redeploy** do frontend

### 1. Backend (API)

1. [vercel.com](https://vercel.com) → **Add New Project** → Root Directory: `backend`
2. Variáveis de ambiente (produção):
   - `DATABASE_URL` — connection string completa do Neon (recomendado), **ou** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`
   - `JWT_SECRET` — chave secreta forte
3. **Deploy**

### 2. Frontend

1. Novo projeto → Root Directory: `frontend` → framework **Vite**
2. **Não** é obrigatório definir `VITE_API_URL` em produção: o padrão é `/api`, que o `vercel.json` encaminha para o backend
3. Ajuste o destino do proxy em `frontend/vercel.json` se a URL do backend mudar
4. **Deploy**

### Banco de Dados em Nuvem

- [Neon](https://neon.tech), [Supabase](https://supabase.com) ou [Railway](https://railway.app) — rode o SQL das tabelas e use `DATABASE_URL` no backend na Vercel.

## Estrutura do Projeto

```
Sprint2/
├── backend/
│   ├── src/
│   │   ├── config/         # Conexão com PostgreSQL
│   │   ├── controllers/    # Lógica de negócio
│   │   ├── middlewares/     # Auth JWT
│   │   ├── migrations/     # Criação de tabelas
│   │   ├── routes/         # Rotas da API
│   │   └── server.js       # Entry point
│   ├── api/               # Entry point Vercel Serverless
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Layout com sidebar
│   │   ├── contexts/       # AuthContext
│   │   ├── pages/          # Login, Register, Dashboard, Transactions, Goals, Reports, Stocks
│   │   ├── services/       # API client (axios)
│   │   ├── App.jsx         # Rotas
│   │   └── main.jsx        # Entry point
│   ├── vercel.json
│   └── package.json
└── README.md
```
