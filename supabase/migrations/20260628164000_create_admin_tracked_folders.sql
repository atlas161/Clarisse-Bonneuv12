create table if not exists public.admin_tracked_folders (
  path text primary key,
  parent_path text not null default '',
  sort_order integer,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_tracked_folders_parent_path_idx
  on public.admin_tracked_folders (parent_path);

create index if not exists admin_tracked_folders_sort_order_idx
  on public.admin_tracked_folders (sort_order);

create index if not exists admin_tracked_folders_created_at_idx
  on public.admin_tracked_folders (created_at asc);

alter table public.admin_tracked_folders enable row level security;

drop policy if exists "admin_tracked_folders_select_service_role" on public.admin_tracked_folders;
drop policy if exists "admin_tracked_folders_insert_service_role" on public.admin_tracked_folders;
drop policy if exists "admin_tracked_folders_update_service_role" on public.admin_tracked_folders;
drop policy if exists "admin_tracked_folders_delete_service_role" on public.admin_tracked_folders;

create policy "admin_tracked_folders_select_service_role"
on public.admin_tracked_folders
for select
to service_role
using (true);

create policy "admin_tracked_folders_insert_service_role"
on public.admin_tracked_folders
for insert
to service_role
with check (true);

create policy "admin_tracked_folders_update_service_role"
on public.admin_tracked_folders
for update
to service_role
using (true)
with check (true);

create policy "admin_tracked_folders_delete_service_role"
on public.admin_tracked_folders
for delete
to service_role
using (true);
