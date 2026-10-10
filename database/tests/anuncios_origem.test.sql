\set ON_ERROR_STOP on
-- Origem do agendamento (UTM / anúncio) é gravada; agendamento sem origem continua funcionando.
do $$
declare
  c uuid := '00000000-0000-4000-8000-c00000000001';
  p uuid := '00000000-0000-4000-8000-d00000000001';
  d date := current_date + 45;
  srv jsonb := '[{"service_id":"banho","name":"Banho","price_cents":4500,"duration_minutes":60,"position":0}]';
  ap jsonb;
  a uuid; b uuid;
begin
  ap := jsonb_build_object('customer_id', c, 'pet_id', p, 'size_id', 'mini', 'date', d, 'start_time', '10:00', 'duration_minutes', 60, 'total_cents', 4500,
                           'attribution', jsonb_build_object('utmSource', 'instagram', 'utmMedium', 'paid', 'utmCampaign', 'tosa-outubro'));
  a := public.create_appointment_v2(ap, srv, '[]', 5);
  assert (select attribution ->> 'utmCampaign' from public.appointments where id = a) = 'tosa-outubro', 'origem não gravada';
  b := public.create_appointment_v2((ap - 'attribution') || '{"start_time":"14:00"}', srv, '[]', 5);
  assert (select attribution from public.appointments where id = b) is null, 'sem origem deveria ficar null';
  b := public.create_appointment_v2(ap || '{"start_time":"16:00","attribution":"texto"}', srv, '[]', 5);
  assert (select attribution from public.appointments where id = b) is null, 'origem inválida deveria ser ignorada';
  assert (select meta_pixel_id = '' and tiktok_pixel_id = '' from public.business_settings where id = 1), 'pixels devem começar vazios';
  raise notice 'OK: origem dos agendamentos e IDs de anúncio';
  delete from public.appointments where date = d;
end $$;
