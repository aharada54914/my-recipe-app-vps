import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import {
  CURRENT_WEEK_INFO_URI,
  KITCHEN_ADVICE_PROMPT,
  RESOURCE_DOCS_URI,
  SERVICE_INFO_URI,
  SHOPPING_LIST_RESOURCE_TEMPLATE,
  STOCK_RESOURCE_TEMPLATE,
  TODAY_MENU_RESOURCE_TEMPLATE,
  WEEKLY_MENU_RESOURCE_TEMPLATE,
  WEEKLY_MENU_REVIEW_PROMPT,
} from '../contract.js'

export function readServiceInfoResource(): string {
  return JSON.stringify(
    {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      transport: 'streamable-http',
      capabilities: {
        tools: ['search_recipes'],
        prompts: [KITCHEN_ADVICE_PROMPT, WEEKLY_MENU_REVIEW_PROMPT],
        resources: [
          RESOURCE_DOCS_URI,
          SERVICE_INFO_URI,
          CURRENT_WEEK_INFO_URI,
          STOCK_RESOURCE_TEMPLATE,
          TODAY_MENU_RESOURCE_TEMPLATE,
          WEEKLY_MENU_RESOURCE_TEMPLATE,
          SHOPPING_LIST_RESOURCE_TEMPLATE,
        ],
      },
    },
    null,
    2,
  )
}
