import { defineConfig } from 'vite'

// User site (ExLuna-rs.github.io) is served from the domain root.
export default defineConfig({
  base: '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
})
