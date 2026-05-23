// ============================================================
// bardic-data.js — static UI data only
// ============================================================
// Moods/playlists are no longer hardcoded here.
// They live in data/tracks.json and are fetched at runtime
// via /.netlify/functions/tracks.
//
// This file only contains data that never changes:
//   - SFX pad definitions
//   - Channel definitions
// ============================================================

// SFX one-shots — synth-generated, no file needed
const SFX_PADS = [
  { id:'door',    label:'Door',        icon:'ti-door',           desc:'Heavy timber thunk' },
  { id:'sword',   label:'Sword',       icon:'ti-sword',          desc:'Metallic schwing' },
  { id:'roar',    label:'Dragon',      icon:'ti-flame',          desc:'Wyrm of the depths' },
  { id:'bell',    label:'Bell',        icon:'ti-bell',           desc:'Last call · alarm' },
  { id:'thunder', label:'Thunder',     icon:'ti-bolt',           desc:'Sky cracks open' },
  { id:'coin',    label:'Coin',        icon:'ti-coin',           desc:'Gold spilled' },
  { id:'horn',    label:'War Horn',    icon:'ti-trumpet',        desc:'Call to arms' },
  { id:'chime',   label:'Chime',       icon:'ti-sparkles',       desc:'Magic crackles' },
  { id:'crackle', label:'Crackle',     icon:'ti-campfire',       desc:'Hearth pop' },
];

// Tabler icon options for mood sigils — shown in the mood editor
const SIGIL_OPTIONS = [
  'ti-music', 'ti-sword', 'ti-skull', 'ti-flame', 'ti-eye', 'ti-ghost',
  'ti-crown', 'ti-droplet', 'ti-anchor', 'ti-bolt', 'ti-mountain',
  'ti-tree', 'ti-compass', 'ti-beer', 'ti-sun', 'ti-building-castle',
  'ti-wind', 'ti-cloud-rain', 'ti-moon', 'ti-star', 'ti-shield',
  'ti-wand', 'ti-heart', 'ti-key', 'ti-map', 'ti-scroll',
];

// Color palette for mood swatches — shown in the mood editor
const COLOR_OPTIONS = [
  '#a76a2a', '#5a8a4a', '#3a6a3a', '#3a3a4a', '#8a2a2a',
  '#5a1a2a', '#6a4a1a', '#4a3a6a', '#3a4a6a', '#a78a2a',
  '#3a6a8a', '#3a3a5a', '#7a5a3a', '#2a1a3a', '#c8a040',
  '#4a6a4a', '#6a3a5a', '#3a5a6a', '#5a4a2a', '#2a3a5a',
];

window.BardicData = { SFX_PADS, SIGIL_OPTIONS, COLOR_OPTIONS };
