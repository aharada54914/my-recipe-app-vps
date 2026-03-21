import Fastify from 'fastify'
import { registerCors } from './plugins/cors.ts'
import { registerAuth } from './plugins/auth.ts'
import { registerRecipeRoutes } from './routes/recipes.ts'
import { registerWeeklyMenuRoutes } from './routes/weeklyMenu.ts'
import { registerConsultationRoutes } from './routes/consultation.ts'
import { registerShoppingRoutes } from './routes/shopping.ts'
import { registerAuthRoutes } from './routes/auth.ts'
import { registerHealthRoutes } from './routes/health.ts'
import { startWeeklyEmailJob } from './jobs/weeklyEmailJob.ts'

const envPort = process.env['API_PORT']
const port = envPort ? Number.parseInt(envPort, 10) : 3001
const host = process.env['API_HOST'] ?? '0.0.0.0'

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
    },
  })

  // Plugins
  await registerCors(app)
  await registerAuth(app)

  // Routes
  await registerHealthRoutes(app)
  await registerAuthRoutes(app)
  await registerRecipeRoutes(app)
  await registerWeeklyMenuRoutes(app)
  await registerConsultationRoutes(app)
  await registerShoppingRoutes(app)

  return app
}

async function start() {
  try {
    const app = await buildApp()

    // Start cron jobs
    startWeeklyEmailJob()

    await app.listen({ port, host })
    app.log.info(`Server listening on ${host}:${port}`)
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()

export { buildApp }
