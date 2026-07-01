// ToK journal — the Vite walled corner (NEW pages only; live Quill pages untouched).
// Build outputs fixed filenames (upload-friendly: same 3 files every deploy) and
// stamps ?v=<epoch> on the asset tags — cache-busting baked into every build.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const V = Date.now()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'tok-version-stamp',
      transformIndexHtml(html) {
        return html
          .replace(/(journal-assets\/journal\.js)/g, `$1?v=${V}`)
          .replace(/(journal-assets\/journal\.css)/g, `$1?v=${V}`)
      },
    },
  ],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'journal-assets/journal.js',
        chunkFileNames: 'journal-assets/[name].js',
        assetFileNames: 'journal-assets/journal.[ext]',
      },
    },
  },
})
