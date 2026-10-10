-- =============================================================================
-- KAROLLA PET — 0004: Endurecimento de segurança (recomendações do Supabase Advisor)
-- is_admin()/is_owner() são SECURITY DEFINER e só existem para as políticas RLS:
-- ficam num schema não exposto pela API (private) e sem acesso para anon.
-- As políticas continuam funcionando (referenciam a função pelo OID).
-- =============================================================================
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.is_owner() set schema private;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_owner() to authenticated, service_role;
