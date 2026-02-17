# Phase 1: Supabase基盤構築 — 実装計画

## 概要

既存のDexie.js（IndexedDB）オフラインファーストアーキテクチャを維持しつつ、Supabaseクラウド同期の基盤を構築する。Phase 1ではSupabaseクライアントの作成とデータベーススキーマ設計（SQLマイグレーション）、RLS設定を行う。

**重要な方針**: Phase 1は「基盤構築」のみ。実際の同期ロジック（Phase 3）やAuth UI（Phase 2）は含まない。

---

## Step 1: Supabase SDKのインストール

```bash
npm install @supabase/supabase-js
```

**変更ファイル**: `package.json`（自動更新）

---

## Step 2: 環境変数の定義

**変更ファイル**: `.env.example`（新規作成）

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Gemini API (既存)
VITE_GEMINI_API_KEY=your-gemini-key
```

既存の`.env`はgitignore済み。`.env.example`をリファレンスとして追加する。

---

## Step 3: Supabaseクライアント作成

**新規ファイル**: `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null
```

**ポイント**:
- 環境変数が未設定の場合は`null`を返す（オフライン専用モードとして動作継続）
- `Database`型でSupabase操作を型安全に
- Phase 2以降でAuth設定を追加予定

---

## Step 4: Supabase型定義ファイル作成

**新規ファイル**: `src/lib/database.types.ts`

現在のDexieスキーマ（5テーブル）をSupabaseのPostgreSQLテーブルにマッピングする型定義。

**マッピング方針**:

| Dexie テーブル | Supabase テーブル | 追加カラム |
|---------------|-------------------|-----------|
| `recipes` | `recipes` | `user_id`, `created_at`, `updated_at` |
| `stock` | `stock` | `user_id`, `created_at`, `updated_at` |
| `favorites` | `favorites` | `user_id`, `created_at` |
| `userNotes` | `user_notes` | `user_id`, `created_at`, `updated_at` |
| `viewHistory` | `view_history` | `user_id`, `created_at` |

**全テーブル共通**:
- `id`: UUID（Supabase標準。DexieのautoIncrementとは別体系）
- `user_id`: UUID（`auth.uid()`に紐づく、RLSで使用）
- `created_at` / `updated_at`: タイムスタンプ（同期の競合解決に使用）

**`recipes`テーブルの特殊性**:
- プリビルドレシピ（~1700件）は全ユーザー共有 → `user_id = NULL`（公開レシピ）
- AI解析で追加したレシピ → `user_id = auth.uid()`（個人レシピ）
- RLSで「公開レシピは誰でも読める、個人レシピは本人のみ」を実現

**`ingredients`と`steps`の扱い**:
- 現在DexieではJSON配列としてRecipe内に埋め込み
- Supabaseでも`jsonb`カラムとして保持（正規化しない）
- 理由: レシピ内の材料・手順を個別にクエリする必要がないため

---

## Step 5: SQLマイグレーションファイル作成

**新規ファイル**: `supabase/migrations/001_initial_schema.sql`

```sql
-- recipes テーブル
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  recipe_number text not null default '',
  device text not null default 'manual',
  category text not null default '主菜',
  base_servings integer not null default 2,
  total_weight_g numeric not null default 0,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  total_time_minutes integer not null default 0,
  image_url text,
  thumbnail_url text,
  image_blur_hash text,
  source_url text,
  servings text,
  calories text,
  salt_content text,
  cooking_time text,
  raw_steps jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- stock テーブル
create table public.stock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  in_stock boolean not null default false,
  quantity numeric,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

-- favorites テーブル
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, recipe_id)
);

-- user_notes テーブル
create table public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, recipe_id)
);

-- view_history テーブル
create table public.view_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- インデックス
create index idx_recipes_user_id on public.recipes(user_id);
create index idx_recipes_device on public.recipes(device);
create index idx_recipes_category on public.recipes(category);
create index idx_recipes_category_device on public.recipes(category, device);
create index idx_stock_user_id on public.stock(user_id);
create index idx_favorites_user_id on public.favorites(user_id);
create index idx_favorites_recipe_id on public.favorites(recipe_id);
create index idx_user_notes_user_id on public.user_notes(user_id);
create index idx_user_notes_recipe_id on public.user_notes(recipe_id);
create index idx_view_history_user_id on public.view_history(user_id);
create index idx_view_history_recipe_id on public.view_history(recipe_id);
create index idx_view_history_viewed_at on public.view_history(viewed_at desc);

