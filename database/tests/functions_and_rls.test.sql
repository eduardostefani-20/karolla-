-- =============================================================================
-- Testes do banco (PostgreSQL local com database/local/supabase_shim.sql).
--   ./database/scripts/test-local.sh
-- Cada bloco lança exceção se uma verificação falhar.
-- =============================================================================
\set ON_ERROR_STOP on

-- 1) Capacidade e conflito de horário ------------------------------------------
do $$
declare
  v_customer uuid := '00000000-0000-4000-8000-c00000000001';
  v_pet uuid := '00000000-0000-4000-8000-d00000000001';
  v_day date := current_date + 30;
  v_a uuid;
  v_b uuid;
  v_failed boolean;
  v_appt jsonb;
  v_srv jsonb := '[{"service_id":"banho","name":"Banho","price_cents":9000,"duration_minutes":60,"position":0}]';
begin
  v_appt := jsonb_build_object('customer_id', v_customer, 'pet_id', v_pet, 'size_id', 'grande', 'date', v_day,
    'start_time', '09:00', 'duration_minutes', 60, 'total_cents', 9000, 'status', 'pending', 'source', 'online');
  v_a := public.create_appointment(v_appt, v_srv, '[]', 1);
  assert (select count(*) from public.appointment_services where appointment_id = v_a) = 1, 'itens não gravados';
  assert (select total_price from public.appointments where id = v_a) = 90.00, 'total_price incorreto';

  -- conflito com capacidade 1
  v_failed := false;
  begin
    perform public.create_appointment(v_appt || '{"start_time":"09:30"}', v_srv, '[]', 1);
  exception when others then
    v_failed := sqlerrm = 'SLOT_UNAVAILABLE';
  end;
  assert v_failed, 'deveria bloquear horário ocupado';

  -- encostado (10:00) é permitido
  v_b := public.create_appointment(v_appt || '{"start_time":"10:00"}', v_srv, '[]', 1);

  -- capacidade 2 permite sobreposição
  perform public.create_appointment(v_appt || '{"start_time":"09:30"}', v_srv, '[]', 2);

  -- remarcar B para cima de A (capacidade 1) falha
  v_failed := false;
  begin
    perform public.update_appointment(v_b, '{"start_time":"09:00"}', null, null, 1);
  exception when others then
    v_failed := sqlerrm = 'SLOT_UNAVAILABLE';
  end;
  assert v_failed, 'deveria bloquear remarcação em conflito';

  -- cancelados liberam a agenda
  perform public.update_appointment(v_a, '{"status":"cancelled"}', null, null, null);
  perform public.update_appointment(v_b, '{"start_time":"08:00", "notes":"remarcado"}',
    '[{"service_id":"tosa","name":"Tosa","price_cents":11000,"duration_minutes":90,"position":0}]', '[]', 2);
  assert (select name from public.appointment_services where appointment_id = v_b) = 'Tosa', 'itens não substituídos';
  assert (select notes from public.appointments where id = v_b) = 'remarcado', 'patch não aplicado';

  v_failed := false;
  begin
    perform public.update_appointment(gen_random_uuid(), '{}', null, null, null);
  exception when others then
    v_failed := sqlerrm = 'APPOINTMENT_NOT_FOUND';
  end;
  assert v_failed, 'deveria acusar agendamento inexistente';
  raise notice 'OK: capacidade e conflito de horário';
end $$;

-- 2) RLS: visitante anônimo ------------------------------------------------------
update public.services set active = false where id = 'escovacao';
set role anon;
do $$
begin
  assert (select count(*) from public.customers) = 0, 'anon não pode ler clientes';
  assert (select count(*) from public.appointments) = 0, 'anon não pode ler agendamentos';
  assert (select count(*) from public.pets) = 0, 'anon não pode ler pets';
  assert (select count(*) from public.services where id = 'escovacao') = 0, 'anon não pode ver serviço inativo';
  assert (select count(*) from public.services) > 0, 'anon deve ver serviços ativos';
  assert (select count(*) from public.service_prices where service_id = 'escovacao') = 0, 'preço de serviço inativo oculto';
  begin
    insert into public.appointments (customer_id, pet_id, size_id, date, start_time, duration_minutes, total_cents)
    values (gen_random_uuid(), gen_random_uuid(), 'mini', current_date, '10:00', 60, 1);
    raise exception 'anon conseguiu inserir agendamento';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.service_prices set price_cents = 1;
    assert not found, 'anon não pode alterar preços';
  end;
  raise notice 'OK: RLS anônimo';
end $$;
reset role;
update public.services set active = true where id = 'escovacao';

-- 3) RLS: administradora autenticada × usuário comum ----------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'carol@karollapet.test', '{"name":"Carol"}'),
  ('22222222-2222-4222-8222-222222222222', 'qualquer@pessoa.test', '{}');
insert into public.admins (user_id, role) values ('11111111-1111-4111-8111-111111111111', 'owner');

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false); end $$;
do $$
begin
  assert (select count(*) from public.customers) = 0, 'usuário comum não pode ler clientes';
  assert (select count(*) from public.users) = 1, 'usuário comum vê apenas o próprio perfil';
  raise notice 'OK: usuário autenticado sem perfil admin';
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false); end $$;
do $$
begin
  assert (select count(*) from public.customers) >= 3, 'admin deve ler clientes';
  assert (select count(*) from public.appointments) >= 1, 'admin deve ler agendamentos';
  update public.service_prices set price_cents = price_cents + 100 where service_id = 'banho' and size_id = 'mini';
  assert found, 'admin deve alterar preços';
  assert (select name from public.users where id = '11111111-1111-4111-8111-111111111111') = 'Carol', 'trigger de perfil';
  raise notice 'OK: RLS administradora';
end $$;
reset role;
