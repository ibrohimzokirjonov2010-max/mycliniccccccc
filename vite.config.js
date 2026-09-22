import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'warn',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  server: {
    port: 5175,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/notifications': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      overlay: false,
    },
    // Fayllarni kuzatishni optimallashtirish
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
  },
  // EsBuild - juda tez transpilatsiya
  esbuild: {
    target: 'es2020',
    legalComments: 'none',
    treeShaking: true,
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-dom/client',
      'react-router-dom', 
      'framer-motion', 
      'lucide-react', 
      'recharts',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'date-fns',
      'sonner',
      'clsx',
      'class-variance-authority',
    ],
    // Barcha dependencylarni bir marta oldindan compile qiladi
    force: false,
  },
  build: {
    target: 'es2020',
    // Minifikatsiya tezroq
    minify: 'esbuild',
    // Source map ni o'chirish (build tezroq)
    sourcemap: false,
    rollupOptions: {
      output: {
        // Katta fayllarni bo'laklarga bo'lish
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-utils': ['date-fns', 'clsx', 'class-variance-authority'],
          // 🔑 base44Client (87KB) ni asosiy bundle dan ajratish
          // Brauzer uni parallel yuklaydi — boshlang'ich sahifa tezroq ochiladi
          'api-base44': ['./src/api/base44Client.jsx'],
        },
        // Module preloading: bog'liq chunk'larni oldindan yuklash
        experimentalMinChunkSize: 10_000,

        // Chunk fayl nomlari
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: false,
      navigationNotifier: false,
      analyticsTracker: false,
      visualEditAgent: false
    }),
    react({
      // Babel o'rniga esbuild ishlatish — 20x tez
      babel: false,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192x192.svg', 'icon-512x512.svg', 'logo.png'],
      manifest: false, // manifest.json allaqachon public/ da bor
      workbox: {
        // Offline shell stays precached (navigateFallback: 'index.html').
        // It is not sticky forever: sw-activate-reload.js navigates open windows
        // when a new worker activates, and the page reloads on controllerchange.
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
        globIgnores: ['**/teeth/**', '**/sw-activate-reload.js'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        importScripts: ['sw-activate-reload.js'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/assets\/.*\.(?:js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets-cache-v15-notebook-fluid',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            // Tooth PNGs change in place. SWR + ?v= in the URL, never 30-day CacheFirst.
            urlPattern: ({ url }) => url.pathname.startsWith('/teeth/') && /\.png$/i.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'teeth-png-v3-rev',
              expiration: { maxEntries: 450, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            urlPattern: ({ url }) => !url.pathname.startsWith('/teeth/') && /\.(?:png|jpg|jpeg|svg|webp|gif)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache-v3',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-cache' }
          }
        ]
      },
      devOptions: {
        enabled: false // Dev rejimda o'chirish (HMR bilan muammo bo'lmasin)
      }
    })
  ]
});
