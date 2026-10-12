\set ON_ERROR_STOP on
-- 0011: serviço com tosa marcado, comentários protegidos e um transporte por agendamento.
do $$
declare
  c uuid; p uuid; a uuid; insp text; failed boolean := false;
begin
  assert (select count(*) from public.services where includes_grooming is null) = 0, 'serviço sempre com marcação de tosa';
  select id into c from public.customers order by created_at limit 1;
  select id into p from public.pets where customer_id = c limit 1;
  select id into a from public.appointments where customer_id = c limit 1;
  if a is null then
    insert into public.appointments (customer_id, pet_id, size_id, date, start_time, duration_minutes, total_cents)
    values (c, p, 'mini', current_date + 50, '09:00', 60, 4500) returning id into a;
  end if;
  insert into public.inspirations (title, species_id, image_url, grooming_type) values ('Teste', 'dog', 'https://cdn/x.jpg', 'bebe') returning id into insp;
  insert into public.inspiration_comments (inspiration_id, customer_id, author_name, body) values (insp, c, 'Ana', 'Amei!');
  begin
    insert into public.inspiration_comments (inspiration_id, customer_id, body) values (insp, c, 'x');
  exception when check_violation then failed := true;
  end;
  assert failed, 'comentário curto demais deveria ser recusado';

  insert into public.taxi_regions (id, name, neighborhoods, fee_one_way_cents, fee_round_trip_cents) values ('centro', 'Centro', '{Centro}', 1500, 2500);
  insert into public.taxi_drivers (id, name) values ('joao', 'João');
  insert into public.taxi_transports (appointment_id, customer_id, pet_id, region_id, direction, date, pickup_time, fee_cents)
  values (a, c, p, 'centro', 'pickup', current_date + 50, '08:30', 1500);
  failed := false;
  begin
    insert into public.taxi_transports (appointment_id, customer_id, pet_id, direction, date, pickup_time) values (a, c, p, 'pickup', current_date + 50, '08:30');
  exception when unique_violation then failed := true;
  end;
  assert failed, 'um transporte por agendamento';
  failed := false;
  begin
    update public.taxi_transports set status = 'voando' where appointment_id = a;
  exception when check_violation then failed := true;
  end;
  assert failed, 'status de transporte inválido';
  raise notice 'OK: inspirações e Taxi Dog';
end $$;

set role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform count(*) from public.inspiration_comments;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'visitante não lê comentários direto (só pelo servidor)';
  raise notice 'OK: comentários e transportes protegidos';
end $$;
reset role;
