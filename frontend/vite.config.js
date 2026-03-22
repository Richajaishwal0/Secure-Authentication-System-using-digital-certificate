import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api':  'http://localhost:8000',
      '/acme': 'http://localhost:8000',
      '/ocsp': 'http://localhost:8000',
    },
  },
})
