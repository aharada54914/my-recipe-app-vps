import { randomUUID } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createLogger, type LoggerLike } from '../logger.js'
import { createMcpServer, type CreateMcpServerOptions } from './createMcpServer.js'

export interface CreateHttpServerOptions extends Omit<CreateMcpServerOptions, 'logger'> {
  authToken: string
  port?: number
  logger?: LoggerLike
}

interface SessionEntry {
  transport: StreamableHTTPServerTransport
  server: McpServer
}

function checkAuth(req: http.IncomingMessage, authToken: string): boolean {
  const auth = req.headers.authorization ?? ''
  return auth === `Bearer ${authToken}`
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

export function createHttpServer(options: CreateHttpServerOptions): http.Server {
  const port = options.port ?? Number(process.env['MCP_PORT'] ?? 3002)
  const logger = options.logger ?? createLogger()
  const sessions = new Map<string, SessionEntry>()

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)

    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/mcp/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }

    if (!options.authToken || !checkAuth(req, options.authToken)) {
      logger.warn(
        {
          method: req.method,
          path: url.pathname,
        },
        'unauthorized mcp request rejected',
      )
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const sessionIdHeader = req.headers['mcp-session-id']
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader

    if (sessionId) {
      const existingSession = sessions.get(sessionId)
      if (!existingSession) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Session not found' }))
        return
      }

      const body = req.method === 'POST' ? await readBody(req) : undefined
      await existingSession.transport.handleRequest(req, res, body)
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session ID required' }))
      return
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    })
    const server = createMcpServer({
      logger,
      dependencies: options.dependencies,
    })
    transport.onclose = () => {
      const closedSessionId = transport.sessionId
      if (closedSessionId) {
        sessions.delete(closedSessionId)
      }
    }

    await server.connect(transport)

    const body = req.method === 'POST' ? await readBody(req) : undefined
    await transport.handleRequest(req, res, body)

    const createdSessionId = transport.sessionId
    if (createdSessionId) {
      sessions.set(createdSessionId, { transport, server })
    }
  })

  httpServer.on('close', () => {
    for (const entry of sessions.values()) {
      void entry.server.close()
    }
    sessions.clear()
  })

  return httpServer
}

export function getServerPort(server: http.Server): number {
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Server is not listening on a TCP port')
  }
  return (address as AddressInfo).port
}
