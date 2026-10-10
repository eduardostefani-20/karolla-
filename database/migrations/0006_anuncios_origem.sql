-- =============================================================================
-- Karolla Pet — 0006: anúncios (tráfego pago) e origem dos agendamentos
--  • business_settings: IDs públicos dos pixels (Meta, Google Ads, TikTok), editáveis no painel
--  • appointments.attribution: de onde o cliente veio (UTM, clique em anúncio, site de origem)
--  • create_appointment_v2 passa a gravar a origem (mesma assinatura; nada é removido)
-- =============================================================================

alter table public.business_settings
  add column if not exists meta_pixel_id             text not null default '',
  add column if not exists google_ads_id             text not null default '',
  add column if not exists google_ads_booking_label  text not null default '',
  add column if not exists google_ads_whatsapp_label text not null default '',
  add column if not exists tiktok_pixel_id           text not null default '';

alter table public.appointments
  add column if not exists attribution jsonb;

comment on column public.appointments.attribution is
  'Origem do cliente: utmSource, utmMedium, utmCampaign, utmContent, utmTerm, gclid, fbclid, ttclid, referrer (domínio), landingPage, capturedAt.';

-- Relatório "origem dos agendamentos" no painel filtra por data de criação.
create index if not exists appointments_created_at_idx on public.appointments (created_at);

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
    professional_id, inspiration_id, inspiration_snapshot, attribution
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
    case when jsonb_typeof(p_appointment -> 'inspiration_snapshot') = 'object' then p_appointment -> 'inspiration_snapshot' end,
    case when jsonb_typeof(p_appointment -> 'attribution') = 'object' then p_appointment -> 'attribution' end
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

revoke all on function public.create_appointment_v2(jsonb, jsonb, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.create_appointment_v2(jsonb, jsonb, jsonb, integer, text) to service_role;
