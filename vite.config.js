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
        // Asosiy sahifalarni cache qilish strategiyasi
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        runtimeCaching: [
          {
            // API so'rovlar uchun NetworkFirst — yangi ma'lumot bo'lmasa cache ishlaydi
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
            // Rasmlar uchun CacheFirst — tez yuklanadi
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            // Google Fonts
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
