import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker the backend is reachable via the service name, not localhost.
// Set VITE_API_TARGET in docker-compose to override for container networking.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      }
    }
  }
})
