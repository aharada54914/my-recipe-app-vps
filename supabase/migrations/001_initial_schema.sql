-- ============================================================
-- Phase 1: Initial Schema
-- Mirrors the Dexie (IndexedDB) tables with cloud-sync fields
-- ============================================================

-- -----------------------------------------------------------
-- recipes
-- user_id NULL = shared pre-built recipes (~1700)
-- user_id set  = user-created recipes (AI parser, etc.)
-- -----------------------------------------------------------
create table public.recipes (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users(id) on delete cascade,
  title         text        not null,
  recipe_number text        not null default '',
  device        text        not null default 'manual'
                            check (device in ('hotcook', 'healsio', 'manual')),
  category      text        not null default '主菜',
  base_servings integer     not null default 2,
  total_weight_g numeric    not null default 0,
  ingredients   jsonb       not null default '[]'::jsonb,
  steps         jsonb       not null default '[]'::jsonb,
  total_time_minutes integer not null default 0,
  image_url     text,
  thumbnail_url text,
  image_blur_hash text,
  source_url    text,
  servings      text,
  calories      text,
  salt_content  text,
  cooking_time  text,
  raw_steps     jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------
-- stock — user ingredient inventory (typically 30-100 items)
-- -----------------------------------------------------------
create table public.stock (
  id         uuid    primary key default gen_random_uuid(),
  user_id    uuid    not null references auth.users(id) on delete cascade,
  name       text    not null,
  in_stock   boolean not null default false,
  quantity   numeric,
  unit       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

-- -----------------------------------------------------------
-- favorites — one row per user+recipe pair
-- -----------------------------------------------------------
create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  added_at   timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, recipe_id)
);

-- -----------------------------------------------------------
-- user_notes — personal cooking notes per recipe
-- -----------------------------------------------------------
create table public.user_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, recipe_id)
);

-- -----------------------------------------------------------
-- view_history — recipe viewing history for quick access
-- -----------------------------------------------------------
create table public.view_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

-- recipes
create index idx_recipes_user_id          on public.recipes(user_id);
create index idx_recipes_device           on public.recipes(device);
create index idx_recipes_category         on public.recipes(category);
create index idx_recipes_category_device  on public.recipes(category, device);

-- stock
create index idx_stock_user_id on public.stock(user_id);

-- favorites
create index idx_favorites_user_id   on public.favorites(user_id);
create index idx_favorites_recipe_id on public.favorites(recipe_id);

-- user_notes
create index idx_user_notes_user_id   on public.user_notes(user_id);
create index idx_user_notes_recipe_id on public.user_notes(recipe_id);

-- view_history
create index idx_view_history_user_id   on public.view_history(user_id);
create index idx_view_history_recipe_id on public.view_history(recipe_id);
create index idx_view_history_viewed_at on public.view_history(viewed_at desc);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_updated_at
  before update on public.recipes
  for each row execute function public.update_updated_at();

create trigger stock_updated_at
  before update on public.stock
  for each row execute function public.update_updated_at();

create trigger user_notes_updated_at
  before update on public.user_notes
  for each row execute function public.update_updated_at();
