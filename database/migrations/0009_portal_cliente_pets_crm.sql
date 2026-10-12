-- =============================================================================
-- KAROLLA PET — 0009: Portal do cliente, ficha ampliada do pet, fotos privadas e CRM
-- Somente acréscimos (nenhum dado é apagado). Reaplicável.
-- =============================================================================

-- Cliente: conta do portal (1 conta = 1 cadastro) e preferência de não receber mensagens
alter table public.customers add column if not exists marketing_opt_out boolean not null default false;
create unique index if not exists customers_user_id_key on public.customers (user_id) where user_id is not null;
create index if not exists customers_email_lower_idx on public.customers (lower(email));

-- Pet: nascimento, características, preferências de tosa, observações internas e foto (privada)
alter table public.pets add column if not exists birth_date date;
alter table public.pets add column if not exists characteristics text not null default '';
alter table public.pets add column if not exists grooming_preferences text not null default '';
alter table public.pets add column if not exists internal_notes text not null default '';
alter table public.pets add column if not exists photo_path text not null default '';
create index if not exists pets_customer_idx on public.pets (customer_id);

-- Fotos de referência do pet (armazenamento privado)
create table if not exists public.pet_references (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.pets (id) on delete cascade,
  customer_id     uuid not null references public.customers (id) on delete cascade,
  path            text not null check (char_length(path) between 5 and 300),
  description     text not null default '' check (char_length(description) <= 300),
  appointment_id  uuid references public.appointments (id) on delete set null,
  uploaded_by     text not null default 'customer' check (uploaded_by in ('customer', 'staff')),
  created_at      timestamptz not null default now()
);
create index if not exists pet_references_pet_idx on public.pet_references (pet_id, created_at);
create index if not exists pet_references_customer_idx on public.pet_references (customer_id);
create index if not exists pet_references_appointment_idx on public.pet_references (appointment_id);

-- Tentativas de contato pelo WhatsApp (o sistema nunca envia sozinho)
create table if not exists public.contact_logs (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete cascade,
  appointment_id  uuid references public.appointments (id) on delete set null,
  kind            text not null check (kind in ('reactivation', 'pickup', 'other')),
  status          text not null default 'opened' check (status in ('opened', 'sent', 'cancelled')),
  message         text not null default '' check (char_length(message) <= 1000),
  actor_id        uuid references public.users (id) on delete set null,
  actor_name      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists contact_logs_customer_idx on public.contact_logs (customer_id, created_at desc);
create index if not exists contact_logs_appointment_idx on public.contact_logs (appointment_id);
create index if not exists contact_logs_actor_idx on public.contact_logs (actor_id);
drop trigger if exists contact_logs_updated_at on public.contact_logs;
create trigger contact_logs_updated_at before update on public.contact_logs for each row execute function public.set_updated_at();

-- Configurações do CRM
alter table public.business_settings add column if not exists crm_inactive_days integer not null default 40;
alter table public.business_settings drop constraint if exists business_settings_crm_inactive_days_check;
alter table public.business_settings add constraint business_settings_crm_inactive_days_check check (crm_inactive_days between 7 and 365);
alter table public.business_settings add column if not exists crm_reactivation_message text not null default '';

-- Índice da chave estrangeira criada na 0008 (recomendação do Supabase)
create index if not exists admins_professional_idx on public.admins (professional_id);

-- RLS: tabelas novas só pelo servidor (service role). Leitura direta apenas por contas de acesso total.
alter table public.pet_references enable row level security;
alter table public.contact_logs enable row level security;
revoke all on public.pet_references from anon;
revoke all on public.contact_logs from anon;
drop policy if exists "admin: gestao" on public.pet_references;
create policy "admin: gestao" on public.pet_references for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "admin: gestao" on public.contact_logs;
create policy "admin: gestao" on public.contact_logs for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Mantém o e-mail do perfil público igual ao do login (troca de e-mail confirmada no portal)
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_auth_user_email_change() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- Bucket PRIVADO para fotos dos pets e referências (até 8 MB; só imagens). Sem leitura pública.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('karolla-private', 'karolla-private', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
  end if;
end $$;
