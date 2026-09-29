import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "X-Frame-Options": "ALLOWALL",
    },
    proxy: {
      // Proxy all /api/ calls to Django — eliminates CORS for map iframe
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket /ws/ connections to Django Channels
      '/ws': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
})