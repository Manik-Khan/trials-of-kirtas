// ============================================================
// nav.js — Shared Navigation & Theme Switcher
// The Trials of Kirtas
// ============================================================
//
// HOW TO ADD A NEW PAGE TO THE NAV:
// 1. Add an entry to the PAGES array below
// 2. That's it — all pages update automatically
//
// HOW TO ADD A NEW THEME:
// 1. Add the theme variables to theme.css
// 2. Add an entry to the THEMES array below
// 3. That's it — the switcher dropdown updates automatically
//
// SETUP ON EACH PAGE:
// In <head>:
//   <link rel="stylesheet" href="theme.css">
//   <link rel="stylesheet" href="nav.css">   ← (included below as injected style)
// Just before </body>:
//   <div id="nav-root"></div>                ← put this BEFORE the script tag
//   <script src="nav.js"></script>
//
// The script auto-detects which page is active from the URL.
// ============================================================


// ── Navigation pages ──
// Add new pages here. 'path' matches the HTML filename.
const PAGES = [
  { label: 'Party',       path: 'party.html' },
  { label: 'Combat',      path: 'combat.html' },   // ← new
  { label: 'Factions',    path: 'factions.html' },
  { label: 'Chronicle',   path: 'chronicle.html' },
  { label: 'Journal',     path: 'journal.html' },
  { label: 'NPCs',       path: 'npcs.html' },
  { label: 'World',      path: 'world.html' },
  { label: 'Lore',       path: 'lore.html' },
  { label: 'Compendium', path: 'compendium.html' },
  { label: 'Console',    path: 'bardic-console.html' },
];


// ── Themes: RETIRED (July 3) ──
// The data-theme system stood down: themes demoted to ink+paper PRESETS in
// the ◐ Settings flyout (settings-flyout.js — see "From the archives").
// The site rides Phantom as its fixed base until the site-wide color
// re-plumb arc maps the player's look onto theme.css tokens. The old
// [data-theme] blocks stay in theme.css as archives — do not delete.
const PINNED_THEME = 'phantom';


// ── Characters for the sheet switcher ──
// Add new characters here when the party grows
const CHARACTERS_NAV = [
  { key: 'cosmere',     label: 'Cosmere',   full: 'Cosmere Runestar' },
  { key: 'caim',      label: 'Caim',    full: 'Caim' },
  { key: 'liadan',    label: 'Líadan',  full: 'Líadan Luchóg' },
  { key: 'vesperian', label: 'Vesperian', full: 'Vesperian Vale' },
];

// ── Determine active page from URL ──
function getActivePath() {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1] || 'index.html';
}


// ── Apply the pinned base theme ──
// Phantom's fonts still lazy-load; the dropdown UI it once refreshed is gone.
function applyTheme() {
  document.documentElement.setAttribute('data-theme', PINNED_THEME);

  // Lazy-load Phantom fonts (the pinned base needs them)
  if (!document.getElementById('font-barlow')) {
    const l = document.createElement('link');
    l.id = 'font-barlow'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700;1,900&display=swap';
    document.head.appendChild(l);
  }
  if (!document.getElementById('font-eb-garamond')) {
    const l = document.createElement('link');
    l.id = 'font-eb-garamond'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap';
    document.head.appendChild(l);
  }
  if (!document.getElementById('font-source-serif')) {
    const l = document.createElement('link');
    l.id = 'font-source-serif'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;1,400&display=swap';
    document.head.appendChild(l);
  }
}


