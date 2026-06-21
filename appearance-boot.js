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

function buildPanel() {
  const d = drawer();
  if (!d) return;
  buildAppearancePanel(d, { supabase: SB, uid: UID, current: CURRENT });
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
};

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
