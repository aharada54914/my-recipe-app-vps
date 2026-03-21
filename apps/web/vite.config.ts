import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

type ApiRequest = IncomingMessage & { query?: Record<string, string> }
type ApiResponse = ServerResponse<IncomingMessage> & {
  status?: (code: number) => ApiResponse
  json?: (data: unknown) => void
}

function apiMiddleware(): Plugin {
  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req: ApiRequest, res: ApiResponse, next) => {
        if (req.url && req.url.startsWith('/api/recipe-extract')) {
          try {
            const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
            req.query = Object.fromEntries(urlObj.searchParams)

            const handlerModule = await server.ssrLoadModule('./api/recipe-extract.js')
            const handler = handlerModule.default

            res.status = (code: number) => {
              res.statusCode = code
              return res
            }
            res.json = (data: unknown) => {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            }

            await handler(req, res)
            return
          } catch (e: unknown) {
            console.error('API Error:', e)
            const message = e instanceof Error ? e.message : String(e)
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: message }))
            return
          }
        }
        next()
      })
    }
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  resolve: {
    alias: {
      path: 'path-browserify',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-dexie':  ['dexie', 'dexie-react-hooks'],
          'vendor-ui':     ['lucide-react', 'fuse.js', '@tanstack/react-virtual'],
          'vendor-google': ['@google/generative-ai', '@react-oauth/google'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['tests/smoke/**', 'tests/visual/**', 'node_modules/**', 'dist/**', '.claude/worktrees/**'],
  },
  plugins: [
    apiMiddleware(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kitchen App',
        short_name: 'Kitchen',
        description: 'ホットクック・ヘルシオ対応レシピ管理PWA',
        theme_color: '#F97316',
        background_color: '#121214',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB — recipe JSON bundle is ~4.2 MB
        runtimeCaching: [
          {
            // Cache external recipe images from SHARP
            urlPattern: /^https:\/\/cocoroplus\.jp\.sharp/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'recipe-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
