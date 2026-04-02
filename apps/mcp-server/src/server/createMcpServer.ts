import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js'
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  CURRENT_WEEK_INFO_URI,
  KITCHEN_ADVICE_PROMPT,
  MCP_SERVER_INFO,
  MCP_SERVER_INSTRUCTIONS,
  RESOURCE_DOCS_URI,
  SERVICE_INFO_URI,
  SHOPPING_LIST_RESOURCE_TEMPLATE,
  STOCK_RESOURCE_TEMPLATE,
  TODAY_MENU_RESOURCE_TEMPLATE,
  WEEKLY_MENU_RESOURCE_TEMPLATE,
  WEEKLY_MENU_REVIEW_PROMPT,
} from '../contract.js'
import { type LoggerLike, getErrorMessage, withLoggedOperation } from '../logger.js'
import { buildKitchenAdvicePrompt, kitchenAdvicePromptArgs } from '../prompts/kitchenAdvice.js'
import {
  buildWeeklyMenuReviewPrompt,
  weeklyMenuReviewPromptArgs,
} from '../prompts/weeklyMenuReview.js'
import { readCurrentWeekResource } from '../resources/currentWeek.js'
import { readResourceDocs } from '../resources/docs.js'
import { readServiceInfoResource } from '../resources/serviceInfo.js'
import { readShoppingListResource } from '../resources/shoppingList.js'
import { readStockResource } from '../resources/stock.js'
import { readTodayMenuResource } from '../resources/todayMenu.js'
import { readWeeklyMenuResource } from '../resources/weeklyMenu.js'
import { searchRecipes, searchRecipesInputSchema, type SearchRecipesInput } from '../tools/recipes.js'

export interface KitchenMcpDependencies {
  searchRecipes(input: SearchRecipesInput): Promise<string>
  readStockResource(userId: string): Promise<string>
  readTodayMenuResource(userId: string): Promise<string>
  readShoppingListResource(userId: string, weekStartDate: string): Promise<string>
  readWeeklyMenuResource(userId: string, weekStartDate: string): Promise<string>
  readResourceDocs(): string
}

export interface CreateMcpServerOptions {
  logger: LoggerLike
  dependencies?: Partial<KitchenMcpDependencies>
}

const DEFAULT_DEPENDENCIES: KitchenMcpDependencies = {
  async searchRecipes(input) {
    return searchRecipes(input)
  },
  readStockResource,
  readTodayMenuResource,
  readShoppingListResource,
  readWeeklyMenuResource,
  readResourceDocs,
}

