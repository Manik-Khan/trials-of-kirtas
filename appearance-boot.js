// appearance-boot.js
// ---------------------------------------------------------------------------
// Per-page glue for the Appearance engine. Include on any themed page:
//
//   <script type="module" src="appearance-boot.js"></script>
//
// On load it paints the default look immediately (no flash), then — once nav.js
// has settled the session — loads the player's saved look from Supabase and
// repaints. It also exposes window.AppearanceUI so the nav cog can open the
// settings panel (mounted into nav's #appearance-drawer), and reveals the cog
// (hidden until a page actually wires appearance) via the .has-appearance flag.
//
// Reuses nav's single Supabase client (window.__tok.sb) and session — no second
// client, no extra getSession.
// ---------------------------------------------------------------------------

import { loadAppearance, buildAppearancePanel, applyAppearance } from './appearance.js';
import { DEFAULT_APPEARANCE } from './appearance-data.js';

let CURRENT = Object.assign({}, DEFAULT_APPEARANCE);
let SB = null, UID = null, built = false, isOpen = false;

// Paint something immediately so the ground isn't blank before the session resolves.
applyAppearance(CURRENT);

const drawer = () => document.getElementById('appearance-drawer');

function ensureCss() {
  if (document.getElementById('tok-appearance-css')) return;
  const l = document.createElement('link');
  l.id = 'tok-appearance-css'; l.rel = 'stylesheet'; l.href = 'appearance.css?v=appearance2';
  document.head.appendChild(l);
}

function buildPanel() {
  const d = drawer();
  if (!d) return;
  ensureCss();
  let host = d.querySelector('.tr-appearance');
  if (!host) {
    host = document.createElement('div');
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
    d.innerHTML = '';
    d.appendChild(host);
  }
  buildAppearancePanel(host, { supabase: SB, uid: UID, current: CURRENT });
  built = true;
}

function setOpen(v) {
  const d = drawer();
  if (!d) return;
  isOpen = v;
  if (isOpen && !built) buildPanel();
  d.classList.toggle('open', isOpen);
}

window.AppearanceUI = {
  open() { setOpen(!isOpen); },   // cog toggles the panel
  close() { setOpen(false); },
  isOpen() { return isOpen; },
  mount() { if (!built) buildPanel(); },   // build into the drawer on demand; the cog flyout governs visibility
};
document.dispatchEvent(new CustomEvent('tok:appearance-ui-ready'));

// Close on outside click — but not when clicking inside the drawer or on the cog.
document.addEventListener('click', (e) => {
  if (!isOpen) return;
  const d = drawer();
  const onCog = e.target.closest && e.target.closest('.nav-appearance-btn');
  if (d && (d.contains(e.target) || onCog)) return;
  setOpen(false);
});

async function boot() {
  try { if (window.__tok && window.__tok.ready) await window.__tok.ready; } catch (_) {}
  SB  = (window.__tok && window.__tok.sb) || null;
  UID = (window.__tok && window.__tok.session && window.__tok.session.user && window.__tok.session.user.id) || null;
  if (SB && UID) {
    try { CURRENT = await loadAppearance(SB, UID); } catch (_) { /* default already painted */ }
  }
  if (built) buildPanel();                                   // refresh if opened before load finished
  document.documentElement.classList.add('has-appearance');  // reveal the nav cog
}
boot();
