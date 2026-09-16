create table if not exists public.admin_external_media (
  id text primary key,
  type text not null default 'youtube',
  folder text not null default '',
  url text not null default '',
  youtube_id text not null default '',
  title text not null default '',
  alt text not null default '',
  alt_en text not null default '',
  tags jsonb not null default '[]'::jsonb,
  sort_order integer,
  created_at timestamptz not null default timezone('utc', now()),
  constraint admin_external_media_type_check check (type = 'youtube')
);

create index if not exists admin_external_media_folder_idx
  on public.admin_external_media (folder);

create index if not exists admin_external_media_created_at_idx
  on public.admin_external_media (created_at desc);

create index if not exists admin_external_media_youtube_id_idx
  on public.admin_external_media (youtube_id);

alter table public.admin_external_media enable row level security;

drop policy if exists "admin_external_media_select_service_role" on public.admin_external_media;
drop policy if exists "admin_external_media_insert_service_role" on public.admin_external_media;
drop policy if exists "admin_external_media_update_service_role" on public.admin_external_media;
drop policy if exists "admin_external_media_delete_service_role" on public.admin_external_media;

create policy "admin_external_media_select_service_role"
on public.admin_external_media
for select
to service_role
using (true);

create policy "admin_external_media_insert_service_role"
on public.admin_external_media
for insert
to service_role
with check (true);

create policy "admin_external_media_update_service_role"
on public.admin_external_media
for update
to service_role
using (true)
with check (true);

create policy "admin_external_media_delete_service_role"
on public.admin_external_media
for delete
to service_role
using (true);
