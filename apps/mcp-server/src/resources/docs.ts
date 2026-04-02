import {
  KITCHEN_ADVICE_PROMPT,
  RESOURCE_DOCS_URI,
  SHOPPING_LIST_RESOURCE_TEMPLATE,
  STOCK_RESOURCE_TEMPLATE,
  TODAY_MENU_RESOURCE_TEMPLATE,
  WEEKLY_MENU_RESOURCE_TEMPLATE,
  WEEKLY_MENU_REVIEW_PROMPT,
} from '../contract.js'

export function readResourceDocs(): string {
  return [
    '# Kitchen MCP Resources',
    '',
    '## Purpose',
    'This server exposes kitchen state primarily through MCP resources and prompts.',
    '',
    '## Static Resource',
    `- ${RESOURCE_DOCS_URI}`,
    '',
    '## Resource Templates',
    `- ${STOCK_RESOURCE_TEMPLATE}`,
    `- ${TODAY_MENU_RESOURCE_TEMPLATE}`,
    `- ${WEEKLY_MENU_RESOURCE_TEMPLATE}`,
    `- ${SHOPPING_LIST_RESOURCE_TEMPLATE}`,
    '',
    '## Prompts',
    `- ${KITCHEN_ADVICE_PROMPT}`,
    `- ${WEEKLY_MENU_REVIEW_PROMPT}`,
    '',
    '## Notes',
    '- Read the linked resources before answering prompt requests.',
    '- Use tools only for active computation such as recipe search.',
    '- User IDs are part of the URI contract in this deployment.',
  ].join('\n')
}
