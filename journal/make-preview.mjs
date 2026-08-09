// Inlines the built JS + CSS into one standalone HTML — the mock M opens
// directly (file:// fine). Sample data is baked; no network beyond fonts.
import fs from 'fs'
let html = fs.readFileSync('dist/index.html', 'utf8')
const js  = fs.readFileSync('dist/journal-assets/journal.js', 'utf8')
const css = fs.readFileSync('dist/journal-assets/journal.css', 'utf8')
html = html
  .replace(/<script type="module"[^>]*journal-assets\/journal\.js[^>]*><\/script>/,
           () => `<script type="module">\n${js}\n</script>`)
  .replace(/<link rel="stylesheet"[^>]*journal-assets\/journal\.css[^>]*>/,
           () => `<style>\n${css}\n</style>`)
// Strip whole shell scripts (including the inline NPC/location bridge), then
// the self-closing shell links. Removing only the opening tag leaked the
// bridge source as visible prose at the foot of the standalone preview.
html = html.replace(/\s*<script[^>]*data-tok-shell[^>]*>[\s\S]*?<\/script>\s*/g, '\n')
html = html.replace(/^\s*<link[^>]*data-tok-shell[^>]*>\n?/gm, '')
html = html.replace('<title>', '<!-- STANDALONE PREVIEW — Phase 0/1 mock, sample data baked, nothing persists -->\n<title>')
fs.writeFileSync('journal-preview.html', html)
console.log('journal-preview.html', (html.length/1024).toFixed(0)+'kB')
