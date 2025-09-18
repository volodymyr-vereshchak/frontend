import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    }
  }
})