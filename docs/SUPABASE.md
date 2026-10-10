# Supabase

## Projeto conectado

| Item | Valor |
|---|---|
| Projeto | `karolla pet` (ref `sffxgcsokfglsxwiaoer`, região us-east-1) |
| URL | `https://sffxgcsokfglsxwiaoer.supabase.co` |
| Migrations aplicadas | `0000_backup_rascunho_anterior`, `0001_schema`, `0002_functions`, `0003_rls`, `0004_hardening`, `0005a`–`0005e` (profissionais, inspirações, Stories, bucket de mídia) |
| Storage | bucket público `karolla-media` (fotos e vídeos de inspirações e Stories; até 50 MB; só imagem/vídeo) |
| Dados carregados | catálogo (2 espécies, 5 portes, 47 raças, 7 serviços, 7 adicionais, horários, campos) + **35 preços de demonstração** |

O rascunho anterior (15 tabelas vazias e 4 tipos enum de outra versão) foi movido para o schema
`legacy_backup` — nada foi apagado. Quando não precisar mais: `drop schema legacy_backup cascade;`

Verificado no próprio Supabase: criação atômica de agendamento, bloqueio de conflito, remarcação e cálculo
do total (dentro de uma transação desfeita), e acesso anônimo restrito ao catálogo. O Security Advisor
não aponta problemas no banco; resta apenas ativar *Leaked password protection* em
Authentication → Providers → Email (configuração do painel).

## Produção no Netlify

O site `cool-hotteok-c96ed7` roda com `APP_MODE=production`: banco e login no Supabase.
Administrador: o usuário do Supabase Auth com registro ativo em `public.admins` (perfil `owner`).
O login de demonstração foi removido.

## 1. Banco
No *SQL Editor* do projeto, execute **em ordem**:

| Arquivo | Conteúdo |
|---|---|
| `database/migrations/0001_schema.sql` | tabelas, relacionamentos, índices, `updated_at` automático |
| `database/migrations/0002_functions.sql` | `create_appointment` / `update_appointment` (atômicas, com lock e capacidade), trigger que cria `public.users` ao criar usuário no Auth |
| `database/migrations/0003_rls.sql` | Row Level Security e políticas |
| `database/migrations/0004_hardening.sql` | move `is_admin()`/`is_owner()` para o schema `private` (fora da API) |
| `database/migrations/0005_profissionais_inspiracoes_stories.sql` | tabelas `professionals`, `inspirations`, `stories`; colunas `professional_id`, `inspiration_id`, `inspiration_snapshot` em `appointments`; função `create_appointment_v2` (uma profissional atende um pet por vez); bucket `karolla-media` |
| `database/seed/0001_catalog.sql` | espécies, portes, ~47 raças, serviços, adicionais, horários, campos do formulário |
| `database/seed/0002_demo_prices.sql` | ⚠️ preços **fictícios** (opcional — substitua no painel) |
| `database/seed/0003_demo_customers.sql` | ⚠️ clientes/agendamentos **fictícios** (somente para testes) |

Tabelas: `users`, `admins`, `customers`, `pets`, `pet_species`, `pet_breeds`, `pet_sizes`, `services`,
`service_prices`, `addons`, `appointments`, `appointment_services`, `appointment_addons`, `business_hours`,
`blocked_dates`, `blocked_times`, `business_settings`, `form_options`, `integration_logs`, `professionals`,
`inspirations`, `stories`.

```
customers 1─N pets 1─N appointments 1─N appointment_services N─1 services
                                    1─N appointment_addons   N─1 addons
services 1─N service_prices N─1 pet_sizes
```

### Mídia, inspirações e Stories (migration 0005)
- **Upload**: o painel pede à API uma URL assinada (`POST /api/admin/media/upload-ticket`, só administradora) e o
  navegador envia o arquivo direto ao Storage. A chave de serviço nunca sai do servidor; visitantes não conseguem
  enviar nada (o bucket não tem política de escrita para `anon`/`authenticated`).
- **Stories**: `expires_at = created_at + 24 h`, gravado no banco. As consultas públicas e a política RLS só
  retornam `expires_at > now()`, então o Story some na hora certa mesmo sem ninguém com a página aberta.
  A função agendada `netlify/functions/stories-cleanup.mts` (a cada hora) apaga do banco e do Storage os vencidos.
- **Inspiração no agendamento**: o agendamento guarda `inspiration_id` e uma cópia (`inspiration_snapshot`:
  título, raça, URL da foto). Se a inspiração for editada ou ocultada depois, o registro continua mostrando a foto
  que o cliente escolheu. Inspiração usada em agendamento não pode ser excluída — só ocultada.
- `create_appointment` (versão antiga) continua no banco sem uso; pode ser removida depois com
  `drop function public.create_appointment(jsonb, jsonb, jsonb, integer);` (confirme a assinatura antes).

## 2. Chaves
*Project Settings → API*:

- `SUPABASE_URL` e `SUPABASE_ANON_KEY` → usadas pela API para login (Supabase Auth).
- `SUPABASE_SERVICE_ROLE_KEY` → usada **somente pela API** para ler/gravar. Nunca no front-end.

```
APP_MODE=production
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 3. Administradora
1. *Authentication → Users → Add user* (e-mail + senha; marque "auto confirm").
2. SQL:
   ```sql
   insert into public.admins (user_id, role)
   select id, 'owner' from public.users where email = 'EMAIL_DA_CAROL';
   ```
3. Para remover acesso: `update public.admins set active = false where user_id = '...';`

## 4. Testar localmente sem Supabase
`database/local/supabase_shim.sql` simula `auth.users`, `auth.uid()` e os papéis `anon/authenticated/service_role`
num PostgreSQL comum. `./database/scripts/test-local.sh` aplica tudo e roda `database/tests/*.test.sql`
(conflito de horário, capacidade, remarcação, RLS anônimo/usuário/admin, agenda por profissional e expiração de Stories).

## Observação honesta
As migrations, funções e políticas foram validadas em PostgreSQL 16 local. O adaptador TypeScript
(`backend/src/repositories/supabase`) segue a API do `@supabase/supabase-js` e os mesmos nomes de colunas,
mas precisa de um teste de fumaça contra um projeto Supabase real antes de ir ao ar
(subir a API com `APP_MODE=production`, fazer um agendamento pelo site e conferir no painel).
