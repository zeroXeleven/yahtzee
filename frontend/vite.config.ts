import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, the app is served by Vite and /api is proxied to the backend
// container. In production the built bundle is served by FastAPI itself.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://backend:8000', changeOrigin: true },
    },
    watch: {
      // Windows bind mounts don't deliver file events reliably — poll instead.
      usePolling: true,
    },
  },
})
