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
