# 🐾 Karolla Pet

Site público + agendamento online + API + banco preparado para Supabase + painel administrativo
para a **Karolla Pet** (banho, tosa e estética animal — sem serviços veterinários).

```
CLIENTE → FRONT-END (React) → BACK-END (API REST) → BANCO (Supabase/PostgreSQL)
                                                     ↓ agendamento salvo
                                               WHATSAPP → GOOGLE SHEETS
```

> **Modo DEMO × PRODUÇÃO** — sem configuração, tudo roda em **modo demonstração**: banco em memória com
> dados **fictícios** (Thor, Mel, Luna, Nina; preços inventados), login mock e WhatsApp por link `wa.me`.
> O site e o painel mostram uma faixa avisando isso. Nada finge estar conectado: o painel → Configurações
> mostra o status real de cada integração.

## Sumário
- [Como instalar](#como-instalar) · [Como executar](#como-executar) · [Estrutura](#estrutura-do-projeto)
- [Variáveis de ambiente](#variáveis-de-ambiente) · [Supabase](#como-conectar-o-supabase) · [WhatsApp](#como-configurar-o-whatsapp)
- [Google Sheets](#como-configurar-o-google-sheets) · [Criar administrador](#como-criar-administrador)
- [Preços, serviços e formulário](#como-alterar-preços-serviços-e-formulário) · [Testes](#testes) · [Deploy](#como-fazer-deploy)

Documentação detalhada em [`docs/`](docs): [arquitetura](docs/ARQUITETURA.md), [Supabase](docs/SUPABASE.md),
[integrações](docs/INTEGRACOES.md), [guia do painel](docs/GUIA-DO-PAINEL.md), [deploy](docs/DEPLOY.md),
[testes](docs/TESTES.md), [conteúdo e fotos](docs/CONTEUDO.md).

## Como instalar

Requisitos: **Node.js 20.12+** (recomendado 22) e npm 10.

```bash
npm install
cp .env.example .env      # ajuste o que quiser; vazio = modo demo
```

## Abrir no VS Code

```bash
git clone https://github.com/eduardostefani-20/karolla-.git karolla-pet
cd karolla-pet
git checkout ccr-5b9be4cb-1qd2qm
code karolla-pet.code-workspace
```

Aceite as **extensões recomendadas**. Depois, use *Terminal → Executar tarefa → "Karolla Pet: instalar dependências"*
e em seguida **"Karolla Pet: iniciar (API + site)"** (ou `Ctrl+Shift+B`). Em *Executar e depurar* há
"API (debug)", "Site no Chrome" e "Testes da API (debug)".

## Como executar

```bash
npm run dev               # API em http://localhost:3333 + site em http://localhost:5173
```

- Site: http://localhost:5173 · Agendamento: `/agendar` · Painel: `/admin`
- Login demo: `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` do `.env`. Se a senha estiver vazia, a API gera
  uma senha temporária e a mostra no console ao iniciar (nenhuma senha fica no código).
- Os dados do modo demo **somem ao reiniciar a API**.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run build` | build de produção da API (`backend/dist`) e do site (`frontend/dist`) |
| `npm run typecheck` | checagem de tipos em todos os pacotes |
| `npm test` | testes unitários e de API (shared, backend, frontend) |
| `npm run test:e2e` | fluxo completo cliente + administradora no navegador (desktop e celular) |
| `npm run db:seed-sql -w backend` | regenera `database/seed/*.sql` a partir dos dados do modo demo |
| `./database/scripts/test-local.sh` | valida migrations, funções e RLS num PostgreSQL local |

## Estrutura do projeto

```
karolla-pet/
├── shared/              # @karolla/shared — usado pelo front E pelo back
│   └── src/
│       ├── types/       # entidades de domínio e contratos da API
│       ├── pricing/     # calculateAppointmentPrice() — motor de preços único
│       ├── scheduling/  # motor de disponibilidade (horários, intervalos, bloqueios, capacidade)
│       ├── validation/  # schemas Zod (agendamento, painel, login)
│       └── utils/       # telefone/máscara, dinheiro, datas, sanitização
├── backend/             # API REST (Express + TypeScript)
│   └── src/
│       ├── config/      # variáveis de ambiente validadas (demo × produção)
│       ├── routes/  controllers/  middleware/   # HTTP, auth, rate limit, erros
│       ├── services/    # regras de negócio (agendamento, catálogo, agenda, notificações)
│       ├── repositories/# DatabaseService: memory (demo) e supabase (produção)
│       ├── integrations/# AuthService, WhatsAppService, GoogleSheetsService
│       ├── validators/  # validação de query params
│       ├── seed/        # dados fictícios do modo demo
│       └── container.ts # onde cada implementação é escolhida
├── frontend/            # React + Vite + Tailwind + React Router + RHF + Zod
│   └── src/ components/ pages/ layouts/ hooks/ context/ services/ validations/ data/ styles/
├── database/
│   ├── migrations/      # 0001 schema · 0002 funções atômicas · 0003 RLS
│   ├── schema/          # schema consolidado (referência)
│   ├── seed/            # catálogo inicial, preços DEMO, clientes DEMO
│   └── tests/           # testes SQL de funções e RLS
└── docs/
```

## Variáveis de ambiente

Veja [`.env.example`](.env.example) (comentado). Resumo:

| Variável | Uso |
|---|---|
| `APP_MODE` | `demo` (padrão) ou `production` — produção **exige** Supabase (banco e auth) e recusa mocks |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase (somente no servidor) |
| `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `AUTH_TOKEN_SECRET` | login do modo demo |
| `WHATSAPP_NUMBER` | número inicial da Karolla Pet (depois editável no painel) |
| `WHATSAPP_PROVIDER` | `link` (padrão), `cloud_api` ou `disabled` |
| `GOOGLE_SHEETS_WEBHOOK`, `GOOGLE_SHEETS_WEBHOOK_SECRET` | planilha via Apps Script |
| `CORS_ORIGIN` | origem(ns) do site autorizadas a chamar a API |
| `VITE_API_URL` | (front) URL pública da API; vazio = mesma origem |

**Nunca** coloque chaves em variáveis `VITE_*` — tudo que começa com `VITE_` vai para o navegador.

## Como conectar o Supabase

1. Crie um projeto em supabase.com.
2. No **SQL Editor**, execute em ordem: `database/migrations/0001_schema.sql`, `0002_functions.sql`, `0003_rls.sql`, `0004_hardening.sql`.
   *(No projeto `karolla pet` isso já foi feito — veja [docs/SUPABASE.md](docs/SUPABASE.md).)*
3. Execute `database/seed/0001_catalog.sql` (catálogo inicial). Opcional: `0002_demo_prices.sql`
   (**preços fictícios**, para ter algo a editar) e `0003_demo_customers.sql` (clientes fictícios — não use em produção).
4. Em *Project Settings → API*, copie URL, `anon` e `service_role` para o `.env`:
   ```
   APP_MODE=production
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
5. Crie a administradora (abaixo) e reinicie a API. Detalhes: [docs/SUPABASE.md](docs/SUPABASE.md).

## Como configurar o WhatsApp

- O número da Karolla Pet fica em **um lugar só**: painel → Configurações (inicializado por `WHATSAPP_NUMBER`).
- `WHATSAPP_PROVIDER=link` (padrão): depois de salvar o agendamento, a API gera um link `wa.me` com a
  mensagem completa. O cliente toca em **Falar no WhatsApp** e envia. *Não há envio automático.*
- `WHATSAPP_PROVIDER=cloud_api`: envio automático pela WhatsApp Cloud API (Meta) com
  `WHATSAPP_CLOUD_TOKEN` e `WHATSAPP_CLOUD_PHONE_NUMBER_ID`. Veja [docs/INTEGRACOES.md](docs/INTEGRACOES.md).
- Falha no WhatsApp **não apaga** o agendamento; fica registrada no painel (detalhe do agendamento → Integrações).

## Como configurar o Google Sheets

1. Crie uma planilha → Extensões → Apps Script → cole [`docs/google-apps-script.gs`](docs/google-apps-script.gs).
2. Defina a propriedade de script `SECRET` e implante como **App da Web**.
3. `.env`: `GOOGLE_SHEETS_WEBHOOK=<url /exec>` e `GOOGLE_SHEETS_WEBHOOK_SECRET=<mesmo SECRET>`.

Cada agendamento é inserido (e atualizado após edições) com as colunas: ID, Data do pedido, Cliente, WhatsApp,
E-mail, Endereço, Pet, Espécie, Raça, Porte, Peso, Serviço, Adicionais, Data do agendamento, Horário, Valor,
Status, Observações. A planilha é cópia; o banco continua sendo a fonte principal.

## Como criar administrador

- **Demo:** defina `DEMO_ADMIN_EMAIL` e `DEMO_ADMIN_PASSWORD` no `.env`.
- **Supabase:** em *Authentication → Users → Add user*, crie o usuário (e-mail + senha). Depois, no SQL Editor:
  ```sql
  insert into public.admins (user_id, role)
  select id, 'owner' from public.users where email = 'carol@karollapet.com.br';
  ```
  Perfis: `owner` e `admin` (tudo) · `staff` (agenda e agendamentos, sem alterar configurações).

## Como alterar preços, serviços e formulário

Tudo pelo painel, sem código — veja o [guia do painel](docs/GUIA-DO-PAINEL.md):

- **Preços** → um valor por serviço e porte → *Salvar alterações*. Vale na hora no site.
- **Serviços** → *Novo serviço*, editar, ativar/desativar, ordenar (↑↓), excluir (só sem histórico).
- **Adicionais** → criar, editar preço/descrição, ativar/desativar, ordenar.
- **Formulário** → mostrar/ocultar e tornar obrigatórios peso, idade, observações, e-mail e endereço;
  editar rótulos; gerenciar adicionais, portes, raças e espécies.
- **Horários** → funcionamento, intervalo, dias fechados, bloqueio de datas e de horários.

## Testes

- `npm test` — 90+ testes: motor de preços, disponibilidade, validações, API (agendamento, conflitos,
  concorrência, login, rotas protegidas, CRUDs, falhas de banco/WhatsApp/Sheets), formulários do front.
- `npm run test:e2e` — Playwright: fluxo completo do cliente e da administradora em **desktop e celular**.
- `./database/scripts/test-local.sh` — migrations + funções atômicas + RLS num PostgreSQL local.

Detalhes e matriz de cobertura: [docs/TESTES.md](docs/TESTES.md).

## Como fazer deploy

Resumo (detalhes em [docs/DEPLOY.md](docs/DEPLOY.md)):

1. Supabase configurado (migrations + seed + administradora).
2. **API** (Render, Railway, Fly.io, VPS…): `npm ci && npm run build -w backend`, start `node backend/dist/server.js`,
   com as variáveis de produção.
3. **Site** (Vercel, Netlify, Cloudflare Pages…): `npm ci && npm run build -w frontend`, publicar `frontend/dist`,
   com fallback SPA para `index.html` e `/api/*` encaminhado à API (ou `VITE_API_URL` apontando para ela).
