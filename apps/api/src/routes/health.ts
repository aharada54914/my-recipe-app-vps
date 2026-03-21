import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/client.ts'

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      reply.send({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: 'connected',
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(503).send({
        success: false,
        error: 'Database connection failed',
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: message,
        },
      })
    }
  })
}
