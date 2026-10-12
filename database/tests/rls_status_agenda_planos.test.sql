\set ON_ERROR_STOP on
-- 0010: status novos, capacidade do profissional na trava atômica, planos sem uso duplicado.
do $$
declare
  c uuid; p uuid;
  d date := current_date + 45;
  srv jsonb := '[{"service_id":"banho","name":"Banho","price_cents":4500,"duration_minutes":60,"position":0}]';
  ap jsonb; a1 uuid; a2 uuid; failed boolean := false;
  pl uuid; cp uuid;
begin
  select id into c from public.customers order by created_at limit 1;
  select id into p from public.pets where customer_id = c limit 1;
  insert into public.professionals (id, name, capacity) values ('pro-dupla', 'Dupla', 2);
  ap := jsonb_build_object('customer_id', c, 'pet_id', p, 'size_id', 'mini', 'date', d, 'start_time', '10:00', 'duration_minutes', 60, 'total_cents', 4500);
  a1 := public.create_appointment_v2(ap, srv, '[]', 5, 'pro-dupla');
  a2 := public.create_appointment_v2(ap || '{"start_time":"10:30"}', srv, '[]', 5, 'pro-dupla');
  begin
    perform public.create_appointment_v2(ap || '{"start_time":"10:15"}', srv, '[]', 5, 'pro-dupla');
  exception when others then failed := sqlerrm = 'SLOT_UNAVAILABLE';
  end;
  assert failed, 'terceiro pet ao mesmo tempo para profissional de capacidade 2 deveria ser recusado';

  -- status novos
  perform public.update_appointment(a1, '{"status":"waiting"}', null, null, null);
  perform public.update_appointment(a1, '{"status":"ready"}', null, null, null);
  perform public.update_appointment(a1, '{"status":"delivered"}', null, null, null);
  assert (select status from public.appointments where id = a1) = 'delivered', 'status entregue ao tutor';
  update public.appointments set origin = 'whatsapp', created_by_name = 'Carol' where id = a2;
  failed := false;
  begin
    update public.appointments set origin = 'fax' where id = a2;
  exception when check_violation then failed := true;
  end;
  assert failed, 'origem inválida deveria ser recusada';

  -- planos: uso único por atendimento + serviço
  insert into public.plans (name, price_cents, service_ids, uses_per_period) values ('4 banhos', 16000, '{banho}', 4) returning id into pl;
  insert into public.customer_plans (customer_id, plan_id, start_date, next_due_date, price_cents) values (c, pl, d, d, 16000) returning id into cp;
  insert into public.plan_usages (customer_plan_id, appointment_id, service_id, period_start, used_at) values (cp, a2, 'banho', d, d);
  failed := false;
  begin
    insert into public.plan_usages (customer_plan_id, appointment_id, service_id, period_start, used_at) values (cp, a2, 'banho', d, d);
  exception when unique_violation then failed := true;
  end;
  assert failed, 'o mesmo serviço do mesmo atendimento não pode ser descontado duas vezes';
  failed := false;
  begin
    delete from public.plans where id = pl;
  exception when foreign_key_violation then failed := true;
  end;
  assert failed, 'plano contratado não pode ser apagado';
  raise notice 'OK: status, capacidade do profissional e planos';
end $$;

set role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform count(*) from public.plan_payments;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'visitante não lê pagamentos';
  raise notice 'OK: planos protegidos';
end $$;
reset role;
