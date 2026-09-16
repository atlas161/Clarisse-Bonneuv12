CREATE TABLE IF NOT EXISTS admin_asset_orders (
  folder_path text NOT NULL,
  public_id text NOT NULL,
  sort_order integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_path, public_id)
);

CREATE INDEX IF NOT EXISTS admin_asset_orders_folder_path_idx
  ON admin_asset_orders (folder_path);

CREATE INDEX IF NOT EXISTS admin_asset_orders_sort_order_idx
  ON admin_asset_orders (sort_order);

CREATE TABLE IF NOT EXISTS admin_asset_metadata (
  folder_path text NOT NULL,
  public_id text NOT NULL,
  alt text,
  alt_en text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_path, public_id)
);

CREATE INDEX IF NOT EXISTS admin_asset_metadata_folder_path_idx
  ON admin_asset_metadata (folder_path);

CREATE INDEX IF NOT EXISTS admin_asset_metadata_updated_at_idx
  ON admin_asset_metadata (updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id text NOT NULL DEFAULT '',
  actor_name text NOT NULL DEFAULT '',
  actor_email text NOT NULL DEFAULT '',
  actor_role text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  target_type text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  target_label text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_at_idx
  ON admin_audit_logs (at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_email_idx
  ON admin_audit_logs (actor_email);

CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx
  ON admin_audit_logs (action);

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_type_idx
  ON admin_audit_logs (target_type);

CREATE TABLE IF NOT EXISTS admin_tracked_folders (
  path text PRIMARY KEY,
  parent_path text NOT NULL DEFAULT '',
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_tracked_folders_parent_path_idx
  ON admin_tracked_folders (parent_path);

CREATE INDEX IF NOT EXISTS admin_tracked_folders_sort_order_idx
  ON admin_tracked_folders (sort_order);

CREATE INDEX IF NOT EXISTS admin_tracked_folders_created_at_idx
  ON admin_tracked_folders (created_at ASC);

CREATE TABLE IF NOT EXISTS admin_external_media (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'youtube',
  folder text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  youtube_id text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  alt text NOT NULL DEFAULT '',
  alt_en text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_external_media_type_check CHECK (type = 'youtube')
);

CREATE INDEX IF NOT EXISTS admin_external_media_folder_idx
  ON admin_external_media (folder);

CREATE INDEX IF NOT EXISTS admin_external_media_created_at_idx
  ON admin_external_media (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_external_media_youtube_id_idx
  ON admin_external_media (youtube_id);
