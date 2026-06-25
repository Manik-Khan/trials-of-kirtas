// appearance-settings.js
// ---------------------------------------------------------------------------
// Mounts the Appearance customizer into the rail's built-in Settings pane and
// routes its LIVE preview onto the floating sheet(s) instead of the page. The
// standalone sheet edits this same look via the nav cog; here the rail copy lets
// you tune it next to the board and watch the mounted sheet change in real time.
//
// WHOSE LOOK: the viewer's own. Save writes through set_my_appearance (owner-only,
// pinned to auth.uid()); every floating sheet reloads ITS character's saved look
// by character_key on next open, so the preview is non-destructive to other tabs.
//
// Loaded non-blocking by rail.js as a module. Reuses appearance.js (the panel +
// loader) and appearance-float.js (the per-tab painter) — nothing duplicated.
// ---------------------------------------------------------------------------

import { buildAppearancePanel, loadAppearance } from './appearance.js';
import { applyFloatAppearance } from './appearance-float.js';
import { DEFAULT_APPEARANCE } from './appearance-data.js';

const SETTINGS = '.tr-pane[data-rail-pane="settings"]';

// The panel styles (tok-ap-*) live in appearance.css; pages that carry the rail
// (combat, world, …) don't link it, so add it once on demand.
function ensureCss(){
  if (document.getElementById('tok-appearance-css')) return;
  const l = document.createElement('link');
  l.id = 'tok-appearance-css'; l.rel = 'stylesheet'; l.href = 'appearance.css';
  document.head.appendChild(l);
}

// Paint a config onto every open floating sheet's per-tab background layer.
function paintFloats(cfg){
  const pages = document.querySelectorAll('.sf-page');
  pages.forEach(function (p){ applyFloatAppearance(p, cfg); });
}

// Load the viewer's saved look once (waits for nav to settle the session so Save
// has a uid); falls back to the default look if signed out or on error.
let _current = null;
async function loadCurrent(){
  if (_current) return _current;
  try { if (window.__tok && window.__tok.ready) await window.__tok.ready; } catch (_) {}
  const sb  = (window.__tok && window.__tok.sb) || null;
  const uid = (window.__tok && window.__tok.session && window.__tok.session.user && window.__tok.session.user.id) || null;
  _current = Object.assign({}, DEFAULT_APPEARANCE);
  if (sb && uid) { try { _current = await loadAppearance(sb, uid); } catch (_) {} }
  return _current;
}

async function mount(){
  let pane = document.querySelector(SETTINGS);
  if (!pane || pane.querySelector('.tr-appearance')) return;     // gone, or already built
  const current = await loadCurrent();
  pane = document.querySelector(SETTINGS);                        // re-resolve across the await
  if (!pane || pane.querySelector('.tr-appearance')) return;
  ensureCss();

  const sb  = (window.__tok && window.__tok.sb) || null;
  const uid = (window.__tok && window.__tok.session && window.__tok.session.user && window.__tok.session.user.id) || null;

  const host = document.createElement('div');
  // .tok-appearance carries the panel styling (appearance.css); fill the rail pane
  // width and drop the floating-card chrome since the pane already frames it.
  host.className = 'tok-appearance tr-appearance';
  host.style.setProperty('--ap-w', '100%');
  host.style.background = 'transparent';
  host.style.border = '0';
  host.style.boxShadow = 'none';
  host.style.maxHeight = 'none';
  pane.innerHTML = '';
  pane.appendChild(host);

  // onApply routes the live preview to the floating sheet (not the page); the panel
  // owns its own Save button, which persists via set_my_appearance.
  buildAppearancePanel(host, { supabase: sb, uid: uid, current: current, onApply: paintFloats });
  paintFloats(current);   // reflect the loaded look on any sheet that's already open
}

// Build now if the rail is already up, and (re)build whenever the rail announces ready.
if (typeof document !== 'undefined') {
  if (document.querySelector(SETTINGS)) mount();
  document.addEventListener('tok-rail:ready', mount);
}

if (typeof window !== 'undefined') window.AppearanceSettings = { mount: mount, paintFloats: paintFloats };

export { mount, paintFloats };
