-- Replace the permissive read-through select policy with explicit
-- member/owner/admin paths for consistency with the codebase pattern.
drop policy if exists template_windows_select on public.availability_template_windows;

create policy template_windows_select_member on public.availability_template_windows for select
  using (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy template_windows_select_owner on public.availability_template_windows for select
  using (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

create policy template_windows_select_admin on public.availability_template_windows for select
  using (is_platform_admin());
