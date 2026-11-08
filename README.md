# uWorkout

App para criar e gerenciar treinos de musculação e corrida, com geração de planos por IA (Claude).

- `server/` — API Node/Express + Prisma (PostgreSQL). Deploy no **Render**.
- `web/` — frontend React + Vite. Deploy na **Vercel**.

## Rodando localmente

Requisitos: Node 20+ e um PostgreSQL (local ou um banco gratuito no Render/Neon/Supabase).

```bash
# API
cd server
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET
npm install
npm run db:deploy           # cria as tabelas
npm run dev                 # http://localhost:3000/health

# Frontend (outro terminal)
cd web
cp .env.example .env.local  # VITE_API_URL=http://localhost:3000
npm install
npm run dev                 # http://localhost:5173
```

Ao alterar `server/prisma/schema.prisma`, gere uma nova migration com `npm run db:migrate -- --name descricao`
e faça commit da pasta `prisma/migrations`.

## Deploy

### Render (API)
- **Root Directory:** `server`
- **Build Command:** `npm ci && npx prisma migrate deploy`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`
- **Variáveis de ambiente:**
  | Variável | Obrigatória | Descrição |
  |---|---|---|
  | `DATABASE_URL` | sim | URL do Postgres (no Render, use a *Internal Database URL*) |
  | `JWT_SECRET` | sim | string longa e aleatória |
  | `CORS_ORIGINS` | sim | URL(s) do frontend, separadas por vírgula, sem `/` no final. Aceita curinga: `https://*.vercel.app` |
  | `ANTHROPIC_API_KEY` | não | sem ela, os planos são gerados pelo motor local |
  | `AI_MODEL` | não | padrão `claude-opus-5-5` |
  | `FREE_DAILY` | não | gerações com IA por usuário/dia (padrão 2) |

O `render.yaml` já descreve essa configuração (útil se o serviço for criado como *Blueprint*).

### Vercel (frontend)
- **Root Directory:** `web` (Framework: Vite)
- **Variável de ambiente:** `VITE_API_URL` = URL pública da API no Render (ex.: `https://uworkout-api.onrender.com`, sem `/` no final).
  Como o Vite embute a variável no build, **faça um novo deploy** depois de criá-la ou alterá-la.

> No plano gratuito o Render "dorme" a API após inatividade; a primeira requisição pode levar ~1 minuto.

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` · `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET / DELETE | `/me` | dados da conta e cota de IA / excluir conta |
| GET / POST | `/plans` | listar / criar plano |
| PUT / DELETE | `/plans/:id` | atualizar / excluir plano |
| POST | `/plans/generate` | gera e salva um plano a partir do questionário |
| GET | `/health` | status da API e do banco |
