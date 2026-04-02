import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Console API → console port (3001)
      '/api': 'http://localhost:3001',
      // Gateway API → gateway port (3000)
      '/v1': 'http://localhost:3000',
      '/mcp': 'http://localhost:3000',
    },
  },
})