// ── Build nav HTML ──
function buildNav() {
  const activePath   = getActivePath();
  const isSheet      = activePath === 'sheet-v2.html';
  const activeChar   = isSheet ? (new URLSearchParams(window.location.search)).get('character') || '' : '';

  const navLinks = PAGES.map(page => {
    const isActive = activePath === page.path;
    const link = `<a href="${page.path}" class="nav-link${isActive ? ' active' : ''}">${page.label}</a>`;
    // Party gets a caret that opens the "Your Character" menu. The caret starts
    // hidden and is revealed by populateCharMenu() only if the signed-in user
    // has a character (players + the overseer-as-Vesperian); the DM never sees it.
    if (page.path === 'party.html') {
      return `<span class="nav-party-item">${link}<button class="nav-party-caret" id="nav-party-caret" type="button" onclick="toggleCharMenu(event)" aria-label="Jump to your character" hidden>▾</button></span>`;
    }
    return link;
  }).join('');

  // Character switcher — only rendered on sheet-v2.html
  const charSwitcher = isSheet ? `
    <div class="nav-char-switcher">
      <span class="nav-char-divider">|</span>
      ${CHARACTERS_NAV.map(c => `
        <a href="sheet-v2.html?character=${c.key}"
           class="nav-char-link${c.key === activeChar ? ' active' : ''}">
          ${c.label}
        </a>`).join('')}
    </div>` : '';

  return `
    <nav id="site-nav">
      <a href="index.html" class="nav-brand">Kirtas</a>
      <div class="nav-links">
        ${navLinks}
        ${charSwitcher}
      </div>
      <div class="nav-theme-wrap" id="nav-theme-wrap">
        <button id="battle-btn" title="Toggle battle mode" onclick="window.__battle&&window.__battle.toggleBattle()">⚔</button>
        <button class="nav-theme-btn"
                onclick="window.TokSettings&&window.TokSettings.toggle(event)"
                title="Settings"
                aria-expanded="false"
                aria-label="Settings">◐</button>
      </div>
      <!-- "Your Character" menu — opened by the Party caret. Lives at nav level
           (not inside .nav-links) and is position:fixed, JS-placed on open, so
           the mobile horizontal-scroll/mask on .nav-links can't clip it. Body is
           filled by populateCharMenu() once window.__tok resolves. -->
      <div class="char-menu" id="char-menu">
        <div class="char-menu-label">Your Character</div>
        <div id="char-menu-body"></div>
      </div>
    </nav>
  `;
}


// Character JSON export — a portable snapshot, now triggered from the ◐
// Settings flyout's Download menu (settings-flyout.js calls this global).
function __downloadCharacterJSON(btn) {
  if (typeof CharacterData === 'undefined' || !CharacterData.loadCharacter) return;
  const key = new URLSearchParams(location.search).get('character') || 'cosmere';
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Exporting\u2026'; }
  CharacterData.loadCharacter(key).then(function (row) {
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = (key || 'character') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    if (btn) { btn.textContent = label; btn.disabled = false; }
    if (window.TokSettings) window.TokSettings.close();
  }).catch(function () {
    if (btn) { btn.textContent = 'Export failed'; setTimeout(function () { btn.textContent = label; btn.disabled = false; }, 1600); }
  });
}
window.__downloadCharacterJSON = __downloadCharacterJSON;

// ==== COG FLYOUT: RETIRED (July 3) ====
// The ⚙ cog and the theme dropdown both folded into the ◐ Settings flyout
// (settings-flyout.js). #appearance-drawer now lives inside that flyout;
// AppearanceUI.mount() is invoked from its Sheet section. The old cog smoke
// (smoke-nav-cog-flyout.mjs) retires with it — smoke-settings-flyout.mjs is
// the successor.

// Close on outside click
document.addEventListener('click', () => {
  if (charMenuOpen) closeCharMenu();
});


// ── "Your Character" menu ──
// Opened by the Party caret. The menu is position:fixed and placed under the
// caret on open (so the scrolling/masked .nav-links can't clip it). It mirrors
// the theme dropdown's open/close + outside-click behaviour.
let charMenuOpen = false;

function closeCharMenu() {
  charMenuOpen = false;
  document.getElementById('char-menu')?.classList.remove('open');
}

function toggleCharMenu(e) {
  e.stopPropagation();
  const menu  = document.getElementById('char-menu');
  const caret = document.getElementById('nav-party-caret');
  if (!menu || !caret) return;
  charMenuOpen = !charMenuOpen;
  if (charMenuOpen) {
    // Place under the caret, clamped so a ~156px menu stays on-screen.
    const r = caret.getBoundingClientRect();
    menu.style.top  = (r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left - 4, window.innerWidth - 168)) + 'px';
    menu.classList.add('open');
  } else {
    menu.classList.remove('open');
  }
}

// A fixed menu would drift if the page or nav row scrolls — close it instead.
window.addEventListener('scroll', () => { if (charMenuOpen) closeCharMenu(); }, true);

