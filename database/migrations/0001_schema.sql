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
