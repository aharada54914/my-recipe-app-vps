# Discord Client E2E Harness

## Purpose
- Automate the real Discord Web client with Playwright.
- Verify slash commands, thread creation, buttons, and modals from the user's point of view.
- Keep this harness isolated from production by using a dedicated test guild and channels.

## Scope
- Current scenarios:
  - help channel visibility
  - `/help`
  - weekly-menu channel guidance
  - `/plan-week`
  - thread creation
  - replacement modal
  - `同じ主材料を避ける` input path
  - `/import-url`
  - recipe-import review thread controls
  - `/analyze-photo`
  - stock-photo review thread controls
  - stock save modal visibility

## Required environment variables

```bash
DISCORD_E2E_ENABLED=1
DISCORD_E2E_STORAGE_STATE=/absolute/path/to/discord-user.json
DISCORD_E2E_GUILD_ID=...
DISCORD_E2E_HELP_CHANNEL_ID=...
DISCORD_E2E_WEEKLY_MENU_CHANNEL_ID=...
DISCORD_E2E_STOCK_PHOTO_CHANNEL_ID=...
DISCORD_E2E_RECIPE_IMPORT_CHANNEL_ID=...
DISCORD_E2E_KITCHEN_ADVICE_CHANNEL_ID=...
DISCORD_E2E_RECIPE_IMPORT_URL=https://example.com/supported-recipe
DISCORD_E2E_STOCK_PHOTO_IMAGE_PATH=/absolute/path/to/test-fridge.jpg
DISCORD_E2E_STOCK_PHOTO_AUTOMATION=1
DISCORD_E2E_STOCK_PHOTO_EXPECT_SUCCESS=1
# optional: only needed when you want to submit the save modal too
DISCORD_E2E_STOCK_PHOTO_SAVE_LINES=create,玉ねぎ,,2,個,2026-03-28,2026-04-02
```

## Storage state
- Use a dedicated Discord test user.
- Save Playwright `storageState` outside the repo if possible.
- The default path is `apps/discord-bot/tests/e2e/.auth/discord-user.json`.
- Do not commit a real Discord session file.

## Commands

```bash
npm --workspace apps/discord-bot run test:e2e:list
npm --workspace apps/discord-bot run test:e2e
npm --workspace apps/discord-bot run test:e2e:headed
```

## Test guild guidance
- Create a dedicated guild for E2E only.
- Bind these channels:
  - `how-to-use-e2e`
  - `recipe-import-e2e`
  - `weekly-menu-e2e`
  - `stock-photo-e2e`
  - `kitchen-advice-e2e`
- Run `/sync-help` once after binding.

## Operating model
- This harness is intended for manual runs or nightly jobs.
- Do not point it at the production guild.
- Keep Google Calendar cleanup enabled for any scenario that creates calendar events.

## Extension points
- Add kitchen-advice and full stock save assertions under `apps/discord-bot/tests/e2e/`.
- Reuse the page objects instead of duplicating Discord DOM selectors.
- `stock-photo` は Discord の attachment-option command UI が特殊なので、実行時は `DISCORD_E2E_STOCK_PHOTO_AUTOMATION=1` を明示してください。
- Gemini quota が無い環境では `DISCORD_E2E_STOCK_PHOTO_EXPECT_SUCCESS` を付けず、まず command automation だけを有効化して目視確認する運用を推奨します。
- quota が無い場合でも、slash command の送信と `写真解析に失敗しました:` の表示までは自動検証できます。
