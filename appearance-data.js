// appearance-data.js
// ---------------------------------------------------------------------------
// Pure data. Adding a background = drop a .webp in /assets/backgrounds/ and add
// one line here. No logic lives in this file, so it never needs careful edits.
// ---------------------------------------------------------------------------

// Optional base for Netlify-hosted files (entries with `file`). Entries can also
// carry a full `url` (e.g. Cloudinary) — see appearance.js, which prefers `url`.
export const BG_PATH = '/assets/backgrounds/';

// The curated set. `url` items are hosted images (Cloudinary); `solid` items are
// a flat colour (no image) — the blank canvas you paint on with the effects.
export const BACKGROUNDS = [
  { id: 'metaphor',    label: 'Metaphor',     url: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1781997652/kirtas/backgrounds/metaphor.png'    },
  { id: 'harvestmoon', label: 'Harvest Moon', url: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1781999155/kirtas/backgrounds/harvestmoon.png' },
  { id: 'space',       label: 'Space',        url: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1781999178/kirtas/backgrounds/space.png'       },
  { id: 'flowerfield', label: 'Flower Field', url: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1781999200/kirtas/backgrounds/flowerfield.png' },
  { id: 'moon',        label: 'Moon',         url: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1781999213/kirtas/backgrounds/moon.png'        },
  { id: 'weapons',     label: 'Weapons',      url: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1781999303/kirtas/backgrounds/weapons.jpg'      },
  { id: 'void',        label: 'Void',         solid: '#0a0e0d' },
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
  bg: 'metaphor',
  bgHue: 0, bgSat: 100, acHue: 0,   // colour
  grain: 9, weave: 0, scan: 0,      // texture
  geoShape: 'none', geoInt: 35, geoScale: 100, // geometry layer
  blur: 0, vig: 0, glitch: 0,       // lens
};