-- updated_atの自動更新トリガー
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
```

---

## Step 6: Row Level Security (RLS) ポリシー

**新規ファイル**: `supabase/migrations/002_rls_policies.sql`

```sql
-- RLS を有効化
alter table public.recipes enable row level security;
alter table public.stock enable row level security;
alter table public.favorites enable row level security;
alter table public.user_notes enable row level security;
alter table public.view_history enable row level security;

-- recipes: 公開レシピ(user_id IS NULL)は誰でも読める、個人レシピは本人のみ
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

-- stock: 本人のデータのみ
create policy "stock_select" on public.stock
  for select using (auth.uid() = user_id);

create policy "stock_insert" on public.stock
  for insert with check (auth.uid() = user_id);

create policy "stock_update" on public.stock
  for update using (auth.uid() = user_id);

create policy "stock_delete" on public.stock
  for delete using (auth.uid() = user_id);

-- favorites: 本人のデータのみ
create policy "favorites_select" on public.favorites
  for select using (auth.uid() = user_id);

create policy "favorites_insert" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "favorites_delete" on public.favorites
  for delete using (auth.uid() = user_id);

-- user_notes: 本人のデータのみ
create policy "user_notes_select" on public.user_notes
  for select using (auth.uid() = user_id);

create policy "user_notes_insert" on public.user_notes
  for insert with check (auth.uid() = user_id);

create policy "user_notes_update" on public.user_notes
  for update using (auth.uid() = user_id);

create policy "user_notes_delete" on public.user_notes
  for delete using (auth.uid() = user_id);

-- view_history: 本人のデータのみ
create policy "view_history_select" on public.view_history
  for select using (auth.uid() = user_id);

create policy "view_history_insert" on public.view_history
  for insert with check (auth.uid() = user_id);

create policy "view_history_delete" on public.view_history
  for delete using (auth.uid() = user_id);
```

---

## Step 7: TypeScript型定義（database.types.ts）

**新規ファイル**: `src/lib/database.types.ts`

SQLスキーマに対応するTypeScript型定義を作成。Supabaseクライアントの型安全な操作に使用。

各テーブルの`Row`（読み取り）、`Insert`（挿入）、`Update`（更新）型を定義する。

---

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `package.json` | 変更 | `@supabase/supabase-js` 追加 |
| `.env.example` | 新規 | 環境変数テンプレート |
| `src/lib/supabase.ts` | 新規 | Supabaseクライアント（null安全） |
| `src/lib/database.types.ts` | 新規 | Supabase DB型定義 |
| `supabase/migrations/001_initial_schema.sql` | 新規 | テーブル定義・インデックス・トリガー |
| `supabase/migrations/002_rls_policies.sql` | 新規 | RLSポリシー |

**既存ファイルへの影響**: なし（Phase 1は基盤のみ。既存のDexie操作やApp.tsxには変更を加えない）

---

## 設計上の判断ポイント

### 1. Dexie ID (number) vs Supabase ID (UUID)
- Dexie: `++id`（auto-increment integer）
- Supabase: `uuid`（gen_random_uuid）
- Phase 3の同期時にIDマッピングテーブル or Dexieに`supabase_id`カラム追加で対応予定

### 2. recipesテーブルのuser_id
- `NULL` = 公開レシピ（プリビルドの~1700件）
- `auth.uid()` = ユーザーがAI解析で追加した個人レシピ
- RLSで公開/個人を自然に分離

### 3. snake_case vs camelCase
- Supabase（PostgreSQL）: `snake_case`（DB標準）
- Dexie/TypeScript: `camelCase`（JS標準）
- Phase 3で変換ユーティリティを実装予定

### 4. ingredients / steps のjsonb保存
- 正規化（別テーブル化）しない
- 理由: レシピ内の個別材料をDBクエリで検索する要件がない。アプリ側でFuse.jsによる全文検索を使用している

### 5. Supabase未設定時の動作
- `supabase.ts`が`null`を返す → アプリは完全オフラインで動作継続
- Phase 2-3が完了するまで、既存機能に一切影響しない