// Fill the menu with the signed-in user's character and reveal the caret.
// Players → their character; the overseer → Vesperian; the DM (no character_key)
// → caret stays hidden. Runs after mountNav(), awaiting the 4a identity promise.
async function populateCharMenu() {
  try {
    const me = (window.__tok && window.__tok.ready) ? await window.__tok.ready : null;
    if (!me || !me.characterKey) return;            // DM / unprovisioned → no caret
    const c = CHARACTERS_NAV.find(x => x.key === me.characterKey);
    if (!c) return;
    const body = document.getElementById('char-menu-body');
    if (body) {
      body.innerHTML =
        `<a class="char-menu-row" href="sheet-v2.html?character=${c.key}">` +
        `<span class="char-menu-name">${c.full || c.label}</span>` +
        `<span class="char-menu-go">→</span></a>`;
    }
    const caret = document.getElementById('nav-party-caret');
    if (caret) caret.hidden = false;
  } catch (e) { /* leave the caret hidden */ }
}


// ── Inject nav styles ──
// These live here so nav.js is truly self-contained — no separate nav.css needed
function injectNavStyles() {
  if (document.getElementById('nav-styles')) return;
  const style = document.createElement('style');
  style.id = 'nav-styles';
  style.textContent = `
    /* Prevent sticky nav from overlapping scroll targets */
    html { scroll-padding-top: 52px; }

    #site-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--nav-bg);
      border-bottom: 1px solid var(--nav-border);
      padding: 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 52px;
      transition: background 0.3s ease, border-color 0.3s ease, transform 0.35s ease-out, opacity 0.35s ease-out;
    }

    /* Mobile: Fixed positioning prevents sticky layout jumping during Safari chrome resizing.
       The ::before pseudo-element acts as a shield, extending infinitely upward to mask overscroll bleed. */
    @media (max-width: 600px) {
      body { padding-top: 52px; }
      #site-nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
      }
      #site-nav::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 0;
        right: 0;
        height: 100vh;
        background: var(--nav-bg);
        pointer-events: none;
      }
      #site-nav.nav-hidden {
        transform: translateY(-100%);
        opacity: 0;
      }
    }

    .nav-brand {
      font-family: var(--font-title);
      font-size: 0.78rem;
      letter-spacing: 0.2em;
      color: var(--gold);
      text-decoration: none;
      text-transform: uppercase;
      transition: color 0.2s;
      flex-shrink: 0;
    }
    .nav-brand:hover { color: var(--gold-light); }

    .nav-links {
      display: flex;
      gap: 1.75rem;
      list-style: none;
    }

    .nav-link {
      font-family: var(--font-title);
      font-size: 0.65rem;
      letter-spacing: 0.15em;
      color: var(--muted);
      text-decoration: none;
      text-transform: uppercase;
      transition: color 0.2s;
      position: relative;
      white-space: nowrap;
    }
    .nav-link::after {
      content: '';
      position: absolute;
      bottom: -3px; left: 0;
      width: 0; height: 1px;
      background: var(--gold);
      transition: width 0.2s;
    }
    .nav-link:hover { color: var(--gold-light); }
    .nav-link:hover::after { width: 100%; }
    .nav-link.active { color: var(--gold-light); }
    .nav-link.active::after { width: 100%; }

    /* Battle button */
    #nav-theme-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #battle-btn {
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid rgba(192,0,26,0.4);
      color: #c0001a;
      font-size: 0.6rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-family: var(--font-title, inherit);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      flex-shrink: 0;
      padding: 0 7px;
      white-space: nowrap;
    }
    #battle-btn:hover { background: rgba(192,0,26,0.12); border-color: #c0001a; }
    #battle-btn.on    { background: #c0001a; color: #f0ece4; border-color: #c0001a; }
    @media (max-width: 600px) { #battle-btn { display: none !important; } }

    /* Theme switcher */
    .nav-theme-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .nav-theme-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gold-dim);
      border: 1px solid var(--gold-dim);
      color: var(--gold);
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      line-height: 1;
      padding: 0;
    }
    .nav-theme-btn:hover {
      background: rgba(184,149,42,0.2);
      border-color: var(--gold-mid);
    }
    /* ── "Your Character" menu (Party caret) ── */
    .nav-party-item {
      display: inline-flex;
      align-items: center;
      gap: 1px;
      flex-shrink: 0;
    }
    .nav-party-caret {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 0.6rem;
      line-height: 1;
      padding: 2px 1px;
      transition: color 0.2s, transform 0.2s;
    }
    .nav-party-caret:hover { color: var(--gold-light); }
    .char-menu {
      position: fixed;
      top: 0;
      left: 0;
      min-width: 156px;
      background: var(--nav-bg);
      border: 1px solid var(--nav-border);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      z-index: 200;
    }
    .char-menu.open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .char-menu-label {
      font-family: var(--font-title);
      font-size: 0.48rem;
      letter-spacing: 0.35em;
      color: var(--muted);
      text-transform: uppercase;
      padding: 0.5rem 0.75rem 0.3rem;
      border-bottom: 1px solid var(--gold-dim);
      margin-bottom: 0.25rem;
    }
    .char-menu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.45rem 0.75rem;
      text-decoration: none;
      transition: background 0.15s;
    }
    .char-menu-row:hover { background: var(--gold-dim); }
    .char-menu-name {
      font-family: var(--font-title);
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--aged);
    }
    .char-menu-row:hover .char-menu-name { color: var(--gold-light); }
    .char-menu-go { color: var(--gold); font-size: 0.7rem; }

    /* Character switcher — sheet-v2.html only */
    .nav-char-switcher {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: 0.5rem;
    }
    .nav-char-divider {
      color: var(--nav-border);
      font-size: 0.9rem;
      user-select: none;
    }
    .nav-char-link {
      font-family: var(--font-title);
      font-size: 0.62rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      text-decoration: none;
      transition: color 0.2s;
      white-space: nowrap;
    }
    .nav-char-link:hover { color: var(--aged); }
    .nav-char-link.active {
      color: var(--gold-light);
      border-bottom: 1px solid var(--gold);
      padding-bottom: 1px;
    }

    @media (max-width: 700px) {
      .nav-links { gap: 0.85rem; }
      .nav-link { font-size: 0.56rem; }
      .nav-char-switcher { gap: 0.4rem; }
      .nav-char-link { font-size: 0.5rem; }
    }
    @media (max-width: 520px) {
      #site-nav { padding: 0 0.85rem; }
      /* Allow nav links to scroll horizontally rather than wrapping or overflowing */
      .nav-links {
        gap: 0.65rem;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        /* flex: 1 + min-width: 0 allows the links container to shrink and actually scroll
           rather than overflowing behind the theme button */
        flex: 1;
        min-width: 0;
        /* Fade right edge before the theme button */
        -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 88%, transparent 100%);
        mask-image: linear-gradient(to right, transparent 0%, black 5%, black 88%, transparent 100%);
      }
      .nav-links::-webkit-scrollbar { display: none; }
      .nav-link { font-size: 0.5rem; letter-spacing: 0.07em; white-space: nowrap; flex-shrink: 0; }
      .nav-char-divider { display: none; }
      .nav-char-link { font-size: 0.48rem; flex-shrink: 0; }
      /* Safe area bottom padding for iPhone notch on sticky elements */
      .nav-theme-wrap { flex-shrink: 0; }
    }
  `;
  document.head.appendChild(style);
}


