import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  // Unit tests stay fixture-backed; daily-driver VITE_AGENT_HTTP_URL lives in `.env` for `npm run dev:os` (#32).
  test: {
    env: {
      VITE_AGENT_HTTP_URL: '',
    },
  },
}) 