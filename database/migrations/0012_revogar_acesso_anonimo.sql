-- =============================================================================
-- KAROLLA PET — 0012: Defesa extra — o visitante anônimo (chave pública) não tem
-- permissão nenhuma nas tabelas com dados pessoais. As regras de linha (RLS) já
-- bloqueavam (o anônimo lê 0 linhas); aqui removemos também as permissões padrão.
-- O site não usa a chave pública para ler dados: tudo passa pelo servidor.
-- Somente revoga permissões (nenhum dado é alterado). Reaplicável.
-- =============================================================================
revoke all on public.customers    from anon;
revoke all on public.pets         from anon;
revoke all on public.appointments from anon;
revoke all on public.admins       from anon;
revoke all on public.users        from anon;
