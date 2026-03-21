import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyJwt from '@fastify/jwt'

// Extend FastifyRequest to include user
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; name?: string }
    user: { sub: string; email: string; name?: string }
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  const jwtSecret = process.env['JWT_SECRET']
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required')
  }

  await app.register(fastifyJwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
    },
  })

  // Decorator for protected routes
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: 'Unauthorized: Invalid or expired token',
      })
    }
  })
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
