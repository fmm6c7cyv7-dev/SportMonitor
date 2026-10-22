-- Persist AI-confirmed duplicate story identity without replacing source article rows.
-- Kept private to the service-role pipeline; users only see the selected representative.
create table if not exists public.news_story_members (
  news_item_id uuid primary key references public.news_items(id) on delete cascade,
  -- Identity must remain stable if an old source article is pruned.
  story_id uuid not null,
  matched_at timestamptz not null default now(),
  match_method text not null default 'ai' check (match_method = 'ai')
);

create index if not exists news_story_members_story_idx
  on public.news_story_members(story_id);

alter table public.news_story_members enable row level security;
revoke all on table public.news_story_members from anon, authenticated;
