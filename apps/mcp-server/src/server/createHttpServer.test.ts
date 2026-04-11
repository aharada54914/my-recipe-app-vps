import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { LoggerLike } from '../logger.js'
import { createHttpServer, getServerPort } from './createHttpServer.js'

function createTestLogger(): LoggerLike {
  return {
    info() {},
    warn() {},
    error() {},
  }
}

describe('createHttpServer', () => {
  const servers: Array<ReturnType<typeof createHttpServer>> = []
  const transports: StreamableHTTPClientTransport[] = []
  const clients: Client[] = []

  afterEach(async () => {
    await Promise.allSettled(clients.map(async (client) => client.close()))
    await Promise.allSettled(transports.map(async (transport) => transport.close()))
    await Promise.allSettled(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve())
          }),
      ),
    )
    clients.length = 0
    transports.length = 0
    servers.length = 0
  })

  it('serves prompts, resources, templates, and tools over Streamable HTTP', async () => {
    const server = createHttpServer({
      authToken: 'test-token',
      port: 0,
      logger: createTestLogger(),
      dependencies: {
        async searchRecipes(input) {
          return JSON.stringify([{ id: 1, query: input.query ?? null }], null, 2)
        },
        async readStockResource(userId) {
          return JSON.stringify({ userId, items: [{ name: '玉ねぎ' }] }, null, 2)
        },
        async readTodayMenuResource(userId) {
          return JSON.stringify({ userId, item: { recipeTitle: 'カレー' } }, null, 2)
        },
        async readWeeklyMenuResource(userId, weekStartDate) {
          return JSON.stringify({ userId, weekStartDate, items: [{ recipeTitle: 'カレー' }] }, null, 2)
        },
        async readShoppingListResource(userId, weekStartDate) {
          return JSON.stringify({ userId, weekStartDate, shoppingList: 'にんじん' }, null, 2)
        },
        readResourceDocs() {
          return '# test docs'
        },
      },
    })
    servers.push(server)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const port = getServerPort(server)
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: {
        headers: {
          authorization: 'Bearer test-token',
        },
      },
    })
    transports.push(transport)

    const client = new Client({
      name: 'mcp-server-test-client',
      version: '1.0.0',
    })
    clients.push(client)

    await client.connect(transport)

    const tools = await client.listTools()
    expect(tools.tools.map((tool) => tool.name)).toEqual(['search_recipes'])

    const toolResult = await client.callTool({
      name: 'search_recipes',
      arguments: { query: 'curry' },
    })
    expect(toolResult.content[0]).toMatchObject({
      type: 'text',
    })
    if (toolResult.content[0]?.type !== 'text') {
      throw new Error('expected text tool result')
    }
    expect(toolResult.content[0].text).toContain('curry')

    const prompts = await client.listPrompts()
    expect(prompts.prompts.map((prompt) => prompt.name)).toEqual([
      'kitchen_advice',
      'weekly_menu_review',
    ])

    const kitchenPrompt = await client.getPrompt({
      name: 'kitchen_advice',
      arguments: {
        userId: 'user-123',
        question: '何を作る？',
      },
    })
    expect(kitchenPrompt.messages).toHaveLength(3)
    expect(kitchenPrompt.messages[1]?.content).toMatchObject({
      type: 'resource_link',
      uri: 'kitchen://stock/user-123',
    })

    const resources = await client.listResources()
    expect(resources.resources.map((resource) => resource.uri).sort()).toEqual([
      'kitchen://docs/resources',
      'kitchen://menu/current-week',
      'kitchen://service/info',
    ])

    const templates = await client.listResourceTemplates()
    expect(templates.resourceTemplates.map((template) => template.uriTemplate).sort()).toEqual([
      'kitchen://menu/today/{userId}',
      'kitchen://menu/weekly/{userId}/{weekStartDate}',
      'kitchen://shopping-list/{userId}/{weekStartDate}',
      'kitchen://stock/{userId}',
    ])

    const docsResource = await client.readResource({
      uri: 'kitchen://docs/resources',
    })
    expect(docsResource.contents[0]).toMatchObject({
      uri: 'kitchen://docs/resources',
      text: '# test docs',
    })

    const stockResource = await client.readResource({
      uri: 'kitchen://stock/user-123',
    })
    expect(stockResource.contents[0]).toMatchObject({
      uri: 'kitchen://stock/user-123',
    })
    if (!('text' in stockResource.contents[0])) {
      throw new Error('expected text resource')
    }
    expect(stockResource.contents[0].text).toContain('玉ねぎ')

    const weeklyMenuResource = await client.readResource({
      uri: 'kitchen://menu/weekly/user-123/2026-03-30',
    })
    expect(weeklyMenuResource.contents[0]).toMatchObject({
      uri: 'kitchen://menu/weekly/user-123/2026-03-30',
    })
    if (!('text' in weeklyMenuResource.contents[0])) {
      throw new Error('expected text resource')
    }
    expect(weeklyMenuResource.contents[0].text).toContain('2026-03-30')

    const serviceInfo = await client.readResource({
      uri: 'kitchen://service/info',
    })
    if (!('text' in serviceInfo.contents[0])) {
      throw new Error('expected text resource')
    }
    expect(serviceInfo.contents[0].text).toContain('streamable-http')
  })

  it('rejects unauthorized MCP requests', async () => {
    const server = createHttpServer({
      authToken: 'test-token',
      port: 0,
      logger: createTestLogger(),
    })
    servers.push(server)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const port = getServerPort(server)
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'unauthorized-test',
            version: '1.0.0',
          },
        },
      }),
    })

    expect(response.status).toBe(401)
  })
})
