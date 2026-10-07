# Supabase

## 1. Banco
No *SQL Editor* do projeto, execute **em ordem**:

| Arquivo | Conteúdo |
|---|---|
| `database/migrations/0001_schema.sql` | tabelas, relacionamentos, índices, `updated_at` automático |
| `database/migrations/0002_functions.sql` | `create_appointment` / `update_appointment` (atômicas, com lock e capacidade), trigger que cria `public.users` ao criar usuário no Auth |
| `database/migrations/0003_rls.sql` | Row Level Security e políticas |
| `database/seed/0001_catalog.sql` | espécies, portes, ~47 raças, serviços, adicionais, horários, campos do formulário |
| `database/seed/0002_demo_prices.sql` | ⚠️ preços **fictícios** (opcional — substitua no painel) |
| `database/seed/0003_demo_customers.sql` | ⚠️ clientes/agendamentos **fictícios** (somente para testes) |

Tabelas: `users`, `admins`, `customers`, `pets`, `pet_species`, `pet_breeds`, `pet_sizes`, `services`,
`service_prices`, `addons`, `appointments`, `appointment_services`, `appointment_addons`, `business_hours`,
`blocked_dates`, `blocked_times`, `business_settings`, `form_options`, `integration_logs`.

```
customers 1─N pets 1─N appointments 1─N appointment_services N─1 services
                                    1─N appointment_addons   N─1 addons
services 1─N service_prices N─1 pet_sizes
```

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
(conflito de horário, capacidade, remarcação, RLS anônimo/usuário/admin).

## Observação honesta
As migrations, funções e políticas foram validadas em PostgreSQL 16 local. O adaptador TypeScript
(`backend/src/repositories/supabase`) segue a API do `@supabase/supabase-js` e os mesmos nomes de colunas,
mas precisa de um teste de fumaça contra um projeto Supabase real antes de ir ao ar
(subir a API com `APP_MODE=production`, fazer um agendamento pelo site e conferir no painel).
