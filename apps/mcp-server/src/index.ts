import { randomUUID } from 'node:crypto'
import http from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { searchRecipes, searchRecipesInputSchema } from './tools/recipes.js'
import { getStock, getStockInputSchema } from './tools/stock.js'
import { getWeeklyMenu, getWeeklyMenuInputSchema } from './tools/weeklyMenu.js'
import { askKitchen, askKitchenInputSchema } from './tools/consultation.js'
import { getShoppingList, getShoppingListInputSchema } from './tools/shoppingList.js'

function createMcpServer(): Server {
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

  return server
}

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN
const PORT = Number(process.env.MCP_PORT ?? 3002)

// Map of sessionId → transport (Streamable HTTP is stateful per session)
const sessions = new Map<string, StreamableHTTPServerTransport>()

function checkAuth(req: http.IncomingMessage): boolean {
  const auth = req.headers.authorization ?? ''
  return auth === `Bearer ${MCP_AUTH_TOKEN}`
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString()
        resolve(raw ? JSON.parse(raw) : undefined)
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', reject)
  })
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // Health check is public (used by docker-compose healthcheck)
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/mcp/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (!MCP_AUTH_TOKEN || !checkAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  if (url.pathname === '/mcp') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // Route to existing session
    if (sessionId) {
      const transport = sessions.get(sessionId)
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Session not found' }))
        return
      }
      const body = req.method === 'POST' ? await readBody(req) : undefined
      await transport.handleRequest(req, res, body)
      return
    }

    // New session: create a dedicated Server + Transport pair
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    })

    const server = createMcpServer()

    transport.onclose = () => {
      const sid = transport.sessionId
      if (sid) sessions.delete(sid)
    }

    await server.connect(transport)

    const body = req.method === 'POST' ? await readBody(req) : undefined
    await transport.handleRequest(req, res, body)

    // Register session after transport.handleRequest assigns the session ID
    const sid = transport.sessionId
    if (sid) sessions.set(sid, transport)

    return
  }

  res.writeHead(404)
  res.end('Not found')
})

httpServer.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`)
})
