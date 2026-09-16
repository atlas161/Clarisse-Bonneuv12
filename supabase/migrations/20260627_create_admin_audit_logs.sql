create table if not exists public.admin_audit_logs (
  id text primary key,
  at timestamptz not null default timezone('utc', now()),
  actor_user_id text not null default '',
  actor_name text not null default '',
  actor_email text not null default '',
  actor_role text not null default '',
  action text not null default '',
  target_type text not null default '',
  target_id text not null default '',
  target_label text not null default '',
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_logs_at_idx
  on public.admin_audit_logs (at desc);

create index if not exists admin_audit_logs_actor_email_idx
  on public.admin_audit_logs (actor_email);

create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs (action);

create index if not exists admin_audit_logs_target_type_idx
  on public.admin_audit_logs (target_type);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "admin_audit_logs_select_service_role" on public.admin_audit_logs;
drop policy if exists "admin_audit_logs_insert_service_role" on public.admin_audit_logs;
drop policy if exists "admin_audit_logs_update_service_role" on public.admin_audit_logs;
drop policy if exists "admin_audit_logs_delete_service_role" on public.admin_audit_logs;

create policy "admin_audit_logs_select_service_role"
on public.admin_audit_logs
for select
to service_role
using (true);

create policy "admin_audit_logs_insert_service_role"
on public.admin_audit_logs
for insert
to service_role
with check (true);

create policy "admin_audit_logs_update_service_role"
on public.admin_audit_logs
for update
to service_role
using (true)
with check (true);

create policy "admin_audit_logs_delete_service_role"
on public.admin_audit_logs
for delete
to service_role
using (true);
