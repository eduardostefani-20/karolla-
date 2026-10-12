\set ON_ERROR_STOP on
-- Equipe: perfis novos, permissões personalizadas e acesso direto restrito.
insert into auth.users (id, email, raw_user_meta_data) values
  ('33333333-3333-4333-8333-333333333333', 'gerente@karollapet.test', '{"name":"Gerente"}'),
  ('44444444-4444-4444-8444-444444444444', 'adm@karollapet.test', '{"name":"Adm"}');
insert into public.admins (user_id, role) values ('33333333-3333-4333-8333-333333333333', 'manager');
insert into public.admins (user_id, role, permissions) values
  ('44444444-4444-4444-8444-444444444444', 'admin', '{"grants":["agenda.view"],"agendaScope":"all"}');

do $$
declare failed boolean := false;
begin
  begin
    insert into public.admins (user_id, role) values ('44444444-4444-4444-8444-444444444444', 'superuser');
  exception when check_violation then failed := true; when unique_violation then failed := true;
  end;
  assert failed, 'perfil inválido deveria ser recusado';
  failed := false;
  begin
    update public.admins set permissions = '"tudo"' where user_id = '33333333-3333-4333-8333-333333333333';
  exception when check_violation then failed := true;
  end;
  assert failed, 'formato de permissões inválido deveria ser recusado';
  raise notice 'OK: perfis e formato de permissões';
end $$;

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false); end $$;
do $$
begin
  assert (select count(*) from public.appointments) = 0, 'gerente não lê o banco direto (valores só pelo servidor)';
  assert (select count(*) from public.audit_logs) = 0, 'gerente não lê a auditoria';
  raise notice 'OK: gerente sem acesso direto';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false); end $$;
do $$
begin
  assert (select count(*) from public.customers) = 0, 'admin com permissões restritas não lê o banco direto';
  raise notice 'OK: admin restrito sem acesso direto';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false); end $$;
do $$
declare failed boolean := false;
begin
  assert (select count(*) from public.customers) >= 1, 'conta principal continua com acesso';
  begin
    insert into public.audit_logs (action, entity, status) values ('x', 'y', 200);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'auditoria só é gravada pelo servidor';
  raise notice 'OK: conta principal';
end $$;
reset role;

insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, status)
values ('11111111-1111-4111-8111-111111111111', 'carol@karollapet.test', 'PATCH /team/:id', 'team', '33333333', 200);
delete from public.users where id = '33333333-3333-4333-8333-333333333333';
do $$ begin
  assert (select count(*) from public.audit_logs) = 1, 'auditoria preservada';
end $$;
