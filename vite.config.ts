import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devGateway } from './dev-gateway.mjs'

export default defineConfig({
  plugins: [react(), tailwindcss(), devGateway()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: { 'mui-loading': ['@mui/material/CircularProgress', '@mui/material/Skeleton'] }
      }
    }
  }
})
