-- KAROLLA PET — schema consolidado (gerado a partir de migrations/*.sql; a fonte oficial são as migrations)

-- >>> migrations/0001_schema.sql
-- =============================================================================
-- KAROLLA PET — 0001: Tabelas, relacionamentos e índices
-- Banco: Supabase (PostgreSQL 15+). Execute as migrations em ordem.
-- Valores monetários em CENTAVOS (integer). Datas locais (date) + horário (time)
-- no fuso de business_settings.timezone (padrão America/Sao_Paulo).
-- =============================================================================

create extension if not exists pgcrypto;

-- Atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Usuários e administradores (Supabase Auth: auth.users)
-- -----------------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.admins (
  user_id     uuid primary key references public.users (id) on delete cascade,
  role        text not null default 'admin' check (role in ('owner', 'admin', 'staff')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Catálogo configurável pelo painel
-- -----------------------------------------------------------------------------
create table public.pet_species (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  emoji       text not null default '',
  active      boolean not null default true,
  sort_order  integer not null default 0
);

create table public.pet_sizes (
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  description    text not null default '',
  min_weight_kg  numeric(6,2),
  max_weight_kg  numeric(6,2),
  active         boolean not null default true,
  sort_order     integer not null default 0,
  check (min_weight_kg is null or max_weight_kg is null or min_weight_kg <= max_weight_kg)
);

create table public.pet_breeds (
  id               text primary key default gen_random_uuid()::text,
  species_id       text not null references public.pet_species (id) on delete restrict,
  name             text not null,
  default_size_id  text references public.pet_sizes (id) on delete set null,
  active           boolean not null default true,
  sort_order       integer not null default 0,
  unique (species_id, name)
);

create table public.services (
  id                text primary key default gen_random_uuid()::text,
  name              text not null,
  description       text not null default '',
  category          text not null default '',
  duration_minutes  integer not null check (duration_minutes between 5 and 720),
  active            boolean not null default true,
  sort_order        integer not null default 0,
  -- espécies atendidas; vazio = todas
  species_ids       text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Preço de cada serviço por porte (motor de preços)
create table public.service_prices (
  id                text primary key default gen_random_uuid()::text,
  service_id        text not null references public.services (id) on delete cascade,
  size_id           text not null references public.pet_sizes (id) on delete cascade,
  price_cents       integer not null check (price_cents >= 0),
  -- duração específica para o porte (null = duração padrão do serviço)
  duration_minutes  integer check (duration_minutes is null or duration_minutes between 5 and 720),
  updated_at        timestamptz not null default now(),
  unique (service_id, size_id)
);

create table public.addons (
  id                text primary key default gen_random_uuid()::text,
  name              text not null,
  description       text not null default '',
  price_cents       integer not null check (price_cents >= 0),
  duration_minutes  integer not null default 0 check (duration_minutes between 0 and 240),
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Campos configuráveis do formulário de agendamento (Editor do Formulário)
create table public.form_options (
  key         text primary key check (key in ('pet.weight', 'pet.age', 'pet.notes', 'tutor.email', 'tutor.address', 'tutor.notes')),
  label       text not null,
  help_text   text not null default '',
  enabled     boolean not null default true,
  required    boolean not null default false,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now(),
  check (enabled or not required)
);

-- -----------------------------------------------------------------------------
-- Clientes, pets e agendamentos
-- -----------------------------------------------------------------------------
create table public.customers (
  id                    uuid primary key default gen_random_uuid(),
  -- vínculo opcional para futura área do cliente (login de tutores)
  user_id               uuid references public.users (id) on delete set null,
  name                  text not null,
  whatsapp              text not null unique check (whatsapp ~ '^\d{10,13}$'),
  email                 text not null default '',
  address_street        text not null default '',
  address_number        text not null default '',
  address_complement    text not null default '',
  address_neighborhood  text not null default '',
  address_city          text not null default '',
  notes                 text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.pets (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  name         text not null,
  species_id   text not null references public.pet_species (id) on delete restrict,
  breed_id     text references public.pet_breeds (id) on delete set null,
  breed_name   text not null default '',
  size_id      text not null references public.pet_sizes (id) on delete restrict,
  weight_kg    numeric(6,2) check (weight_kg is null or weight_kg > 0),
  age_months   integer check (age_months is null or age_months between 0 and 360),
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete restrict,
  pet_id            uuid not null references public.pets (id) on delete restrict,
  size_id           text not null references public.pet_sizes (id) on delete restrict,
  date              date not null,
  start_time        time not null,
  duration_minutes  integer not null check (duration_minutes > 0),
  total_price       numeric(10,2) generated always as (total_cents / 100.0) stored,
  total_cents       integer not null check (total_cents >= 0),
  status            text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes             text not null default '',
  customer_notes    text not null default '',
  source            text not null default 'online' check (source in ('online', 'admin')),
  -- preparado para múltiplos profissionais (futuro)
  staff_user_id     uuid references public.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Itens "fotografados" no momento do agendamento (histórico não muda com novos preços)
create table public.appointment_services (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references public.appointments (id) on delete cascade,
  service_id        text not null references public.services (id) on delete restrict,
  name              text not null,
  price_cents       integer not null check (price_cents >= 0),
  duration_minutes  integer not null check (duration_minutes >= 0),
  position          integer not null default 0
);

create table public.appointment_addons (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references public.appointments (id) on delete cascade,
  addon_id          text not null references public.addons (id) on delete restrict,
  name              text not null,
  price_cents       integer not null check (price_cents >= 0),
  duration_minutes  integer not null check (duration_minutes >= 0),
  position          integer not null default 0
);

-- -----------------------------------------------------------------------------
-- Agenda: funcionamento e bloqueios
-- -----------------------------------------------------------------------------
create table public.business_hours (
  id           text primary key default gen_random_uuid()::text,
  weekday      smallint not null unique check (weekday between 0 and 6), -- 0 = domingo
  is_open      boolean not null default true,
  open_time    time not null default '08:00',
  close_time   time not null default '18:00',
  break_start  time,
  break_end    time,
  check (open_time < close_time),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_start < break_end and break_start >= open_time and break_end <= close_time))
);

create table public.blocked_dates (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

create table public.blocked_times (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  reason      text not null default '',
  created_at  timestamptz not null default now(),
  check (start_time < end_time)
);

-- Configurações gerais (linha única, id = 1)
create table public.business_settings (
  id                     smallint primary key default 1 check (id = 1),
  business_name          text not null default 'Karolla Pet',
  -- Número da Karolla Pet para WhatsApp (com DDI). Fonte única do número.
  whatsapp_number        text not null default '',
  contact_email          text not null default '',
  address_line           text not null default '',
  city                   text not null default '',
  instagram              text not null default '',
  timezone               text not null default 'America/Sao_Paulo',
  slot_interval_minutes  integer not null default 30 check (slot_interval_minutes between 5 and 240),
  capacity               integer not null default 1 check (capacity between 1 and 50),
  min_advance_minutes    integer not null default 120 check (min_advance_minutes >= 0),
  max_advance_days       integer not null default 60 check (max_advance_days between 1 and 365),
  booking_notice         text not null default '',
  updated_at             timestamptz not null default now()
);

-- Registro de integrações (WhatsApp / Google Sheets) por agendamento
create table public.integration_logs (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  integration     text not null check (integration in ('whatsapp', 'google_sheets')),
  status          text not null check (status in ('success', 'failed', 'skipped', 'link_generated')),
  detail          text not null default '',
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
create index appointments_date_time_idx      on public.appointments (date, start_time);
create index appointments_status_date_idx    on public.appointments (status, date);
create index appointments_customer_idx       on public.appointments (customer_id);
create index appointments_pet_idx            on public.appointments (pet_id);
create index appointment_services_appt_idx   on public.appointment_services (appointment_id);
create index appointment_services_svc_idx    on public.appointment_services (service_id);
create index appointment_addons_appt_idx     on public.appointment_addons (appointment_id);
create index appointment_addons_addon_idx    on public.appointment_addons (addon_id);
create index pets_customer_idx               on public.pets (customer_id);
create index pet_breeds_species_idx          on public.pet_breeds (species_id, sort_order);
create index blocked_times_date_idx          on public.blocked_times (date);
create index integration_logs_appt_idx       on public.integration_logs (appointment_id, created_at);
create index customers_name_idx              on public.customers (lower(name));

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
create trigger users_updated_at            before update on public.users            for each row execute function public.set_updated_at();
create trigger admins_updated_at           before update on public.admins           for each row execute function public.set_updated_at();
create trigger services_updated_at         before update on public.services         for each row execute function public.set_updated_at();
create trigger service_prices_updated_at   before update on public.service_prices   for each row execute function public.set_updated_at();
create trigger addons_updated_at           before update on public.addons           for each row execute function public.set_updated_at();
create trigger form_options_updated_at     before update on public.form_options     for each row execute function public.set_updated_at();
create trigger customers_updated_at        before update on public.customers        for each row execute function public.set_updated_at();
create trigger pets_updated_at             before update on public.pets             for each row execute function public.set_updated_at();
create trigger appointments_updated_at     before update on public.appointments     for each row execute function public.set_updated_at();
create trigger business_settings_updated_at before update on public.business_settings for each row execute function public.set_updated_at();

insert into public.business_settings (id) values (1) on conflict do nothing;

-- >>> migrations/0002_functions.sql
-- =============================================================================
-- KAROLLA PET — 0002: Funções de negócio (gravação atômica de agendamentos)
-- Chamadas pelo back-end com a service role (supabase.rpc). Nunca expostas ao público.
-- =============================================================================

-- Minutos desde 00:00
create or replace function public.time_to_minutes(t time)
returns integer
language sql
immutable
set search_path = ''
as $$ select (extract(hour from t) * 60 + extract(minute from t))::integer $$;

-- Garante que [p_start, p_start + p_duration) não ultrapasse p_capacity atendimentos simultâneos.
-- Usa lock transacional por data: duas gravações no mesmo dia são serializadas,
-- eliminando a condição de corrida "dois clientes no mesmo horário".
create or replace function public.assert_slot_capacity(
  p_date date,
  p_start time,
  p_duration integer,
  p_capacity integer,
  p_exclude uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_start integer := public.time_to_minutes(p_start);
  v_end   integer := v_start + p_duration;
  v_point integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('karolla:appointments:' || p_date::text));

  for v_point in
    select v_start
    union
    select public.time_to_minutes(a.start_time)
      from public.appointments a
     where a.date = p_date
       and a.status not in ('cancelled', 'no_show')
       and (p_exclude is null or a.id <> p_exclude)
       and public.time_to_minutes(a.start_time) > v_start
       and public.time_to_minutes(a.start_time) < v_end
  loop
    select count(*) into v_count
      from public.appointments a
     where a.date = p_date
       and a.status not in ('cancelled', 'no_show')
       and (p_exclude is null or a.id <> p_exclude)
       and public.time_to_minutes(a.start_time) <= v_point
       and public.time_to_minutes(a.start_time) + a.duration_minutes > v_point;

    if v_count >= greatest(p_capacity, 1) then
      raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

-- Cria agendamento + itens em uma única transação, com checagem de capacidade.
create or replace function public.create_appointment(
  p_appointment jsonb,
  p_services jsonb,
  p_addons jsonb,
  p_capacity integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text := coalesce(p_appointment ->> 'status', 'pending');
begin
  if jsonb_array_length(coalesce(p_services, '[]'::jsonb)) = 0 then
    raise exception 'NO_SERVICE' using errcode = 'P0001';
  end if;

  if v_status not in ('cancelled', 'no_show') then
    perform public.assert_slot_capacity(
      (p_appointment ->> 'date')::date,
      (p_appointment ->> 'start_time')::time,
      (p_appointment ->> 'duration_minutes')::integer,
      p_capacity
    );
  end if;

  insert into public.appointments (
    customer_id, pet_id, size_id, date, start_time, duration_minutes,
    total_cents, status, notes, customer_notes, source
  ) values (
    (p_appointment ->> 'customer_id')::uuid,
    (p_appointment ->> 'pet_id')::uuid,
    p_appointment ->> 'size_id',
    (p_appointment ->> 'date')::date,
    (p_appointment ->> 'start_time')::time,
    (p_appointment ->> 'duration_minutes')::integer,
    (p_appointment ->> 'total_cents')::integer,
    v_status,
    coalesce(p_appointment ->> 'notes', ''),
    coalesce(p_appointment ->> 'customer_notes', ''),
    coalesce(p_appointment ->> 'source', 'online')
  )
  returning id into v_id;

  insert into public.appointment_services (appointment_id, service_id, name, price_cents, duration_minutes, position)
  select v_id, x.service_id, x.name, x.price_cents, x.duration_minutes, x.position
    from jsonb_to_recordset(p_services) as x(service_id text, name text, price_cents integer, duration_minutes integer, position integer);

  insert into public.appointment_addons (appointment_id, addon_id, name, price_cents, duration_minutes, position)
  select v_id, x.addon_id, x.name, x.price_cents, x.duration_minutes, x.position
    from jsonb_to_recordset(coalesce(p_addons, '[]'::jsonb)) as x(addon_id text, name text, price_cents integer, duration_minutes integer, position integer);

  return v_id;
end;
$$;

-- Atualiza agendamento (e opcionalmente substitui itens). p_capacity null = sem revalidar agenda.
create or replace function public.update_appointment(
  p_id uuid,
  p_patch jsonb,
  p_services jsonb default null,
  p_addons jsonb default null,
  p_capacity integer default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r public.appointments%rowtype;
  v_date date;
begin
  select * into r from public.appointments where id = p_id for update;
  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_date := coalesce((p_patch ->> 'date')::date, r.date);
  if p_capacity is not null then
    perform pg_advisory_xact_lock(hashtext('karolla:appointments:' || v_date::text));
  end if;

  update public.appointments set
    size_id          = coalesce(p_patch ->> 'size_id', size_id),
    date             = v_date,
    start_time       = coalesce((p_patch ->> 'start_time')::time, start_time),
    duration_minutes = coalesce((p_patch ->> 'duration_minutes')::integer, duration_minutes),
    total_cents      = coalesce((p_patch ->> 'total_cents')::integer, total_cents),
    status           = coalesce(p_patch ->> 'status', status),
    notes            = coalesce(p_patch ->> 'notes', notes),
    customer_notes   = coalesce(p_patch ->> 'customer_notes', customer_notes)
  where id = p_id
  returning * into r;

  if p_capacity is not null and r.status not in ('cancelled', 'no_show') then
    perform public.assert_slot_capacity(r.date, r.start_time, r.duration_minutes, p_capacity, p_id);
  end if;

  if p_services is not null then
    delete from public.appointment_services where appointment_id = p_id;
    insert into public.appointment_services (appointment_id, service_id, name, price_cents, duration_minutes, position)
    select p_id, x.service_id, x.name, x.price_cents, x.duration_minutes, x.position
      from jsonb_to_recordset(p_services) as x(service_id text, name text, price_cents integer, duration_minutes integer, position integer);
  end if;

  if p_addons is not null then
    delete from public.appointment_addons where appointment_id = p_id;
    insert into public.appointment_addons (appointment_id, addon_id, name, price_cents, duration_minutes, position)
    select p_id, x.addon_id, x.name, x.price_cents, x.duration_minutes, x.position
      from jsonb_to_recordset(p_addons) as x(addon_id text, name text, price_cents integer, duration_minutes integer, position integer);
  end if;
end;
$$;

-- Somente o back-end (service_role) pode executar as funções de gravação.
revoke all on function public.assert_slot_capacity(date, time, integer, integer, uuid) from public;
revoke all on function public.create_appointment(jsonb, jsonb, jsonb, integer) from public;
revoke all on function public.update_appointment(uuid, jsonb, jsonb, jsonb, integer) from public;
-- No Supabase, anon/authenticated recebem EXECUTE por padrão: revogar explicitamente.
revoke all on function public.assert_slot_capacity(date, time, integer, integer, uuid) from anon, authenticated;
revoke all on function public.create_appointment(jsonb, jsonb, jsonb, integer) from anon, authenticated;
revoke all on function public.update_appointment(uuid, jsonb, jsonb, jsonb, integer) from anon, authenticated;
grant execute on function public.assert_slot_capacity(date, time, integer, integer, uuid) to service_role;
grant execute on function public.create_appointment(jsonb, jsonb, jsonb, integer) to service_role;
grant execute on function public.update_appointment(uuid, jsonb, jsonb, jsonb, integer) to service_role;

-- Cria o perfil público quando um usuário é criado no Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- >>> migrations/0003_rls.sql
-- =============================================================================
-- KAROLLA PET — 0003: Row Level Security
--
-- Modelo de acesso:
--  • Back-end (service_role): acesso total — aplica autenticação/regras na API.
--  • Público (anon): somente LEITURA do catálogo ativo. Nunca grava diretamente.
--  • Administradores (authenticated + registro ativo em public.admins): gestão.
--  • Dados pessoais (clientes, pets, agendamentos) NUNCA são legíveis por anon.
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.active);
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.active and a.role = 'owner');
$$;

alter table public.users                enable row level security;
alter table public.admins               enable row level security;
alter table public.pet_species          enable row level security;
alter table public.pet_sizes            enable row level security;
alter table public.pet_breeds           enable row level security;
alter table public.services             enable row level security;
alter table public.service_prices       enable row level security;
alter table public.addons               enable row level security;
alter table public.form_options         enable row level security;
alter table public.customers            enable row level security;
alter table public.pets                 enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_services enable row level security;
alter table public.appointment_addons   enable row level security;
alter table public.business_hours       enable row level security;
alter table public.blocked_dates        enable row level security;
alter table public.blocked_times        enable row level security;
alter table public.business_settings    enable row level security;
alter table public.integration_logs     enable row level security;

-- Catálogo público (somente ativos) -------------------------------------------
create policy "catalogo publico: especies"  on public.pet_species  for select to anon, authenticated using (active);
create policy "catalogo publico: portes"    on public.pet_sizes    for select to anon, authenticated using (active);
create policy "catalogo publico: racas"     on public.pet_breeds   for select to anon, authenticated using (active);
create policy "catalogo publico: servicos"  on public.services     for select to anon, authenticated using (active);
create policy "catalogo publico: adicionais" on public.addons      for select to anon, authenticated using (active);
create policy "catalogo publico: precos"    on public.service_prices for select to anon, authenticated using (
  exists (select 1 from public.services s where s.id = service_id and s.active)
  and exists (select 1 from public.pet_sizes z where z.id = size_id and z.active)
);
create policy "catalogo publico: formulario"   on public.form_options      for select to anon, authenticated using (true);
create policy "catalogo publico: funcionamento" on public.business_hours   for select to anon, authenticated using (true);
create policy "catalogo publico: configuracoes" on public.business_settings for select to anon, authenticated using (true);

-- Administradores: gestão completa ---------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'pet_species', 'pet_sizes', 'pet_breeds', 'services', 'service_prices', 'addons', 'form_options',
    'customers', 'pets', 'appointments', 'appointment_services', 'appointment_addons',
    'business_hours', 'blocked_dates', 'blocked_times', 'business_settings'
  ]
  loop
    execute format('create policy "admin: gestao" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

create policy "admin: leitura de logs" on public.integration_logs for select to authenticated using (public.is_admin());

-- Usuários e perfis ---------------------------------------------------------------
create policy "usuario: proprio perfil" on public.users for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "usuario: atualiza proprio perfil" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins: leitura" on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins: somente owner altera" on public.admins for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- >>> migrations/0004_hardening.sql
-- =============================================================================
-- KAROLLA PET — 0004: Endurecimento de segurança (recomendações do Supabase Advisor)
-- is_admin()/is_owner() são SECURITY DEFINER e só existem para as políticas RLS:
-- ficam num schema não exposto pela API (private) e sem acesso para anon.
-- As políticas continuam funcionando (referenciam a função pelo OID).
-- =============================================================================
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.is_owner() set schema private;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_owner() to authenticated, service_role;

-- >>> migrations/0005_profissionais_inspiracoes_stories.sql
-- =============================================================================
-- KAROLLA PET — 0005: Agenda por profissional, inspirações de tosa e Stories (24h)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profissionais (cada um atende 1 pet por vez)
-- -----------------------------------------------------------------------------
create table public.professionals (
  id           text primary key default gen_random_uuid()::text,
  name         text not null,
  service_ids  text[] not null default '{}',          -- vazio = faz todos os serviços
  color        text not null default '#279790' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger professionals_updated_at before update on public.professionals for each row execute function public.set_updated_at();

alter table public.appointments
  add column professional_id text references public.professionals (id) on delete restrict;
create index appointments_professional_date_idx on public.appointments (professional_id, date);

-- -----------------------------------------------------------------------------
-- Inspirações de tosa (catálogo estilo Instagram)
-- -----------------------------------------------------------------------------
create table public.inspirations (
  id            text primary key default gen_random_uuid()::text,
  title         text not null,
  description   text not null default '',
  species_id    text not null references public.pet_species (id) on delete restrict,
  breed_id      text references public.pet_breeds (id) on delete set null,
  breed_name    text not null default '',
  image_url     text not null check (image_url ~ '^(https://|/)'),
  storage_path  text not null default '',
  service_id    text references public.services (id) on delete set null,
  active        boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger inspirations_updated_at before update on public.inspirations for each row execute function public.set_updated_at();
create index inspirations_species_breed_idx on public.inspirations (species_id, breed_name);

-- Referência da foto escolhida, "fotografada" no agendamento (continua mesmo se a inspiração mudar)
alter table public.appointments
  add column inspiration_id text references public.inspirations (id) on delete set null,
  add column inspiration_snapshot jsonb;
create index appointments_inspiration_idx on public.appointments (inspiration_id);

-- -----------------------------------------------------------------------------
-- Stories: expiram 24h após a publicação (expires_at gravado no banco)
-- -----------------------------------------------------------------------------
create table public.stories (
  id            uuid primary key default gen_random_uuid(),
  media_type    text not null check (media_type in ('image', 'video')),
  media_url     text not null check (media_url ~ '^(https://|/)'),
  storage_path  text not null default '',
  caption       text not null default '',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  check (expires_at > created_at)
);
create index stories_expires_idx on public.stories (expires_at);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.professionals enable row level security;
alter table public.inspirations  enable row level security;
alter table public.stories       enable row level security;

create policy "catalogo publico: profissionais" on public.professionals for select to anon, authenticated using (active);
create policy "catalogo publico: inspiracoes"   on public.inspirations  for select to anon, authenticated using (active);
-- a expiração vale até para quem lê direto pela API do Supabase
create policy "publico: stories validos"        on public.stories       for select to anon, authenticated using (expires_at > now());

create policy "admin: gestao" on public.professionals for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin: gestao" on public.inspirations  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin: gestao" on public.stories       for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- -----------------------------------------------------------------------------
-- Armazenamento de mídia (Supabase Storage). Leitura pública; envio só por URL assinada
-- gerada pelo back-end (service role) — visitantes não conseguem enviar arquivos.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('karolla-media', 'karolla-media', true, 52428800,
            array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
    on conflict (id) do nothing;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Funções atômicas: agora também garantem que o profissional não tenha dois pets ao mesmo tempo
-- -----------------------------------------------------------------------------
create or replace function public.assert_professional_free(
  p_date date,
  p_start time,
  p_duration integer,
  p_professional_id text,
  p_exclude uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_start integer := public.time_to_minutes(p_start);
  v_end   integer := v_start + p_duration;
begin
  perform pg_advisory_xact_lock(hashtext('karolla:appointments:' || p_date::text));
  if exists (
    select 1 from public.appointments a
     where a.date = p_date
       and a.professional_id = p_professional_id
       and a.status not in ('cancelled', 'no_show')
       and (p_exclude is null or a.id <> p_exclude)
       and public.time_to_minutes(a.start_time) < v_end
       and public.time_to_minutes(a.start_time) + a.duration_minutes > v_start
  ) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
end;
$$;

-- Versão nova com profissional e inspiração. Nome novo (_v2) para não precisar remover a função
-- antiga (comando destrutivo) enquanto a versão anterior do site ainda está no ar.
create or replace function public.create_appointment_v2(
  p_appointment jsonb,
  p_services jsonb,
  p_addons jsonb,
  p_capacity integer,
  p_professional_id text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text := coalesce(p_appointment ->> 'status', 'pending');
  v_professional text := coalesce(p_professional_id, p_appointment ->> 'professional_id');
begin
  if jsonb_array_length(coalesce(p_services, '[]'::jsonb)) = 0 then
    raise exception 'NO_SERVICE' using errcode = 'P0001';
  end if;

  if v_status not in ('cancelled', 'no_show') then
    perform public.assert_slot_capacity(
      (p_appointment ->> 'date')::date,
      (p_appointment ->> 'start_time')::time,
      (p_appointment ->> 'duration_minutes')::integer,
      p_capacity
    );
    if v_professional is not null then
      perform public.assert_professional_free(
        (p_appointment ->> 'date')::date,
        (p_appointment ->> 'start_time')::time,
        (p_appointment ->> 'duration_minutes')::integer,
        v_professional
      );
    end if;
  end if;

  insert into public.appointments (
    customer_id, pet_id, size_id, date, start_time, duration_minutes,
    total_cents, status, notes, customer_notes, source,
    professional_id, inspiration_id, inspiration_snapshot
  ) values (
    (p_appointment ->> 'customer_id')::uuid,
    (p_appointment ->> 'pet_id')::uuid,
    p_appointment ->> 'size_id',
    (p_appointment ->> 'date')::date,
    (p_appointment ->> 'start_time')::time,
    (p_appointment ->> 'duration_minutes')::integer,
    (p_appointment ->> 'total_cents')::integer,
    v_status,
    coalesce(p_appointment ->> 'notes', ''),
    coalesce(p_appointment ->> 'customer_notes', ''),
    coalesce(p_appointment ->> 'source', 'online'),
    v_professional,
    p_appointment ->> 'inspiration_id',
    case when jsonb_typeof(p_appointment -> 'inspiration_snapshot') = 'object' then p_appointment -> 'inspiration_snapshot' end
  )
  returning id into v_id;

  insert into public.appointment_services (appointment_id, service_id, name, price_cents, duration_minutes, position)
  select v_id, x.service_id, x.name, x.price_cents, x.duration_minutes, x.position
    from jsonb_to_recordset(p_services) as x(service_id text, name text, price_cents integer, duration_minutes integer, position integer);

  insert into public.appointment_addons (appointment_id, addon_id, name, price_cents, duration_minutes, position)
  select v_id, x.addon_id, x.name, x.price_cents, x.duration_minutes, x.position
    from jsonb_to_recordset(coalesce(p_addons, '[]'::jsonb)) as x(addon_id text, name text, price_cents integer, duration_minutes integer, position integer);

  return v_id;
end;
$$;

create or replace function public.update_appointment(
  p_id uuid,
  p_patch jsonb,
  p_services jsonb default null,
  p_addons jsonb default null,
  p_capacity integer default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r public.appointments%rowtype;
  v_date date;
begin
  select * into r from public.appointments where id = p_id for update;
  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_date := coalesce((p_patch ->> 'date')::date, r.date);
  if p_capacity is not null then
    perform pg_advisory_xact_lock(hashtext('karolla:appointments:' || v_date::text));
  end if;

  update public.appointments set
    size_id          = coalesce(p_patch ->> 'size_id', size_id),
    date             = v_date,
    start_time       = coalesce((p_patch ->> 'start_time')::time, start_time),
    duration_minutes = coalesce((p_patch ->> 'duration_minutes')::integer, duration_minutes),
    total_cents      = coalesce((p_patch ->> 'total_cents')::integer, total_cents),
    status           = coalesce(p_patch ->> 'status', status),
    notes            = coalesce(p_patch ->> 'notes', notes),
    customer_notes   = coalesce(p_patch ->> 'customer_notes', customer_notes),
    -- a chave presente com null remove o profissional; ausente mantém
    professional_id  = case when p_patch ? 'professional_id' then p_patch ->> 'professional_id' else professional_id end
  where id = p_id
  returning * into r;

  if p_capacity is not null and r.status not in ('cancelled', 'no_show') then
    perform public.assert_slot_capacity(r.date, r.start_time, r.duration_minutes, p_capacity, p_id);
    if r.professional_id is not null then
      perform public.assert_professional_free(r.date, r.start_time, r.duration_minutes, r.professional_id, p_id);
    end if;
  end if;

  if p_services is not null then
    delete from public.appointment_services where appointment_id = p_id;
    insert into public.appointment_services (appointment_id, service_id, name, price_cents, duration_minutes, position)
    select p_id, x.service_id, x.name, x.price_cents, x.duration_minutes, x.position
      from jsonb_to_recordset(p_services) as x(service_id text, name text, price_cents integer, duration_minutes integer, position integer);
  end if;

  if p_addons is not null then
    delete from public.appointment_addons where appointment_id = p_id;
    insert into public.appointment_addons (appointment_id, addon_id, name, price_cents, duration_minutes, position)
    select p_id, x.addon_id, x.name, x.price_cents, x.duration_minutes, x.position
      from jsonb_to_recordset(p_addons) as x(addon_id text, name text, price_cents integer, duration_minutes integer, position integer);
  end if;
end;
$$;

revoke all on function public.assert_professional_free(date, time, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.create_appointment_v2(jsonb, jsonb, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.update_appointment(uuid, jsonb, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.assert_professional_free(date, time, integer, text, uuid) to service_role;
grant execute on function public.create_appointment_v2(jsonb, jsonb, jsonb, integer, text) to service_role;
grant execute on function public.update_appointment(uuid, jsonb, jsonb, jsonb, integer) to service_role;

-- >>> migrations/0006_anuncios_origem.sql
-- =============================================================================
-- Karolla Pet — 0006: anúncios (tráfego pago) e origem dos agendamentos
--  • business_settings: IDs públicos dos pixels (Meta, Google Ads, TikTok), editáveis no painel
--  • appointments.attribution: de onde o cliente veio (UTM, clique em anúncio, site de origem)
--  • create_appointment_v2 passa a gravar a origem (mesma assinatura; nada é removido)
-- =============================================================================

alter table public.business_settings
  add column if not exists meta_pixel_id             text not null default '',
  add column if not exists google_ads_id             text not null default '',
  add column if not exists google_ads_booking_label  text not null default '',
  add column if not exists google_ads_whatsapp_label text not null default '',
  add column if not exists tiktok_pixel_id           text not null default '';

alter table public.appointments
  add column if not exists attribution jsonb;

comment on column public.appointments.attribution is
  'Origem do cliente: utmSource, utmMedium, utmCampaign, utmContent, utmTerm, gclid, fbclid, ttclid, referrer (domínio), landingPage, capturedAt.';

-- Relatório "origem dos agendamentos" no painel filtra por data de criação.
create index if not exists appointments_created_at_idx on public.appointments (created_at);

create or replace function public.create_appointment_v2(
  p_appointment jsonb,
  p_services jsonb,
  p_addons jsonb,
  p_capacity integer,
  p_professional_id text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text := coalesce(p_appointment ->> 'status', 'pending');
  v_professional text := coalesce(p_professional_id, p_appointment ->> 'professional_id');
begin
  if jsonb_array_length(coalesce(p_services, '[]'::jsonb)) = 0 then
    raise exception 'NO_SERVICE' using errcode = 'P0001';
  end if;

  if v_status not in ('cancelled', 'no_show') then
    perform public.assert_slot_capacity(
      (p_appointment ->> 'date')::date,
      (p_appointment ->> 'start_time')::time,
      (p_appointment ->> 'duration_minutes')::integer,
      p_capacity
    );
    if v_professional is not null then
      perform public.assert_professional_free(
        (p_appointment ->> 'date')::date,
        (p_appointment ->> 'start_time')::time,
        (p_appointment ->> 'duration_minutes')::integer,
        v_professional
      );
    end if;
  end if;

  insert into public.appointments (
    customer_id, pet_id, size_id, date, start_time, duration_minutes,
    total_cents, status, notes, customer_notes, source,
    professional_id, inspiration_id, inspiration_snapshot, attribution
  ) values (
    (p_appointment ->> 'customer_id')::uuid,
    (p_appointment ->> 'pet_id')::uuid,
    p_appointment ->> 'size_id',
    (p_appointment ->> 'date')::date,
    (p_appointment ->> 'start_time')::time,
    (p_appointment ->> 'duration_minutes')::integer,
    (p_appointment ->> 'total_cents')::integer,
    v_status,
    coalesce(p_appointment ->> 'notes', ''),
    coalesce(p_appointment ->> 'customer_notes', ''),
    coalesce(p_appointment ->> 'source', 'online'),
    v_professional,
    p_appointment ->> 'inspiration_id',
    case when jsonb_typeof(p_appointment -> 'inspiration_snapshot') = 'object' then p_appointment -> 'inspiration_snapshot' end,
    case when jsonb_typeof(p_appointment -> 'attribution') = 'object' then p_appointment -> 'attribution' end
  )
  returning id into v_id;

  insert into public.appointment_services (appointment_id, service_id, name, price_cents, duration_minutes, position)
  select v_id, x.service_id, x.name, x.price_cents, x.duration_minutes, x.position
    from jsonb_to_recordset(p_services) as x(service_id text, name text, price_cents integer, duration_minutes integer, position integer);

  insert into public.appointment_addons (appointment_id, addon_id, name, price_cents, duration_minutes, position)
  select v_id, x.addon_id, x.name, x.price_cents, x.duration_minutes, x.position
    from jsonb_to_recordset(coalesce(p_addons, '[]'::jsonb)) as x(addon_id text, name text, price_cents integer, duration_minutes integer, position integer);

  return v_id;
end;
$$;

revoke all on function public.create_appointment_v2(jsonb, jsonb, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.create_appointment_v2(jsonb, jsonb, jsonb, integer, text) to service_role;
