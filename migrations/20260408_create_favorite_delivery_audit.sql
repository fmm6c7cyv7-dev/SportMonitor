create table if not exists public.favorite_delivery_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  news_item_id uuid not null,
  device_id text not null,
  sport text not null,
  matched_favorite boolean not null default false,
  feed_eligible boolean not null default false,
  push_sent boolean not null default false,
  push_delivery_logged boolean not null default false,
  favorite_entity_ids text[] not null default '{}',
  favorite_entity_names text[] not null default '{}',
  reason text null,
  debug_json jsonb not null default '{}'::jsonb
);

create index if not exists favorite_delivery_audit_news_item_idx
  on public.favorite_delivery_audit (news_item_id);

create index if not exists favorite_delivery_audit_device_idx
  on public.favorite_delivery_audit (device_id);

create index if not exists favorite_delivery_audit_created_at_desc_idx
  on public.favorite_delivery_audit (created_at desc);

create unique index if not exists favorite_delivery_audit_news_item_device_uidx
  on public.favorite_delivery_audit (news_item_id, device_id);
