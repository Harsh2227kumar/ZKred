import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { createReadStream, existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { Plugin } from 'vite'

// Local dev only: serves the committed circuit artifacts at /zk (Caddy does this in docker compose / EC2).
const circuitsBuild = fileURLToPath(new URL('../circuits/build/', import.meta.url))
const zkArtifactsDev = (): Plugin => ({
  name: 'zkred-zk-artifacts-dev',
  configureServer(server) {
    server.middlewares.use('/zk', (req, res, next) => {
      const file = circuitsBuild + basename(req.url ?? '')
      if (!req.url || !existsSync(file)) return next()
      createReadStream(file).pipe(res)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    zkArtifactsDev(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Local dev only: lets VITE_API_BASE_URL=/api/v1 hit the backend started with `pnpm --filter backend dev`,
  // the same relative path Caddy serves in docker compose / EC2.
  server: {
    proxy: {
      '/api': process.env.VITE_DEV_API_PROXY ?? 'http://localhost:8080',
    },
  },
})
