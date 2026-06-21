import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'HLViewer',
        short_name: 'HLViewer',
        description: 'Моніторинг ГРС',
        lang: 'uk',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Never serve the SPA shell for API calls; let them hit the network.
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/lines': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/gas-volume-calcs': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/edit_counts': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/sys_counts': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/edit': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/daily': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/hourly': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/get_report': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/sys': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/param': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['xlsx']
  },
  build: {
    commonjsOptions: {
      include: [/xlsx/, /node_modules/]
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':      ['react', 'react-dom'],
          'vendor-aggrid':     ['ag-grid-community', 'ag-grid-react'],
          'vendor-charts':     ['recharts'],
          'vendor-xlsx':       ['xlsx'],
          'vendor-datepicker': ['react-datepicker', 'date-fns'],
        }
      }
    }
  }
})