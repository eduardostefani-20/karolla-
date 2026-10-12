-- =============================================================================
-- KAROLLA PET — 0008: Contas da equipe com perfis e permissões personalizadas + auditoria
-- Somente acréscimos (nenhum dado é apagado). Reaplicável.
-- =============================================================================

-- Perfis: owner (conta principal), admin, manager (gerente), freelance, professional (profissional).
-- 'staff' continua aceito para contas antigas.
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check
  check (role in ('owner', 'admin', 'manager', 'freelance', 'professional', 'staff'));

-- Permissões personalizadas (null = usa as do perfil). Formato: {"grants": ["agenda.view", ...], "agendaScope": "all"|"own"}
alter table public.admins add column if not exists permissions jsonb;
alter table public.admins drop constraint if exists admins_permissions_shape;
alter table public.admins add constraint admins_permissions_shape
  check (permissions is null or (jsonb_typeof(permissions) = 'object' and jsonb_typeof(permissions -> 'grants') = 'array'));

-- Profissional vinculado à conta (agenda "somente os próprios atendimentos").
alter table public.admins add column if not exists professional_id text references public.professionals (id) on delete set null;
alter table public.admins add column if not exists last_login_at timestamptz;

-- -----------------------------------------------------------------------------
-- Auditoria das ações do painel. Guarda quem, o quê (método + área), id do registro e resultado.
-- Nunca guarda o conteúdo enviado (sem senhas nem dados pessoais).
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.users (id) on delete set null,
  actor_email  text not null default '',
  action       text not null check (char_length(action) <= 160),
  entity       text not null check (char_length(entity) <= 60),
  entity_id    text check (entity_id is null or char_length(entity_id) <= 120),
  status       integer not null,
  created_at   timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon;
-- Leitura direta apenas pela conta principal; gravação só pelo servidor (service role).
drop policy if exists "audit: leitura owner" on public.audit_logs;
create policy "audit: leitura owner" on public.audit_logs for select to authenticated using (private.is_owner());

-- -----------------------------------------------------------------------------
-- Acesso DIRETO ao banco (API do Supabase com o token do usuário): somente contas com acesso total.
-- O painel usa sempre o servidor (service role), que aplica as permissões finas e oculta valores.
-- Assim um gerente/profissional não contorna as permissões consultando as tabelas diretamente.
-- -----------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = auth.uid() and a.active
      and (a.role = 'owner' or (a.role = 'admin' and a.permissions is null))
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;
