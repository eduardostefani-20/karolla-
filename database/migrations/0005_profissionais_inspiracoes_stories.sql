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
