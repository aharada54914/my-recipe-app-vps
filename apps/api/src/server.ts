import Fastify from 'fastify'
import { registerCors } from './plugins/cors.js'
import { registerAuth } from './plugins/auth.js'
import { registerRecipeRoutes } from './routes/recipes.js'
import { registerWeeklyMenuRoutes } from './routes/weeklyMenu.js'
import { registerConsultationRoutes } from './routes/consultation.js'
import { registerShoppingRoutes } from './routes/shopping.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerPreferencesRoutes } from './routes/preferences.js'
import { registerInternalDiscordRoutes } from './routes/internalDiscord.js'
import { startWeeklyEmailJob } from './jobs/weeklyEmailJob.js'

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
  await registerPreferencesRoutes(app)
  await registerInternalDiscordRoutes(app)
  await registerRecipeRoutes(app)
  await registerWeeklyMenuRoutes(app)
  await registerConsultationRoutes(app)
  await registerShoppingRoutes(app)

  return app
}

async function start() {
  try {
    const app = await buildApp()

    if (process.env['ENABLE_WEEKLY_EMAIL_JOB'] !== 'false') {
      startWeeklyEmailJob()
    } else {
      app.log.info('Weekly email job disabled by ENABLE_WEEKLY_EMAIL_JOB=false')
    }

    await app.listen({ port, host })
    app.log.info(`Server listening on ${host}:${port}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to start server: ${message}`)
    process.exit(1)
  }
}

start()

export { buildApp }
