-- Lock down RPC EXECUTE: revoke the default PUBLIC grant, explicitly grant to
-- `authenticated`. After this, anon (which inherited via PUBLIC) can no longer
-- call these via /rest/v1/rpc.
--
-- Why authenticated is kept:
--   • book_slot_atomic / cancel_booking / confirm_booking / reschedule_booking
--     — called from server actions on behalf of a signed-in user.
--   • is_platform_admin / current_user_*_tenant_ids — invoked from inside RLS
--     policy expressions. The caller role at RLS-eval time IS `authenticated`,
--     so the grant must remain. (advisor's `authenticated_security_definer_function_executable`
--     warnings on these are by-design.)

do $revoke$
declare
  fn text;
begin
  foreach fn in array array[
    'public.book_slot_atomic(uuid, uuid, text)',
    'public.cancel_booking(uuid)',
    'public.confirm_booking(uuid)',
    'public.reschedule_booking(uuid, uuid)',
    'public.is_platform_admin()',
    'public.current_user_tenant_ids()',
    'public.current_user_owner_tenant_ids()'
  ]
  loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$revoke$;
