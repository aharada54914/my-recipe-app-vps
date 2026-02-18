-- ============================================================
-- Phase 1: Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
alter table public.recipes      enable row level security;
alter table public.stock        enable row level security;
alter table public.favorites    enable row level security;
alter table public.user_notes   enable row level security;
alter table public.view_history enable row level security;

-- -----------------------------------------------------------
-- recipes
-- Public recipes (user_id IS NULL) are readable by everyone.
-- User-created recipes are only accessible to the owner.
-- -----------------------------------------------------------
create policy "recipes_select" on public.recipes
  for select using (
    user_id is null
    or auth.uid() = user_id
  );

create policy "recipes_insert" on public.recipes
  for insert with check (
    auth.uid() = user_id
  );

create policy "recipes_update" on public.recipes
  for update using (
    auth.uid() = user_id
  );

create policy "recipes_delete" on public.recipes
  for delete using (
    auth.uid() = user_id
  );

-- -----------------------------------------------------------
-- stock — owner-only access
-- -----------------------------------------------------------
create policy "stock_select" on public.stock
  for select using (auth.uid() = user_id);

create policy "stock_insert" on public.stock
  for insert with check (auth.uid() = user_id);

create policy "stock_update" on public.stock
  for update using (auth.uid() = user_id);

create policy "stock_delete" on public.stock
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------
-- favorites — owner-only access
-- -----------------------------------------------------------
create policy "favorites_select" on public.favorites
  for select using (auth.uid() = user_id);

create policy "favorites_insert" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "favorites_delete" on public.favorites
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------
-- user_notes — owner-only access
-- -----------------------------------------------------------
create policy "user_notes_select" on public.user_notes
  for select using (auth.uid() = user_id);

create policy "user_notes_insert" on public.user_notes
  for insert with check (auth.uid() = user_id);

create policy "user_notes_update" on public.user_notes
  for update using (auth.uid() = user_id);

create policy "user_notes_delete" on public.user_notes
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------
-- view_history — owner-only access
-- -----------------------------------------------------------
create policy "view_history_select" on public.view_history
  for select using (auth.uid() = user_id);

create policy "view_history_insert" on public.view_history
  for insert with check (auth.uid() = user_id);

create policy "view_history_delete" on public.view_history
  for delete using (auth.uid() = user_id);
