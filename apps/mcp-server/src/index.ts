import http from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { searchRecipes, searchRecipesInputSchema } from './tools/recipes.js'
import { getStock, getStockInputSchema } from './tools/stock.js'
import { getWeeklyMenu, getWeeklyMenuInputSchema } from './tools/weeklyMenu.js'
import { askKitchen, askKitchenInputSchema } from './tools/consultation.js'
import { getShoppingList, getShoppingListInputSchema } from './tools/shoppingList.js'

const server = new Server(
  { name: 'kitchen-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_recipes',
        description: 'Search recipes by title keyword, category, or device (hotcook/healsio/manual). Returns a list of matching recipes.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Title keyword to search for (case-insensitive partial match)',
            },
            category: {
              type: 'string',
              description: 'Recipe category to filter by',
            },
            device: {
              type: 'string',
              description: 'Cooking device to filter by: hotcook, healsio, or manual',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 50)',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_stock',
        description: 'Get the current in-stock ingredients for a user.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            userId: {
              type: 'string',
              description: "The user's ID (Google sub)",
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'get_weekly_menu',
        description: 'Get the weekly menu. If weekStartDate is omitted, returns the most recently updated menu. If provided (YYYY-MM-DD, must be a Monday), returns the menu for that week. Recipe titles are included alongside IDs.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            weekStartDate: {
              type: 'string',
              description: 'The Monday of the target week in YYYY-MM-DD format. If omitted, the most recently updated menu is returned.',
            },
          },
          required: [],
        },
      },
      {
        name: 'ask_kitchen',
        description: 'Ask the kitchen assistant a cooking-related question. The assistant is aware of the user\'s current stock and today\'s menu, and answers in Japanese.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            message: {
              type: 'string',
              description: 'The question or request to send to the kitchen assistant',
            },
            userId: {
              type: 'string',
              description: "The user's ID (Google sub) used to look up stock and preferences",
            },
          },
          required: ['message', 'userId'],
        },
      },
      {
        name: 'get_shopping_list',
        description: 'Get the shopping list for a specific week. Returns the pre-generated shopping list if available, otherwise indicates it has not been generated yet.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            weekStartDate: {
              type: 'string',
              description: 'The Monday of the target week in YYYY-MM-DD format',
            },
          },
          required: ['weekStartDate'],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'search_recipes') {
    const parsed = searchRecipesInputSchema.safeParse(args ?? {})
    if (!parsed.success) {
      return {
        content: [{ type: 'text' as const, text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      }
    }
    try {
      const result = await searchRecipes(parsed.data)
      return { content: [{ type: 'text' as const, text: result }] }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text' as const, text: `Error searching recipes: ${message}` }],
        isError: true,
      }
    }
  }

  if (name === 'get_stock') {
    const parsed = getStockInputSchema.safeParse(args ?? {})
    if (!parsed.success) {
      return {
        content: [{ type: 'text' as const, text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      }
    }
    try {
      const result = await getStock(parsed.data)
      return { content: [{ type: 'text' as const, text: result }] }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text' as const, text: `Error fetching stock: ${message}` }],
        isError: true,
      }
    }
  }

  if (name === 'get_weekly_menu') {
    const parsed = getWeeklyMenuInputSchema.safeParse(args ?? {})
    if (!parsed.success) {
      return {
        content: [{ type: 'text' as const, text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      }
    }
    try {
      const result = await getWeeklyMenu(parsed.data)
      return { content: [{ type: 'text' as const, text: result }] }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text' as const, text: `Error fetching weekly menu: ${message}` }],
        isError: true,
      }
    }
  }

  if (name === 'ask_kitchen') {
    const parsed = askKitchenInputSchema.safeParse(args ?? {})
    if (!parsed.success) {
      return {
        content: [{ type: 'text' as const, text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      }
    }
    try {
      const result = await askKitchen(parsed.data)
      return { content: [{ type: 'text' as const, text: result }] }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text' as const, text: `Error asking kitchen assistant: ${message}` }],
        isError: true,
      }
    }
  }

  if (name === 'get_shopping_list') {
    const parsed = getShoppingListInputSchema.safeParse(args ?? {})
    if (!parsed.success) {
      return {
        content: [{ type: 'text' as const, text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      }
    }
    try {
      const result = await getShoppingList(parsed.data)
      return { content: [{ type: 'text' as const, text: result }] }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text' as const, text: `Error fetching shopping list: ${message}` }],
        isError: true,
      }
    }
  }

  return {
    content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
    isError: true,
  }
})

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN
const PORT = Number(process.env.MCP_PORT ?? 3002)

const transports = new Map<string, SSEServerTransport>()

function checkAuth(req: http.IncomingMessage): boolean {
  const auth = req.headers.authorization ?? ''
  return auth === `Bearer ${MCP_AUTH_TOKEN}`
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // Health check is public (used by docker-compose healthcheck)
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (!MCP_AUTH_TOKEN || !checkAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  if (req.method === 'GET' && url.pathname === '/mcp/sse') {
    const transport = new SSEServerTransport('/mcp/message', res)
    transports.set(transport.sessionId, transport)
    transport.onclose = () => transports.delete(transport.sessionId)
    await server.connect(transport)
    return
  }

  if (req.method === 'POST' && url.pathname === '/mcp/message') {
    const sessionId = url.searchParams.get('sessionId') ?? ''
    const transport = transports.get(sessionId)
    if (!transport) {
      res.writeHead(404)
      res.end('Session not found')
      return
    }
    await transport.handlePostMessage(req, res)
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

httpServer.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`)
})
