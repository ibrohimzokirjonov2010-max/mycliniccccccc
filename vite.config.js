import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

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
        },
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
  ]
});
