import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon-192.png', 'app-icon-512.png'],
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
            src: '/app-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
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