// ── Mount the nav ──
function mountNav() {
  // Look for a placeholder div first
  const mount = document.getElementById('nav-root');
  if (mount) {
    mount.outerHTML = buildNav();
  } else {
    // Fallback: prepend to body
    document.body.insertAdjacentHTML('afterbegin', buildNav());
  }
  // ── nav:ready ──
  // The nav DOM (incl. #theme-dropdown and #battle-btn) now exists. Because the
  // session gate makes the mount async, consumers can't rely on DOMContentLoaded
  // — they listen for this signal instead. battle.js uses it to inject its
  // mobile battle section into the theme dropdown; future nav-dependent widgets
  // (e.g. the My Character menu) can wait on it too. Fires on every mount path.
  document.dispatchEvent(new CustomEvent('nav:ready'));
}

// ── Mount the universal right rail (Feed / Sheet / Codex / Settings) ──
// Loaded once on authenticated pages only (this runs after the session check,
// NOT on login.html, which returns before the authenticated branch). rail.js
// self-bootstraps its own CSS/fonts/feed-render dep and self-guards against a
// page that lacks the optional CHARACTERS / battle.js seam, so a single
// injection here is all any page needs — like the HUD, it rides along.
function mountRail() {
  if (document.getElementById('tok-rail-js')) return;   // inject once
  const s = document.createElement('script');
  s.id = 'tok-rail-js';
  s.src = 'rail.js';
  s.defer = true;
  document.body.appendChild(s);
}

