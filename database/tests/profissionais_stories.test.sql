\set ON_ERROR_STOP on
-- Profissionais: o mesmo profissional não atende dois pets ao mesmo tempo; outro profissional sim.
do $$
declare
  c uuid := '00000000-0000-4000-8000-c00000000001';
  p uuid := '00000000-0000-4000-8000-d00000000001';
  d date := current_date + 40;
  srv jsonb := '[{"service_id":"banho","name":"Banho","price_cents":4500,"duration_minutes":60,"position":0}]';
  ap jsonb;
  a uuid; b uuid; failed boolean := false;
begin
  insert into public.professionals (id, name) values ('pro-ana', 'Ana'), ('pro-bia', 'Bia');
  ap := jsonb_build_object('customer_id', c, 'pet_id', p, 'size_id', 'mini', 'date', d, 'start_time', '09:00', 'duration_minutes', 60, 'total_cents', 4500,
                           'inspiration_snapshot', jsonb_build_object('id', 'x', 'title', 'Tosa bebê', 'imageUrl', 'https://cdn/x.jpg', 'breedName', 'Pug'));
  a := public.create_appointment_v2(ap, srv, '[]', 2, 'pro-ana');
  assert (select professional_id from public.appointments where id = a) = 'pro-ana', 'profissional não gravado';
  assert (select inspiration_snapshot ->> 'title' from public.appointments where id = a) = 'Tosa bebê', 'inspiração não gravada';
  begin
    perform public.create_appointment_v2(ap || '{"start_time":"09:30"}', srv, '[]', 2, 'pro-ana');
  exception when others then failed := sqlerrm = 'SLOT_UNAVAILABLE';
  end;
  assert failed, 'profissional ocupado deveria ser recusado';
  b := public.create_appointment_v2(ap || '{"start_time":"09:30"}', srv, '[]', 2, 'pro-bia');
  failed := false;
  begin
    perform public.update_appointment(b, '{"professional_id":"pro-ana"}', null, null, 2);
  exception when others then failed := sqlerrm = 'SLOT_UNAVAILABLE';
  end;
  assert failed, 'troca para profissional ocupado deveria ser recusada';
  perform public.update_appointment(b, '{"professional_id":null}', null, null, null);
  assert (select professional_id from public.appointments where id = b) is null, 'remover profissional';
  raise notice 'OK: agenda por profissional';
end $$;

-- Stories: visitantes só veem stories válidos
insert into public.stories (media_type, media_url, created_at, expires_at) values
  ('image', 'https://cdn/valido.jpg', now(), now() + interval '24 hours'),
  ('image', 'https://cdn/vencido.jpg', now() - interval '25 hours', now() - interval '1 hour');
set role anon;
do $$
begin
  assert (select count(*) from public.stories) = 1, 'anon deve ver só o story válido';
  begin
    insert into public.stories (media_type, media_url, expires_at) values ('image', 'https://x/y.jpg', now() + interval '1 hour');
    raise exception 'anon conseguiu publicar story';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: stories expiram e visitantes não publicam';
end $$;
reset role;
