// appearance-data.js
// ---------------------------------------------------------------------------
// Pure data. Adding a background = drop a .webp in /assets/backgrounds/ and add
// one line here. No logic lives in this file, so it never needs careful edits.
// ---------------------------------------------------------------------------

// Where the curated background files live (served by Netlify's CDN).
export const BG_PATH = '/assets/backgrounds/';

// The curated set. `file` items are images in BG_PATH; `solid` items are a flat
// colour (no image) — e.g. Void, the blank canvas you paint on with effects.
export const BACKGROUNDS = [
  { id: 'astral-teal', label: 'Astral Teal', file: 'astral-teal.webp' },
  { id: 'verdant',     label: 'Verdant',     file: 'verdant.webp'     },
  { id: 'steel',       label: 'Steel',       file: 'steel.webp'       },
  { id: 'shadow',      label: 'Shadow',      file: 'shadow.webp'      },
  { id: 'ember',       label: 'Ember',       file: 'ember.webp'       },
  { id: 'amber',       label: 'Amber',       file: 'amber.webp'       },
  { id: 'void',        label: 'Void',        solid: '#0a0e0d'         },
];

// Geometry overlay shapes (each is an SVG <pattern> injected by appearance.js).
export const SHAPES = [
  { id: 'none',      label: 'None'      },
  { id: 'hex',       label: 'Hexagons'  },
  { id: 'triangles', label: 'Triangles' },
  { id: 'diamonds',  label: 'Diamonds'  },
  { id: 'grid',      label: 'Grid'      },
  { id: 'dots',      label: 'Dots'      },
  { id: 'rings',     label: 'Rings'     },
  { id: 'crosses',   label: 'Crosses'   },
];

// The shape of a saved look. This object is exactly what gets written to
// profiles.appearance, and exactly what the settings pane reads back.
export const DEFAULT_APPEARANCE = {
  bg: 'astral-teal',
  bgHue: 0, bgSat: 100, acHue: 0,   // colour
  grain: 9, weave: 0, scan: 0,      // texture
  geoShape: 'none', geoInt: 35, geoScale: 100, // geometry layer
  blur: 0, vig: 0, glitch: 0,       // lens
};
