# Search Facet AND Refactor Plan

Last updated: 2026-03-07
Target: search page facet filters

## 1. Goal

Allow the search page buttons to work as combined filters instead of mutually-exclusive presets.

Desired outcome:

- users can narrow results by multiple conditions at once
- filter behavior is predictable on mobile
- search state survives reload and deep links
- current one-tap entry points continue to work

Example:

- `ホットクック` + `時短 30分以内` + `旬を優先` + `主菜`

This should return recipes that satisfy all selected groups.

## 2. Current Findings

Relevant files:

- [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- [recipeFilters.ts](/Users/jrmag/my-recipe-app/src/utils/recipeFilters.ts)
- [recipeSearchModel.ts](/Users/jrmag/my-recipe-app/src/utils/recipeSearchModel.ts)
- [CategoryTags.tsx](/Users/jrmag/my-recipe-app/src/components/CategoryTags.tsx)
- [RecipeListFilters.test.ts](/Users/jrmag/my-recipe-app/src/components/__tests__/RecipeListFilters.test.ts)

### 2.1 Current filter behavior is mutually exclusive across groups

The quick filter buttons currently clear other groups when pressed.

Examples in [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx):

- `device:hotcook` clears categories, quick, seasonal
- `device:healsio` clears categories, quick, seasonal
- `quick` clears categories, device, seasonal
- `seasonal` clears categories, device, quick
- category selection clears device, quick, seasonal

This is why the current UI cannot do AND filtering.

### 2.2 Current search state model is fragmented

Current state lives in separate local states:

- `selectedCategories: RecipeCategory[]`
- `deviceFilter: DeviceType | null`
- `quickFilter: boolean`
- `seasonalFilter: boolean`

This makes the UI logic repetitive and easy to break.

### 2.3 URL model only supports one preset at a time

The page currently reads only one `?filter=` value and initializes state from that single value.

Examples:

- `filter=device:hotcook`
- `filter=quick`
- `filter=seasonal`
- `filter=主菜`

This cannot express combined filters cleanly.

### 2.4 DB prefetch assumes one leading facet

In [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx), `useLiveQuery` fetches:

- by `device` if device filter exists
- else by `category` if categories exist
- else all recipes

That shortcut works only because current facets are mostly exclusive.

### 2.5 The current count model is not facet-aware

[useRecipeSearchModel.ts](/Users/jrmag/my-recipe-app/src/hooks/useRecipeSearchModel.ts) builds category counts from the raw fetched recipe set, not from the current filter context.

If AND filtering is added, users will expect counts to reflect the current narrowing state.

## 3. Important Constraint

Current recipe schema has single-value fields for:

- `device`
- `category`

That means these combinations are impossible as strict AND:

- `ホットクック AND ヘルシオ`
- `主菜 AND スープ`

So the correct semantics are:

- AND across different facet groups
- OR within the same facet group

Recommended interpretation:

- `ホットクック + 時短 + 旬 + 主菜`
  - AND
- `ホットクック + ヘルシオ`
  - OR inside the device facet
- `主菜 + 副菜`
  - OR inside the category facet

## 4. Product Semantics To Adopt

### 4.1 Facet groups

Split the current buttons into these groups:

1. `機種`
2. `条件`
3. `カテゴリ`

Suggested facet state:

```ts
type RecipeSearchFacetState = {
  devices: DeviceType[]
  categories: RecipeCategory[]
  quick: boolean
  seasonal: boolean
}
```

### 4.2 Filter semantics

- `devices`: OR within the device facet
- `categories`: OR within the category facet
- `quick`: AND with all active facets
- `seasonal`: AND with all active facets
- text query: AND with all active facets

### 4.3 UX semantics

- tapping a selected button toggles it off
- `すべて` clears only the category facet
- there should be a visible `すべて解除` action
- active filters should be shown as removable chips

## 5. Refactor Strategy

### Phase 1: Normalize filter state

Create a single source of truth for facet state.

Recommended new module:

- `src/utils/searchFacets.ts`

Responsibilities:

- state shape definitions
- toggle helpers
- URL encode/decode helpers
- active chip builders
- legacy `?filter=` migration

Key refactor:

- remove ad hoc resets from [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- move all rules into pure helpers

### Phase 2: Centralize filter evaluation

Refactor [recipeFilters.ts](/Users/jrmag/my-recipe-app/src/utils/recipeFilters.ts) to accept the normalized facet state.

Suggested API:

```ts
applyRecipeFacetFilters(recipes, {
  devices,
  categories,
  quick,
  seasonal,
})
```

Rules:

- device facet: `devices.length === 0 || devices.includes(recipe.device)`
- category facet: `categories.length === 0 || categories.includes(recipe.category)`
- quick: `recipe.totalTimeMinutes <= 30`
- seasonal: existing seasonal predicate

### Phase 3: Simplify data flow in the search page

Because the app currently has about 1,700 recipes, the safest approach is:

- fetch all recipes in the search page
- apply fuzzy search and facets in memory

Reason:

- avoids mismatches between prefetch and active filter state
- removes device-vs-category branching
- keeps the logic easier to test

If performance regresses later, optimize from measurements.

Do not optimize prematurely around IndexedDB filtering in this tranche.

### Phase 4: Upgrade URL schema

Recommended new query params:

- `q=...`
- `devices=hotcook,healsio`
- `categories=主菜,副菜`
- `quick=1`
- `seasonal=1`

Backward compatibility:

- continue to accept old `?filter=...`
- convert old param to the new facet state on first load

Examples:

- old: `/search?filter=device:hotcook`
- new internal state: `devices=['hotcook']`

### Phase 5: Rebuild the search UI around facet groups

Recommended UI changes in [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx):

1. Add group labels:
   - `機種`
   - `条件`
   - `カテゴリ`
2. Keep buttons visually grouped, not mixed as one flat row
3. Add active facet chips below the groups
4. Add `すべて解除`
5. Change the summary badge from `絞り込み中` to something more informative:
   - `3条件で絞り込み中`

### Phase 6: Make counts facet-aware

Current category counts are raw totals.

Recommended behavior:

- category counts should reflect current filters except the category facet itself
- optionally device counts should reflect current filters except the device facet itself

This gives users confidence before tapping.

This can be a second tranche if needed, but it is high-value UX.

## 6. Recommended Interaction Design

### 6.1 Devices

Buttons:

- `ホットクック`
- `ヘルシオ`

Behavior:

- multi-select allowed
- treated as OR inside device facet

### 6.2 Conditions

Buttons:

- `時短 30分以内`
- `旬を優先`

Behavior:

- independent toggles
- treated as AND with everything else

### 6.3 Categories

Buttons:

- `すべて`
- `主菜`
- `副菜`
- `スープ`
- `一品料理`
- `スイーツ`

Behavior:

- `すべて` clears category facet
- specific categories can be multi-select
- multi-select is OR within category facet

### 6.4 Active chips

Show removable chips like:

- `ホットクック`
- `時短30分`
- `旬`
- `主菜`

Each chip should support one-tap removal.

## 7. Edge Cases

### 7.1 Zero-result states

When combinations are too narrow:

- show zero-state text
- offer `条件を1つ外す`
- offer `すべて解除`

### 7.2 Deep links

Opening a URL with multiple facets should:

- render the correct active buttons
- preserve state after reload
- not clear unrelated facets on the first user tap

### 7.3 History and recent viewed blocks

These should remain hidden when:

- any text query exists
- any facet is active

This behavior can stay as-is.

## 8. Test Plan

### Unit tests

Expand [RecipeListFilters.test.ts](/Users/jrmag/my-recipe-app/src/components/__tests__/RecipeListFilters.test.ts):

1. `device + quick` works as AND
2. `device + seasonal` works as AND
3. `device + category + quick + seasonal` works as AND
4. multiple categories are OR
5. multiple devices are OR
6. `すべて` clears only category facet

Add new pure tests for:

- URL parse/serialize
- legacy `?filter=` migration
- active chip generation

### Component tests

Add tests for [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx):

1. selecting `ホットクック` does not clear `時短`
2. selecting `旬を優先` does not clear category
3. removing one chip preserves the others
4. `すべて解除` clears all facets

### Smoke tests

Add Playwright coverage:

1. open `/search`
2. select `ホットクック`
3. select `時短 30分以内`
4. select `主菜`
5. verify result cards all satisfy those conditions
6. reload and verify state persists

### Visual tests

Add one search snapshot with multiple active chips in dark theme.

## 9. Implementation Order

### PR-1: Filter state + pure logic

- add normalized facet state module
- refactor filter evaluator
- add unit tests

### PR-2: Search page state + URL sync

- update `RecipeList`
- remove mutually-exclusive reset behavior
- support legacy URL migration
- add component tests

### PR-3: UI polish

- grouped facet rows
- active chips
- clear-all
- improved empty state
- visual test

### PR-4: Facet-aware counts

- category counts under current filter context
- optional device counts
- smoke refinements

## 10. Risks

### Risk 1: Users may expect strict AND everywhere

Mitigation:

- label filters by group
- avoid implying that same-group multi-select is AND
- if needed, add short helper text:
  - `カテゴリ内は複数選択可`

### Risk 2: Search and filters may drift again

Mitigation:

- move all facet rules into pure functions
- stop encoding filter rules directly in button handlers

### Risk 3: URL compatibility could break entry points

Mitigation:

- keep `?filter=` backward-compatible
- add migration tests
- keep [CategoryGrid.tsx](/Users/jrmag/my-recipe-app/src/components/CategoryGrid.tsx) links working during the transition

## 11. Recommended Default Decision

Recommended product decision for this tranche:

- AND across groups
- OR within group
- keep the current buttons
- regroup them visually
- migrate to normalized facet state

This is the highest-leverage refactor because it improves search power without requiring schema changes to the recipe data model.
