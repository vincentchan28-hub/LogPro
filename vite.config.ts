import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = resolve(currentDirectory, 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
  version: string
}


// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
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