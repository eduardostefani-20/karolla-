-- 0012: anônimo sem permissão nas tabelas com dados pessoais
do $$
declare t text;
begin
  foreach t in array array['customers','pets','appointments','admins','users'] loop
    if has_table_privilege('anon', 'public.' || t, 'select') or has_table_privilege('anon', 'public.' || t, 'insert') then
      raise exception 'anon ainda tem acesso a %', t;
    end if;
  end loop;
  raise notice 'OK: anônimo sem acesso às tabelas pessoais';
end $$;