function expectStringVariable(variables: Variables, key: string): string {
  const value = variables[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing resource variable: ${key}`)
  }
  return value
}

function createToolErrorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

export function createMcpServer(options: CreateMcpServerOptions): McpServer {
  const logger = options.logger
  const dependencies: KitchenMcpDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...options.dependencies,
  }

  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: { logging: {} },
    instructions: MCP_SERVER_INSTRUCTIONS,
  })

  server.registerTool(
    'search_recipes',
    {
      title: 'Recipe Search',
      description: 'Search recipes by keyword, category, or device and return matching recipes as JSON.',
      inputSchema: searchRecipesInputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args, extra) => {
      try {
        return await withLoggedOperation(
          logger,
          {
            kind: 'tool',
            name: 'search_recipes',
            requestId: extra.requestId,
            sessionId: extra.sessionId,
          },
          async () => ({
            content: [{ type: 'text', text: await dependencies.searchRecipes(args) }],
          }),
        )
      } catch (error) {
        return createToolErrorResult(`Error searching recipes: ${getErrorMessage(error)}`)
      }
    },
  )

  server.registerResource(
    'resource-docs',
    RESOURCE_DOCS_URI,
    {
      title: 'Kitchen Resource Guide',
      description: 'Discovery document for resource templates and prompts exposed by this MCP server.',
      mimeType: 'text/markdown',
    },
    async (uri, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'resource',
          name: 'resource-docs',
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => ({
          contents: [{ uri: uri.toString(), mimeType: 'text/markdown', text: dependencies.readResourceDocs() }],
        }),
      ),
  )

  server.registerResource(
    'service-info',
    SERVICE_INFO_URI,
    {
      title: 'Kitchen MCP Service Info',
      description: 'Static service metadata for MCP clients.',
      mimeType: 'application/json',
    },
    async (uri, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'resource',
          name: 'service-info',
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => ({
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: readServiceInfoResource(),
            },
          ],
        }),
      ),
  )

  server.registerResource(
    'current-week-info',
    CURRENT_WEEK_INFO_URI,
    {
      title: 'Current Week Info',
      description: 'Current week metadata used by weekly-menu resources.',
      mimeType: 'application/json',
    },
    async (uri, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'resource',
          name: 'current-week-info',
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => ({
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: readCurrentWeekResource(),
            },
          ],
        }),
      ),
  )

  server.registerResource(
    'stock-by-user',
    new ResourceTemplate(STOCK_RESOURCE_TEMPLATE, { list: undefined }),
    {
      title: 'Current Stock',
      description: 'Current in-stock ingredients for a user.',
      mimeType: 'application/json',
    },
    async (uri, variables, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'resource',
          name: 'stock-by-user',
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => ({
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: await dependencies.readStockResource(expectStringVariable(variables, 'userId')),
            },
          ],
        }),
      ),
  )

  server.registerResource(
    'today-menu-by-user',
    new ResourceTemplate(TODAY_MENU_RESOURCE_TEMPLATE, { list: undefined }),
    {
      title: 'Today Menu',
      description: 'Today menu snapshot for a user.',
      mimeType: 'application/json',
    },
    async (uri, variables, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'resource',
          name: 'today-menu-by-user',
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => ({
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: await dependencies.readTodayMenuResource(expectStringVariable(variables, 'userId')),
            },
          ],
        }),
      ),
  )

  server.registerResource(
    'shopping-list-by-user-week',
    new ResourceTemplate(SHOPPING_LIST_RESOURCE_TEMPLATE, { list: undefined }),
    {
      title: 'Shopping List by Week',
      description: 'Shopping list snapshot for a user and week.',
      mimeType: 'application/json',
    },
    async (uri, variables, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'resource',
          name: 'shopping-list-by-user-week',
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => ({
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: await dependencies.readShoppingListResource(
                expectStringVariable(variables, 'userId'),
                expectStringVariable(variables, 'weekStartDate'),
              ),
            },
          ],
        }),
      ),
  )

  server.registerResource(
    'weekly-menu-by-user-week',
    new ResourceTemplate(WEEKLY_MENU_RESOURCE_TEMPLATE, { list: undefined }),
    {
      title: 'Weekly Menu by Week',
      description: 'Weekly menu snapshot for a user and week.',
      mimeType: 'application/json',
    },
    async (uri, variables, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'resource',
          name: 'weekly-menu-by-user-week',
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => ({
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: await dependencies.readWeeklyMenuResource(
                expectStringVariable(variables, 'userId'),
                expectStringVariable(variables, 'weekStartDate'),
              ),
            },
          ],
        }),
      ),
  )

  server.registerPrompt(
    KITCHEN_ADVICE_PROMPT,
    {
      title: 'Kitchen Advice',
      description: 'Structured cooking advice prompt linked to live kitchen resources.',
      argsSchema: kitchenAdvicePromptArgs,
    },
    async (args, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'prompt',
          name: KITCHEN_ADVICE_PROMPT,
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => buildKitchenAdvicePrompt(args),
      ),
  )

  server.registerPrompt(
    WEEKLY_MENU_REVIEW_PROMPT,
    {
      title: 'Weekly Menu Review',
      description: 'Structured weekly-menu review prompt linked to shopping and menu resources.',
      argsSchema: weeklyMenuReviewPromptArgs,
    },
    async (args, extra) =>
      withLoggedOperation(
        logger,
        {
          kind: 'prompt',
          name: WEEKLY_MENU_REVIEW_PROMPT,
          requestId: extra.requestId,
          sessionId: extra.sessionId,
        },
        async () => buildWeeklyMenuReviewPrompt(args),
      ),
  )

  return server
}
