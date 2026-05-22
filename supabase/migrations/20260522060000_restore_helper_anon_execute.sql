-- HOTFIX: 20260522050000 revoked anon EXECUTE on RLS helper functions,
-- but the consolidated SELECT policies on tenants / services / availability_slots
-- still call them inline. Anon evaluating these policies then errors with
-- "42501 permission denied for function current_user_tenant_ids", breaking
-- the public booking page entirely.
--
-- The helpers are SECURITY DEFINER and return empty/false for anon (auth.uid()
-- is null), so they are safe to expose. Re-grant EXECUTE to anon, keep the
-- revoke on booking RPCs (book_slot_atomic / cancel / confirm / reschedule).

grant execute on function public.is_platform_admin() to anon;
grant execute on function public.current_user_tenant_ids() to anon;
grant execute on function public.current_user_owner_tenant_ids() to anon;
