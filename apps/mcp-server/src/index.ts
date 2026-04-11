import { createLogger } from './logger.js'
import { createHttpServer } from './server/createHttpServer.js'

const logger = createLogger()
const port = Number(process.env['MCP_PORT'] ?? 3002)
const authToken = process.env['MCP_AUTH_TOKEN'] ?? ''

const server = createHttpServer({
  authToken,
  port,
  logger,
})

server.listen(port, () => {
  logger.info(
    {
      port,
      path: '/mcp',
    },
    'MCP server listening',
  )
})

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down MCP server')
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal).finally(() => process.exit(0))
  })
}
