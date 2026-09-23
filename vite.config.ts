import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    watch: {
      // Stops the app reloading itself when Excel files are saved
      ignored: ['**/*.xlsx', '**/~$*'],
    },
  },
})