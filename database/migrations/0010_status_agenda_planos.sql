-- =============================================================================
-- KAROLLA PET — 0010: Novos status, origem do agendamento, agenda por profissional e planos
-- Somente acréscimos (nenhum dado é apagado). Reaplicável.
-- =============================================================================

-- Fluxo do atendimento: Aguardando atendimento, Pronto para retirada, Entregue ao tutor
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('pending', 'confirmed', 'waiting', 'in_progress', 'completed', 'ready', 'delivered', 'cancelled', 'no_show'));

-- Origem (WhatsApp, telefone, presencial...) e quem criou pelo painel
alter table public.appointments add column if not exists origin text;
alter table public.appointments drop constraint if exists appointments_origin_check;
alter table public.appointments add constraint appointments_origin_check
  check (origin is null or origin in ('site', 'whatsapp', 'phone', 'walk_in', 'other'));
alter table public.appointments add column if not exists created_by_name text not null default '';

-- Configurações: aviso de retirada e limite geral opcional por horário
alter table public.business_settings add column if not exists pickup_message text not null default '';
alter table public.business_settings add column if not exists slot_capacity_limit integer;
alter table public.business_settings drop constraint if exists business_settings_slot_capacity_limit_check;
alter table public.business_settings add constraint business_settings_slot_capacity_limit_check
  check (slot_capacity_limit is null or slot_capacity_limit between 1 and 50);

-- Limite opcional por tipo de serviço
alter table public.services add column if not exists max_concurrent integer;
alter table public.services drop constraint if exists services_max_concurrent_check;
alter table public.services add constraint services_max_concurrent_check check (max_concurrent is null or max_concurrent between 1 and 50);

-- Profissional: capacidade e horário próprio (vazio = segue o funcionamento)
alter table public.professionals add column if not exists capacity integer not null default 1;
alter table public.professionals drop constraint if exists professionals_capacity_check;
alter table public.professionals add constraint professionals_capacity_check check (capacity between 1 and 10);
alter table public.professionals add column if not exists work_hours jsonb not null default '[]'::jsonb;
alter table public.professionals drop constraint if exists professionals_work_hours_check;
alter table public.professionals add constraint professionals_work_hours_check check (jsonb_typeof(work_hours) = 'array');

-- Folgas, férias e indisponibilidades dos profissionais
create table if not exists public.professional_time_off (
  id               uuid primary key default gen_random_uuid(),
  professional_id  text not null references public.professionals (id) on delete cascade,
  date_from        date not null,
  date_to          date not null,
  start_time       time,
  end_time         time,
  reason           text not null default '' check (char_length(reason) <= 200),
  created_at       timestamptz not null default now(),
  check (date_to >= date_from),
  check ((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time > start_time))
);
create index if not exists professional_time_off_idx on public.professional_time_off (professional_id, date_from, date_to);

-- Trava atômica do profissional passa a respeitar a capacidade dele (padrão 1 = um pet por vez)
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
  v_capacity integer := coalesce((select capacity from public.professionals where id = p_professional_id), 1);
  v_max integer := 0;
  v_minute integer;
begin
  perform pg_advisory_xact_lock(hashtext('karolla:appointments:' || p_date::text));
  -- maior número de atendimentos simultâneos do profissional dentro do intervalo
  for v_minute in
    select greatest(public.time_to_minutes(a.start_time), v_start)
      from public.appointments a
     where a.date = p_date
       and a.professional_id = p_professional_id
       and a.status not in ('cancelled', 'no_show')
       and (p_exclude is null or a.id <> p_exclude)
       and public.time_to_minutes(a.start_time) < v_end
       and public.time_to_minutes(a.start_time) + a.duration_minutes > v_start
  loop
    v_max := greatest(v_max, (
      select count(*) from public.appointments b
       where b.date = p_date
         and b.professional_id = p_professional_id
         and b.status not in ('cancelled', 'no_show')
         and (p_exclude is null or b.id <> p_exclude)
         and public.time_to_minutes(b.start_time) <= v_minute
         and public.time_to_minutes(b.start_time) + b.duration_minutes > v_minute
    ));
  end loop;
  if v_max >= v_capacity then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Planos e mensalidades (sem pagamento online: pagamentos são registrados pela equipe)
