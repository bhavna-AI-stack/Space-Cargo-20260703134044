import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/space-cargo-runner/',
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: {
      'shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  }
})
