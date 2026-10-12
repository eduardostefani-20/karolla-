-- =============================================================================
-- KAROLLA PET — 0011: Etiquetas e comentários das inspirações, serviço com tosa e Taxi Dog
-- Somente acréscimos (nenhum dado é apagado). Reaplicável.
-- =============================================================================

-- Serviço que inclui tosa (mostra o estilo de tosa no agendamento). Marca os que já têm "tosa" no nome/categoria.
alter table public.services add column if not exists includes_grooming boolean;
update public.services set includes_grooming = (name ilike '%tosa%' or category ilike '%tosa%') where includes_grooming is null;
alter table public.services alter column includes_grooming set default false;
alter table public.services alter column includes_grooming set not null;

-- Etiquetas das inspirações: porte e tipo de tosa (raça já existe)
alter table public.inspirations add column if not exists size_id text references public.pet_sizes (id) on delete set null;
alter table public.inspirations add column if not exists grooming_type text;
alter table public.inspirations drop constraint if exists inspirations_grooming_type_check;
alter table public.inspirations add constraint inspirations_grooming_type_check
  check (grooming_type is null or grooming_type in ('bebe', 'higienica', 'tesoura', 'maquina', 'raca', 'criativa', 'banho'));
create index if not exists inspirations_size_idx on public.inspirations (size_id);

-- Comentários de clientes com conta (a equipe pode remover; remoção não apaga o cliente)
create table if not exists public.inspiration_comments (
  id              uuid primary key default gen_random_uuid(),
  inspiration_id  text not null references public.inspirations (id) on delete cascade,
  customer_id     uuid not null references public.customers (id) on delete cascade,
  author_name     text not null default '' check (char_length(author_name) <= 60),
  body            text not null check (char_length(body) between 2 and 500),
  status          text not null default 'visible' check (status in ('visible', 'removed')),
  created_at      timestamptz not null default now()
);
create index if not exists inspiration_comments_inspiration_idx on public.inspiration_comments (inspiration_id, created_at);
create index if not exists inspiration_comments_customer_idx on public.inspiration_comments (customer_id, created_at desc);

-- Taxi Dog: configuração geral
alter table public.business_settings add column if not exists taxi_enabled boolean not null default false;
alter table public.business_settings add column if not exists taxi_windows jsonb not null default '[]'::jsonb;
alter table public.business_settings drop constraint if exists business_settings_taxi_windows_check;
alter table public.business_settings add constraint business_settings_taxi_windows_check check (jsonb_typeof(taxi_windows) = 'array');
alter table public.business_settings add column if not exists taxi_pickup_lead_minutes integer not null default 30;
alter table public.business_settings add column if not exists taxi_slot_minutes integer not null default 30;

create table if not exists public.taxi_regions (
  id                     text primary key default gen_random_uuid()::text,
  name                   text not null check (char_length(name) between 1 and 60),
  neighborhoods          text[] not null default '{}',
  fee_one_way_cents      integer not null check (fee_one_way_cents >= 0),
  fee_round_trip_cents   integer not null check (fee_round_trip_cents >= 0),
  active                 boolean not null default true,
  sort_order             integer not null default 0
);

create table if not exists public.taxi_drivers (
  id          text primary key default gen_random_uuid()::text,
  name        text not null check (char_length(name) between 1 and 80),
  phone       text not null default '',
  active      boolean not null default true,
  capacity    integer not null default 1 check (capacity between 1 and 10),
  work_hours  jsonb not null default '[]'::jsonb check (jsonb_typeof(work_hours) = 'array'),
  sort_order  integer not null default 0
);

create table if not exists public.taxi_blocks (
  id          uuid primary key default gen_random_uuid(),
  driver_id   text references public.taxi_drivers (id) on delete cascade,
  date_from   date not null,
  date_to     date not null,
  start_time  time,
  end_time    time,
  reason      text not null default '' check (char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  check (date_to >= date_from),
  check ((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time > start_time))
);
create index if not exists taxi_blocks_dates_idx on public.taxi_blocks (date_from, date_to);
create index if not exists taxi_blocks_driver_idx on public.taxi_blocks (driver_id);

-- Transporte de cada agendamento: status próprio, independente do atendimento
create table if not exists public.taxi_transports (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references public.appointments (id) on delete restrict,
  customer_id     uuid not null references public.customers (id) on delete restrict,
  pet_id          uuid not null references public.pets (id) on delete restrict,
  region_id       text references public.taxi_regions (id) on delete set null,
  direction       text not null check (direction in ('pickup', 'dropoff', 'both')),
  date            date not null,
  pickup_time     time,
  dropoff_time    time,
  address         text not null default '',
  notes           text not null default '' check (char_length(notes) <= 500),
  fee_cents       integer not null default 0 check (fee_cents >= 0),
  driver_id       text references public.taxi_drivers (id) on delete set null,
  status          text not null default 'requested'
                  check (status in ('requested', 'confirmed', 'on_the_way', 'picked_up', 'at_shop', 'out_for_delivery', 'delivered', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (pickup_time is not null or dropoff_time is not null)
);
create index if not exists taxi_transports_date_idx on public.taxi_transports (date);
create index if not exists taxi_transports_driver_idx on public.taxi_transports (driver_id, date);
create index if not exists taxi_transports_customer_idx on public.taxi_transports (customer_id);
create index if not exists taxi_transports_pet_idx on public.taxi_transports (pet_id);
create index if not exists taxi_transports_region_idx on public.taxi_transports (region_id);
drop trigger if exists taxi_transports_updated_at on public.taxi_transports;
create trigger taxi_transports_updated_at before update on public.taxi_transports for each row execute function public.set_updated_at();

-- RLS: tudo pelo servidor; leitura/gestão direta só por contas de acesso total
do $$
declare t text;
begin
  foreach t in array array['inspiration_comments', 'taxi_regions', 'taxi_drivers', 'taxi_blocks', 'taxi_transports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists "admin: gestao" on public.%I', t);
    execute format('create policy "admin: gestao" on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;