// ── Mount the ◐ Settings flyout module ──
// settings-flyout.js owns the unified Settings surface (look, presets, seat
// accent, the absorbed cog). Injected like the rail: once, after auth.
// SETTINGS_V busts browser caches — bump it whenever settings-flyout.js
// changes (learned July 3: the un-stamped first deploy served stale files).
const SETTINGS_V = 10;
function mountSettings() {
  if (document.getElementById('tok-settings-js')) return;   // inject once
  // look-derive.js first: the flyout drives window.TokLook for the finish
  // gallery and the site-wide look; both stamped with the SAME version so
  // one bump busts both caches (the July 3 stale-deploy lesson).
  // async=false, NOT defer: dynamically inserted scripts IGNORE defer and
  // load async (order race) — async=false restores insertion-order execution,
  // so TokLook is guaranteed to exist before the flyout boots.
  const d = document.createElement('script');
  d.id = 'tok-look-derive-js';
  d.src = 'look-derive.js?v=' + SETTINGS_V;
  d.async = false;
  document.body.appendChild(d);
  const s = document.createElement('script');
  s.id = 'tok-settings-js';
  s.src = 'settings-flyout.js?v=' + SETTINGS_V;
  s.async = false;
  document.body.appendChild(s);
  // the character badge (identity, top-left) — after the flyout so
  // TokSettings.ACCENTS exists and the tok:accent listener is armed
  const b = document.createElement('script');
  b.id = 'tok-badge-js';
  b.src = 'character-badge.js?v=' + SETTINGS_V;
  b.async = false;
  document.body.appendChild(b);
}


// ── Init ──
// Theme applies immediately so the page never flickers to the wrong colours.
// Nav mount waits for the session check (~200ms) so unauthenticated users are
// redirected before the nav renders — no flash-then-kick.
injectNavStyles();
applyTheme();

