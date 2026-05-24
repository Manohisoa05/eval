import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Do not import application code from vite config. Use environment variables with sensible defaults.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost/evaluation'
const ADMIN_PATH_RAW = process.env.VITE_ADMIN_PATH || '/admin123'
const ADMIN_PATH = ADMIN_PATH_RAW.startsWith('/') ? ADMIN_PATH_RAW : `/${ADMIN_PATH_RAW}`

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
      [ADMIN_PATH]: {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(new RegExp('^' + ADMIN_PATH), ADMIN_PATH),
      },
    },
  },
})
