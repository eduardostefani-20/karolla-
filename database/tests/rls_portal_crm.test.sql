\set ON_ERROR_STOP on
-- Portal do cliente e CRM: 1 conta = 1 cadastro, tabelas novas protegidas, regras de valores.
insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-4555-8555-555555555555', 'tutor@exemplo.com', '{"name":"Tutor"}');

do $$
declare
  c1 uuid; c2 uuid; p uuid; failed boolean := false;
begin
  select id into c1 from public.customers order by created_at limit 1;
  select id into c2 from public.customers where id <> c1 order by created_at limit 1;
  update public.customers set user_id = '55555555-5555-4555-8555-555555555555' where id = c1;
  begin
    update public.customers set user_id = '55555555-5555-4555-8555-555555555555' where id = c2;
  exception when unique_violation then failed := true;
  end;
  assert failed, 'uma conta não pode ficar ligada a dois cadastros';

  select id into p from public.pets where customer_id = c1 limit 1;
  update public.pets set birth_date = '2023-01-10', characteristics = 'Calmo', grooming_preferences = 'Tosa baixa', internal_notes = 'interno', photo_path = 'clientes/x/pets/y/foto/z.jpg' where id = p;
  insert into public.pet_references (pet_id, customer_id, path, description) values (p, c1, 'clientes/x/pets/y/referencias/r.jpg', 'Corte desejado');
  insert into public.contact_logs (customer_id, kind, message) values (c1, 'reactivation', 'Oi!');

  failed := false;
  begin
    insert into public.contact_logs (customer_id, kind) values (c1, 'spam');
  exception when check_violation then failed := true;
  end;
  assert failed, 'tipo de contato inválido deveria ser recusado';

  failed := false;
  begin
    update public.business_settings set crm_inactive_days = 1;
  exception when check_violation then failed := true;
  end;
  assert failed, 'dias de inatividade fora do limite deveriam ser recusados';
  assert (select crm_inactive_days from public.business_settings) = 40, 'padrão de 40 dias';
  raise notice 'OK: portal, pets e CRM';
end $$;

-- e-mail do login trocado → perfil público acompanha
update auth.users set email = 'novo@exemplo.com' where id = '55555555-5555-4555-8555-555555555555';
do $$ begin
  assert (select email from public.users where id = '55555555-5555-4555-8555-555555555555') = 'novo@exemplo.com', 'e-mail do perfil sincronizado';
end $$;

set role anon;
do $$
declare failed boolean := false;
begin
  begin
    perform count(*) from public.pet_references;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'visitante não lê fotos de referência';
  failed := false;
  begin
    perform count(*) from public.contact_logs;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'visitante não lê contatos';
  raise notice 'OK: anônimo sem acesso';
end $$;
reset role;

set role authenticated;
-- o próprio tutor (sem perfil admin) não lê as tabelas direto: tudo passa pelo servidor
do $$ begin perform set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false); end $$;
do $$
begin
  assert (select count(*) from public.pet_references) = 0, 'tutor não lê o banco direto';
  assert (select count(*) from public.contact_logs) = 0, 'tutor não lê contatos';
  assert (select count(*) from public.pets) = 0, 'tutor não lê pets direto';
  raise notice 'OK: tutor só pelo servidor';
end $$;
-- gerente (sem acesso total) também não
do $$ begin perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false); end $$;
do $$ begin
  assert (select count(*) from public.contact_logs) = 0, 'gerente não lê contatos direto';
end $$;
-- conta principal lê
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false); end $$;
do $$ begin
  assert (select count(*) from public.contact_logs) = 1, 'conta principal lê contatos';
  raise notice 'OK: RLS das tabelas novas';
end $$;
reset role;