-- -----------------------------------------------------------------------------
create table if not exists public.plans (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  description      text not null default '',
  price_cents      integer not null check (price_cents >= 0),
  periodicity      text not null default 'monthly' check (periodicity in ('monthly', 'quarterly', 'semiannual', 'yearly')),
  service_ids      text[] not null default '{}',
  uses_per_period  integer not null check (uses_per_period between 1 and 100),
  rules            text not null default '',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.customer_plans (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers (id) on delete restrict,
  plan_id        uuid not null references public.plans (id) on delete restrict,
  pet_id         uuid references public.pets (id) on delete set null,
  start_date     date not null,
  next_due_date  date not null,
  status         text not null default 'pending' check (status in ('pending', 'active', 'paused', 'cancelled')),
  price_cents    integer not null check (price_cents >= 0),
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists customer_plans_customer_idx on public.customer_plans (customer_id);
create index if not exists customer_plans_plan_idx on public.customer_plans (plan_id);
create index if not exists customer_plans_pet_idx on public.customer_plans (pet_id);

create table if not exists public.plan_payments (
  id                uuid primary key default gen_random_uuid(),
  customer_plan_id  uuid not null references public.customer_plans (id) on delete restrict,
  amount_cents      integer not null check (amount_cents >= 0),
  paid_at           date not null,
  method            text not null check (method in ('pix', 'cash', 'debit', 'credit', 'transfer', 'other')),
  period_from       date not null,
  period_to         date not null,
  notes             text not null default '',
  recorded_by_name  text not null default '',
  created_at        timestamptz not null default now()
);
create index if not exists plan_payments_plan_idx on public.plan_payments (customer_plan_id);

create table if not exists public.plan_usages (
  id                uuid primary key default gen_random_uuid(),
  customer_plan_id  uuid not null references public.customer_plans (id) on delete restrict,
  appointment_id    uuid not null references public.appointments (id) on delete restrict,
  service_id        text not null,
  period_start      date not null,
  used_at           date not null,
  recorded_by_name  text not null default '',
  created_at        timestamptz not null default now()
);
-- o mesmo serviço do mesmo atendimento não é descontado duas vezes
create unique index if not exists plan_usages_unique on public.plan_usages (appointment_id, service_id);
create index if not exists plan_usages_plan_idx on public.plan_usages (customer_plan_id, period_start);

create table if not exists public.plan_events (
  id                uuid primary key default gen_random_uuid(),
  customer_plan_id  uuid not null references public.customer_plans (id) on delete cascade,
  kind              text not null check (kind in ('created', 'status', 'payment', 'usage', 'usage_reverted', 'edited')),
  detail            text not null default '' check (char_length(detail) <= 500),
  actor_name        text not null default '',
  created_at        timestamptz not null default now()
);
create index if not exists plan_events_plan_idx on public.plan_events (customer_plan_id, created_at desc);

drop trigger if exists plans_updated_at on public.plans;
create trigger plans_updated_at before update on public.plans for each row execute function public.set_updated_at();
drop trigger if exists customer_plans_updated_at on public.customer_plans;
create trigger customer_plans_updated_at before update on public.customer_plans for each row execute function public.set_updated_at();

-- RLS: tudo pelo servidor; leitura/gestão direta só por contas de acesso total
do $$
declare t text;
begin
  foreach t in array array['professional_time_off', 'plans', 'customer_plans', 'plan_payments', 'plan_usages', 'plan_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists "admin: gestao" on public.%I', t);
    execute format('create policy "admin: gestao" on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;
