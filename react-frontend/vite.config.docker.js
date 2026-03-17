import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    watch: {
      usePolling: true
    },
    proxy: {
      '/lines': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/gas-volume-calcs': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/edit_counts': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/sys_counts': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/edit': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/daily': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/hourly': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/get_report': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/sys': {
        target: 'http://fastapi:8000',
        changeOrigin: true
      },
      '/param': {
        target: 'http://fastapi:8000',
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
    }
  }
})
