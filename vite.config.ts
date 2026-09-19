import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Stops the app reloading itself when Excel files are saved
      ignored: ['**/*.xlsx', '**/~$*'],
    },
  },
})