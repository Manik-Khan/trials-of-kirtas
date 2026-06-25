// appearance-float.js
// ---------------------------------------------------------------------------
// Paints a player's saved Appearance INSIDE a floating sheet tab, instead of as
// the full-screen page background. Each combat-sheet-float tab has a per-tab
// `.sf-bg` layer (a non-scrolling sibling behind the scrolling sheet); this
// module fills it with the same layer stack the standalone sheet uses
// (background image + veil + weave + scanlines + geometry + vignette + grain)
// and the accent-hue, driven by the SAME saved config.
//
// WHOSE LOOK: per-character. The look stays stored per-player on the owner's
// profiles row (writes still go through set_my_appearance, owner-only) — this
// only READS, by the tab's character_key, so every tab shows that character's
// chosen feel no matter who is viewing. `profiles_read` already lets any
// authenticated user select any profile, so no new policy is needed.
//
// Reuses appearance-data.js (the catalog) and appearance.js's exported DEFS /
// WEAVE / GRAIN so nothing is duplicated. Loaded on demand via dynamic import
// from combat-sheet-float.js; importing it has no side effects until called.
// ---------------------------------------------------------------------------

import { BG_PATH, BACKGROUNDS, DEFAULT_APPEARANCE } from './appearance-data.js';
import { DEFS, WEAVE, GRAIN } from './appearance.js';

// per-tab layer stack — classes (not the global #ids), positioned by combat-sheet-float.css
const LAYERS =
  '<div class="tok-bg"></div><div class="tok-veil"></div><div class="tok-weave"></div>' +
  '<div class="tok-scan"></div>' +
  '<svg class="tok-geo" preserveAspectRatio="none"><rect class="tok-geo-rect" width="100%" height="100%" fill="url(#geo-hex)"></rect></svg>' +
  '<div class="tok-vig"></div><div class="tok-grain"></div>';

// the glitch filters + geometry patterns are referenced by url(#…); inject the
// shared DEFS svg once (combat.html doesn't boot the page-level appearance system).
let defsInjected = false;
function ensureDefs() {
  if (defsInjected || typeof document === 'undefined' || !document.body) return;
  defsInjected = true;
  if (!document.getElementById('tok-appearance-defs')) document.body.insertAdjacentHTML('beforeend', DEFS);
}

// Paint a saved look onto one tab's page element. Pure DOM/CSS, no network.
export function applyFloatAppearance(pageEl, a) {
  if (!pageEl) return;
  const bg = pageEl.querySelector('.sf-bg');
  if (!bg) return;                       // tab not built with a background layer
  ensureDefs();

  // first paint for this tab: stamp the layers + the two embedded textures
  if (!bg.querySelector('.tok-bg')) {
    bg.insertAdjacentHTML('afterbegin', LAYERS);
    bg.querySelector('.tok-grain').style.backgroundImage = 'url("' + GRAIN + '")';
    bg.querySelector('.tok-weave').style.backgroundImage = 'url("' + WEAVE + '")';
  }

  a = Object.assign({}, DEFAULT_APPEARANCE, a || {});
  const s = bg.style;
  s.setProperty('--bg-hue', a.bgHue + 'deg');
  s.setProperty('--bg-sat', a.bgSat / 100);
  s.setProperty('--bg-blur', a.blur + 'px');
  s.setProperty('--bg-chroma', a.glitch ? 'url(#glitch' + a.glitch + ')' : 'grayscale(0)');
  s.setProperty('--grain', a.grain / 100);
  s.setProperty('--fx-weave', a.weave / 100);
  s.setProperty('--fx-scan', a.scan / 100);
  s.setProperty('--fx-vig', a.vig / 100);

  // accent hue rotates the sheet's own colours; the sheet declares --ac-hue:0
  // locally, so set it ON the .tok-sheet root (inline wins) for the hue to take.
  const sheet = pageEl.querySelector('.tok-sheet');
  if (sheet) sheet.style.setProperty('--ac-hue', a.acHue + 'deg');

  const bgEl = bg.querySelector('.tok-bg');
  const def = BACKGROUNDS.find(function (x) { return x.id === a.bg; }) || BACKGROUNDS[0];
  if (def.solid) { bgEl.style.backgroundImage = 'none'; bgEl.style.backgroundColor = def.solid; }
  else {
    const src = def.url || (BG_PATH + def.file);
    bgEl.style.backgroundImage = 'url("' + src + '")';
    bgEl.style.backgroundColor = 'transparent';
  }

  const geo = bg.querySelector('.tok-geo'), rect = bg.querySelector('.tok-geo-rect');
  if (a.geoShape && a.geoShape !== 'none') {
    rect.setAttribute('fill', 'url(#geo-' + a.geoShape + ')');
    const pat = document.getElementById('geo-' + a.geoShape);
    if (pat) pat.setAttribute('patternTransform', 'scale(' + (a.geoScale / 100) + ')');
    geo.style.opacity = a.geoInt / 100;
  } else {
    geo.style.opacity = 0;
  }
}

// Read the look for a character (by the owner's profiles row), then apply it.
// Paints the default first so there's no flash before the row arrives.
export async function loadFloatAppearance(supabase, characterKey, pageEl) {
  applyFloatAppearance(pageEl, DEFAULT_APPEARANCE);
  if (!supabase || !characterKey) return;
  try {
    const { data } = await supabase
      .from('profiles').select('appearance')
      .eq('character_key', characterKey).maybeSingle();
    applyFloatAppearance(pageEl, (data && data.appearance) || DEFAULT_APPEARANCE);
  } catch (_) { /* cosmetic only — never block the sheet */ }
}

// also expose for any non-module caller
if (typeof window !== 'undefined') window.AppearanceFloat = { applyFloatAppearance: applyFloatAppearance, loadFloatAppearance: loadFloatAppearance };
