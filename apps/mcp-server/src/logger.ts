import pino from 'pino'

export interface LoggerLike {
  info(bindings: Record<string, unknown>, message?: string): void
  warn(bindings: Record<string, unknown>, message?: string): void
  error(bindings: Record<string, unknown>, message?: string): void
}

export function createLogger(): LoggerLike {
  return pino({
    name: 'kitchen-mcp-server',
    level: process.env['LOG_LEVEL'] ?? 'info',
    base: {
      service: 'mcp-server',
    },
    redact: {
      paths: ['req.headers.authorization'],
      remove: true,
    },
  })
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function withLoggedOperation<T>(
  logger: LoggerLike,
  metadata: {
    kind: 'http' | 'tool' | 'prompt' | 'resource'
    name: string
    requestId?: string | number
    sessionId?: string
  },
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()

  try {
    const result = await operation()
    logger.info(
      {
        ...metadata,
        latency_ms: Date.now() - startedAt,
        status: 'ok',
      },
      'mcp operation succeeded',
    )
    return result
  } catch (error) {
    logger.error(
      {
        ...metadata,
        latency_ms: Date.now() - startedAt,
        status: 'error',
        error_message: getErrorMessage(error),
      },
      'mcp operation failed',
    )
    throw error
  }
}

export async function logTimedOperation<T>(
  logger: LoggerLike,
  metadata: {
    kind: 'http' | 'tool' | 'prompt' | 'resource'
    name: string
    requestId?: string | number
    sessionId?: string
  },
  operation: () => Promise<T>,
): Promise<T> {
  return withLoggedOperation(logger, metadata, operation)
}
