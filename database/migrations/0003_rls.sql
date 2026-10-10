-- =============================================================================
-- KAROLLA PET — 0003: Row Level Security
--
-- Modelo de acesso:
--  • Back-end (service_role): acesso total — aplica autenticação/regras na API.
--  • Público (anon): somente LEITURA do catálogo ativo. Nunca grava diretamente.
--  • Administradores (authenticated + registro ativo em public.admins): gestão.
--  • Dados pessoais (clientes, pets, agendamentos) NUNCA são legíveis por anon.
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.active);
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.active and a.role = 'owner');
$$;

alter table public.users                enable row level security;
alter table public.admins               enable row level security;
alter table public.pet_species          enable row level security;
alter table public.pet_sizes            enable row level security;
alter table public.pet_breeds           enable row level security;
alter table public.services             enable row level security;
alter table public.service_prices       enable row level security;
alter table public.addons               enable row level security;
alter table public.form_options         enable row level security;
alter table public.customers            enable row level security;
alter table public.pets                 enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_services enable row level security;
alter table public.appointment_addons   enable row level security;
alter table public.business_hours       enable row level security;
alter table public.blocked_dates        enable row level security;
alter table public.blocked_times        enable row level security;
alter table public.business_settings    enable row level security;
alter table public.integration_logs     enable row level security;

-- Catálogo público (somente ativos) -------------------------------------------
create policy "catalogo publico: especies"  on public.pet_species  for select to anon, authenticated using (active);
create policy "catalogo publico: portes"    on public.pet_sizes    for select to anon, authenticated using (active);
create policy "catalogo publico: racas"     on public.pet_breeds   for select to anon, authenticated using (active);
create policy "catalogo publico: servicos"  on public.services     for select to anon, authenticated using (active);
create policy "catalogo publico: adicionais" on public.addons      for select to anon, authenticated using (active);
create policy "catalogo publico: precos"    on public.service_prices for select to anon, authenticated using (
  exists (select 1 from public.services s where s.id = service_id and s.active)
  and exists (select 1 from public.pet_sizes z where z.id = size_id and z.active)
);
create policy "catalogo publico: formulario"   on public.form_options      for select to anon, authenticated using (true);
create policy "catalogo publico: funcionamento" on public.business_hours   for select to anon, authenticated using (true);
create policy "catalogo publico: configuracoes" on public.business_settings for select to anon, authenticated using (true);

-- Administradores: gestão completa ---------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'pet_species', 'pet_sizes', 'pet_breeds', 'services', 'service_prices', 'addons', 'form_options',
    'customers', 'pets', 'appointments', 'appointment_services', 'appointment_addons',
    'business_hours', 'blocked_dates', 'blocked_times', 'business_settings'
  ]
  loop
    execute format('create policy "admin: gestao" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

create policy "admin: leitura de logs" on public.integration_logs for select to authenticated using (public.is_admin());

-- Usuários e perfis ---------------------------------------------------------------
create policy "usuario: proprio perfil" on public.users for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "usuario: atualiza proprio perfil" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins: leitura" on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins: somente owner altera" on public.admins for all to authenticated using (public.is_owner()) with check (public.is_owner());
