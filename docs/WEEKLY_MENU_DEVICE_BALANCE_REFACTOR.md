# Weekly Menu Device Balance Refactor (Before / After)

## Before

- Candidate pool was built from a contiguous window: `offset(random).limit(200)`.
- With current recipe distribution (`hotcook: 350`, `healsio: 1372`), this frequently sampled mostly healsio records.
- Device diversity was only a weak local adjustment (`+3` for alternation, mild penalties), so weekly outputs could still collapse to healsio-heavy menus.

## After

- Candidate pool now loads all recipes and shuffles the eligible set before scoring.
- Main-dish selection now uses explicit per-device targets (`hotcook` / `healsio` / `manual`) with:
  - deficit bonus (when a device is under target),
  - over-target penalty (when a device is overrepresented).
- Existing category diversity and stock/seasonal scoring remain active.

## Refactor structure

1. `buildSelectionContext` – data loading + eligibility filtering + base scoring.
2. `buildMainDeviceTargets` – derive 7-day target counts by available inventory and locked-day carry-over.
3. Main selection loop – combines base score + category diversity + device-balance score.
4. Side selection loop – unchanged pairing logic with genre/heaviness adjustments.

## Why this is safer

- Device balance is now encoded as a first-class rule instead of incidental alternation.
- Target calculation respects locked items and available counts, so it degrades gracefully when one device has insufficient recipes.
- The change is test-backed (`weeklyMenuSelector.test.ts`) with an imbalance scenario to prevent regression.
