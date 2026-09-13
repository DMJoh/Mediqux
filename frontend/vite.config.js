import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Same-origin /api in dev too, matching how Caddy proxies it in production —
    // the frontend code never needs to know the backend's actual host/port.
    proxy: {
      '/api': { target: 'http://backend:3000', changeOrigin: true },
    },
  },
})
