export const MCP_SERVER_INFO = {
  name: 'kitchen-mcp-server',
  version: '0.2.0',
} as const

export const MCP_SERVER_INSTRUCTIONS = [
  'Use prompts and resources as the primary interface for kitchen context.',
  'Use resources for read-only kitchen state and tools only for active computation.',
  'When a prompt links resources, read those resources before answering.',
  'If required kitchen data is missing, state what is missing instead of inventing it.',
].join(' ')

export const RESOURCE_DOCS_URI = 'kitchen://docs/resources'
export const SERVICE_INFO_URI = 'kitchen://service/info'
export const CURRENT_WEEK_INFO_URI = 'kitchen://menu/current-week'
export const STOCK_RESOURCE_TEMPLATE = 'kitchen://stock/{userId}'
export const TODAY_MENU_RESOURCE_TEMPLATE = 'kitchen://menu/today/{userId}'
export const WEEKLY_MENU_RESOURCE_TEMPLATE = 'kitchen://menu/weekly/{userId}/{weekStartDate}'
export const SHOPPING_LIST_RESOURCE_TEMPLATE =
  'kitchen://shopping-list/{userId}/{weekStartDate}'

export const KITCHEN_ADVICE_PROMPT = 'kitchen_advice'
export const WEEKLY_MENU_REVIEW_PROMPT = 'weekly_menu_review'

export function buildStockResourceUri(userId: string): string {
  return `kitchen://stock/${encodeURIComponent(userId)}`
}

export function buildTodayMenuResourceUri(userId: string): string {
  return `kitchen://menu/today/${encodeURIComponent(userId)}`
}

export function buildWeeklyMenuResourceUri(userId: string, weekStartDate: string): string {
  return `kitchen://menu/weekly/${encodeURIComponent(userId)}/${encodeURIComponent(weekStartDate)}`
}

export function buildShoppingListResourceUri(userId: string, weekStartDate: string): string {
  return `kitchen://shopping-list/${encodeURIComponent(userId)}/${encodeURIComponent(weekStartDate)}`
}
