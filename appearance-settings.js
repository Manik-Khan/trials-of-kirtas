// appearance-settings.js
// ---------------------------------------------------------------------------
// Supplies the Sheet look editor inside the nav's ◐ Appearance flyout on pages
// that do not run appearance-boot.js, routing LIVE preview onto floating sheets.
// On a themed page, appearance-boot remains the one AppearanceUI owner.
//
// WHOSE LOOK: the viewer's own. Save writes through set_my_appearance (owner-only,
// pinned to auth.uid()); every floating sheet reloads ITS character's saved look
// by character_key on next open, so the preview is non-destructive to other tabs.
//
// Loaded non-blocking by nav.js as a module. Reuses appearance.js (the panel +
// loader) and appearance-float.js (the per-tab painter) — nothing duplicated.
// ---------------------------------------------------------------------------

import { buildAppearancePanel } from './appearance.js';
import { applyFloatAppearance } from './appearance-float.js';
import { DEFAULT_APPEARANCE } from './appearance-data.js';

const DRAWER = '#appearance-drawer';

// The panel styles (tok-ap-*) live in appearance.css; pages that carry the rail
// (combat, world, …) don't link it, so add it once on demand.
function ensureCss(){
  if (document.getElementById('tok-appearance-css')) return;
  const l = document.createElement('link');
  l.id = 'tok-appearance-css'; l.rel = 'stylesheet'; l.href = 'appearance.css?v=appearance2';
  document.head.appendChild(l);
}

// Paint a config onto every open floating sheet's per-tab background layer.
function paintFloats(cfg){
  const pages = document.querySelectorAll('.sf-page');
  pages.forEach(function (p){ applyFloatAppearance(p, cfg); });
}

// Load the viewer's saved look once (waits for nav to settle the session so Save
// has a uid). This is a RAW read on purpose: appearance.js's loadAppearance() calls
// applyAppearance() as a side effect, which would stamp the page-level #bg/#fx layers
// onto whatever page the rail rides on (combat, shards, …) — exactly the "the forger
// got the look" bleed. We only want the values here; the float is painted via onApply.
let _current = null;
async function loadCurrent(){
  if (_current) return _current;
  try { if (window.__tok && window.__tok.ready) await window.__tok.ready; } catch (_) {}
  const sb  = (window.__tok && window.__tok.sb) || null;
  const uid = (window.__tok && window.__tok.session && window.__tok.session.user && window.__tok.session.user.id) || null;
  _current = Object.assign({}, DEFAULT_APPEARANCE);
  if (sb && uid) {
    try {
      const { data } = await sb.from('profiles').select('appearance').eq('user_id', uid).maybeSingle();
      _current = Object.assign({}, DEFAULT_APPEARANCE, (data && data.appearance) || {});
    } catch (_) {}
  }
  return _current;
}

async function mount(){
  let drawer = document.querySelector(DRAWER);
  if (!drawer || drawer.querySelector('.tr-appearance')) return;
  const current = await loadCurrent();
  drawer = document.querySelector(DRAWER);                        // re-resolve across the await
  if (!drawer || drawer.querySelector('.tr-appearance')) return;
  ensureCss();

  const sb  = (window.__tok && window.__tok.sb) || null;
  const uid = (window.__tok && window.__tok.session && window.__tok.session.user && window.__tok.session.user.id) || null;

  const host = document.createElement('div');
  // .tok-appearance carries the panel styling. The flyout already supplies the
  // card chrome, so the hosted editor fills its drawer without another frame.
  host.className = 'tok-appearance tr-appearance';
  host.style.setProperty('--ap-w', '100%');
  host.style.setProperty('--ap-ground', 'var(--ts-paper,#182826)');
  host.style.setProperty('--ap-cream', 'var(--ts-ink,#ece2cd)');
  host.style.setProperty('--ap-cream-dim', 'var(--ts-soft,#c2b99f)');
  host.style.setProperty('--ap-cream-fnt', 'var(--ts-faint,#8d8675)');
  host.style.setProperty('--ap-gold', 'var(--ts-accent,#c79a4a)');
  host.style.setProperty('--ap-gold-br', 'var(--ts-accent,#e7c279)');
  host.style.setProperty('--ap-frame', 'var(--ts-hairline,rgba(199,154,74,.34))');
  host.style.setProperty('--ap-hair', 'var(--ts-hairline,rgba(236,226,205,.13))');
  host.style.background = 'transparent';
  host.style.border = '0';
  host.style.boxShadow = 'none';
  host.style.maxHeight = 'none';
  drawer.innerHTML = '';
  drawer.appendChild(host);

  // onApply routes the live preview to the floating sheet (not the page); the panel
  // owns its own Save button, which persists via set_my_appearance.
  buildAppearancePanel(host, { supabase: sb, uid: uid, current: current, onApply: paintFloats });
  paintFloats(current);   // reflect the loaded look on any sheet that's already open
}

function install(){
  if (window.AppearanceUI) return;  // appearance-boot owns themed pages
  window.AppearanceUI = {
    mount: mount,
    open: mount,
    close: function () {},
    isOpen: function () { return !!document.querySelector('#ts-sheet-drawer.open'); },
  };
  document.dispatchEvent(new CustomEvent('tok:appearance-ui-ready'));
}

// Install now if the flyout exists, and again when its eager shell announces ready.
if (typeof document !== 'undefined') {
  install();
  document.addEventListener('tok:settings-ready', install);
}

if (typeof window !== 'undefined') window.AppearanceSettings = { mount: mount, paintFloats: paintFloats };

export { mount, paintFloats };
