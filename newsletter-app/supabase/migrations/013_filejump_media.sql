-- Provider-backed media records for the shared admin image picker. Public post
-- and newsletter content continues to store resolved URLs, while this table
-- preserves the FileJump identifier needed for metadata updates and deletion.
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'filejump'
    check (provider in ('filejump', 'supabase')),
  provider_file_id text not null,
  provider_folder_id text,
  file_name text not null,
  display_name text not null default '',
  url text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  alt_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_file_id)
);

create index if not exists media_assets_created_at_idx
  on public.media_assets(created_at desc);

create index if not exists media_assets_provider_idx
  on public.media_assets(provider, provider_folder_id);

alter table public.media_assets enable row level security;
revoke all on public.media_assets from anon, authenticated;
