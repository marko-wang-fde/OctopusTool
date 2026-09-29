import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/report/web',
  plugins: [react()],
  build: {
    outDir: '../../../dist/report-web',
    emptyOutDir: true
  }
})
