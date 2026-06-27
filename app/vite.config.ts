import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // pdf.js v5's worker is an ES module — emit workers as ESM so the bundled `?worker` (used to
  // rasterize PDF enclosures into the .docx) initializes in both dev and the production build.
  worker: { format: 'es' },
})
