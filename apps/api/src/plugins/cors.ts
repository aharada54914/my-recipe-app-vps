import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'

export async function registerCors(app: FastifyInstance): Promise<void> {
  const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173'

  await app.register(cors, {
    origin: [frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
}
