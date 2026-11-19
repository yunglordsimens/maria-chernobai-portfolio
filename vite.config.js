import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import portfolioSeo from './scripts/seo-plugin.js'

export default defineConfig({
  plugins: [react(), portfolioSeo()],
})
