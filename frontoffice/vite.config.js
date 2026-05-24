import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mirror backoffice dev proxy defaults (can be overridden with env vars)
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost/evaluation'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