(async function initNav() {
  // Supabase config — scoped locally so these can never collide with
  // constants future pages may declare (e.g. world.html for the battle map).
  // Publishable key is safe to expose by design; RLS guards the data.
  const SUPABASE_URL = 'https://cfthwspwpcfamgbfqzuq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_12KUwzDbVvcar0zjh2KE6g_6IRBfmMJ';
  const LOGIN_PAGE   = 'login.html';

  // login.html manages its own auth flow — skip the check there.
  const currentPage = getActivePath();
  if (currentPage === LOGIN_PAGE) {
    mountNav();
    return;
  }

  // ── Auth gate veil ──
  // Cover the already-rendered page with a themed spinner while we verify the
  // session, so an unauthenticated visitor never sees a flash of protected
  // content before the redirect fires. Only runs on gated pages (login.html
  // returned above). Removed on success; left up on the redirect path since
  // the page navigates away anyway. Uses theme vars so it matches the theme
  // that already applied.
  const veilStyle = document.createElement('style');
  veilStyle.textContent =
    '.nav-auth-spinner{width:38px;height:38px;border-radius:50%;' +
    'border:3px solid var(--gold-dim,rgba(184,149,42,.15));' +
    'border-top-color:var(--gold,#b8952a);' +
    'animation:nav-auth-spin .7s linear infinite}' +
    '@keyframes nav-auth-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(veilStyle);
  const authVeil = document.createElement('div');
  authVeil.innerHTML = '<div class="nav-auth-spinner"></div>';
  authVeil.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;' +
    'justify-content:center;background:var(--ink,#1a1410);' +
    'transition:opacity .2s ease;';
  (document.body || document.documentElement).appendChild(authVeil);
  function dropVeil() {
    authVeil.style.opacity = '0';
    setTimeout(() => authVeil.remove(), 200);
  }

  try {
    // Load Supabase client if not already present (login.html loads it too,
    // but other pages don't — so we inject the script tag and wait for it).
    if (typeof supabase === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload  = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await sb.auth.getSession();

    if (!data.session) {
      // No valid session — send to login. Leave the veil up; we're leaving.
      window.location.href = LOGIN_PAGE;
      return;
    }

    // Authenticate the REALTIME socket. Without this the socket connects with
    // the publishable key (anon-equivalent); our postgres_changes policies are
    // scoped `to authenticated`, so an anon socket receives NO events — live
    // sync silently dies while REST reads (which carry the JWT) still work, so
    // a refresh shows the data. Push the user's access token onto realtime here,
    // before any page subscribes to a channel. Re-applied on token refresh below.
    sb.realtime.setAuth(data.session.access_token);
    sb.auth.onAuthStateChange((_evt, session) => {
      if (session) sb.realtime.setAuth(session.access_token);
    });

    // ── Identity (whoami) ──
    // Expose the logged-in user's identity for downstream pages (role-aware
    // views, seat-defaulting, combat). nav.js already authenticated above and
    // holds the session, so we reuse it — no second client, no extra getSession.
    // The profile fetch runs in the BACKGROUND: it does NOT gate the veil, so
    // perceived load time is unchanged. Consumers do `await window.__tok.ready`.
    //   window.__tok.session : the raw Supabase session (token + user)
    //   window.__tok.ready   : promise → profile object, or null. Never rejects.
    //   window.__tok.profile : undefined until ready resolves, then object|null
    // profile shape: { id, userId, email, role, characterKey, username, grants, displayName }
    //   role         : 'overseer' | 'dm' | 'player' | 'pending'
    //   characterKey : 'cosmere' | 'caim' | 'liadan' | 'vesperian' | null
    //   username     : the account's own name (overseer-assigned), or null
    //   grants       : string[] of opt-in extra powers (inert until a feature checks one)
    //   displayName  : username || email local-part — what to SHOW for this account
    // A null profile means authenticated-but-no-profiles-row (unprovisioned/guest)
    // OR the lookup failed; 4a does not distinguish these — consumers decide in 4b.
    // role 'pending' is a self-provisioned account awaiting overseer approval: it
    // has a profile (so it shows a name) but is NOT a member (is_member() = false).
    window.__tok = window.__tok || {};
    window.__tok.session = data.session;
    // Expose the already-authenticated client so other pages (e.g. combat.html)
    // can read/subscribe WITHOUT creating a second supabase client — a second
    // client on the same page triggers the "Multiple GoTrueClient instances"
    // warning and splits auth/realtime state. Reuse this one.
    window.__tok.sb = sb;
    window.__tok.profile = undefined; // resolves to object|null via .ready
    window.__tok.ready = (async () => {
      const userId = data.session.user.id;
      const email  = data.session.user.email;
      let profile = null;
      try {
        const { data: row } = await sb
          .from('profiles')
          .select('id, role, character_key, username, grants')
          .eq('user_id', userId)
          .maybeSingle();
        if (row) {
          const username = row.username || null;
          profile = {
            id: row.id, userId, email,
            role: row.role,
            characterKey: row.character_key,
            username,
            grants: row.grants || [],
            displayName: username || (email ? email.split('@')[0] : 'Member'),
          };
        }
      } catch (e) {
        // Session valid but the profile lookup failed. Resolve null rather than
        // reject, so consumers can always `await` without a try/catch.
        profile = null;
      }
      window.__tok.profile = profile;
      return profile;
    })();

    // Authenticated — mount nav, then fade the veil to reveal the page.
    mountNav();
    populateCharMenu();   // reveals the Party caret + fills it once __tok resolves
    mountRail();          // the universal right-side rail (Feed/Sheet/…), like the HUD
    mountSettings();      // the ◐ Settings flyout (settings-flyout.js)
    dropVeil();
  } catch (e) {
    // Couldn't verify the session (e.g. the Supabase client failed to load).
    // Fail closed: redirect to login rather than hang on the spinner or risk
    // exposing the page.
    window.location.href = LOGIN_PAGE;
  }
})();

// ── Mobile: hide nav on scroll down, reveal on scroll up ──
// Runs on every page since nav.js is sitewide.
if (window.innerWidth <= 600) {
  let lastY   = window.scrollY;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const nav      = document.getElementById('site-nav');
        const currentY = window.scrollY;
        if (nav) nav.classList.toggle('nav-hidden', currentY > lastY && currentY > 60);
        lastY   = currentY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}
