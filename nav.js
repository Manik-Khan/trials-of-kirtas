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
  { label: 'NPCs',       path: 'npcs.html' },
  { label: 'World',      path: 'world.html' },
  { label: 'Lore',       path: 'lore.html' },
  { label: 'Compendium', path: 'compendium.html' },
  { label: 'Console',    path: 'bardic-console.html' },
];


// ── Available themes ──
// Add new themes here after adding their variables to theme.css.
// 'id' must match the [data-theme="id"] selector in theme.css.
// 'color' is the swatch dot color shown in the dropdown.
const THEMES = [
  { id: 'parchment',     label: 'Parchment',     color: '#b8952a' },
  { id: 'elysian',       label: 'Elysian',       color: '#8096dc' },
  { id: 'disco',         label: 'Disco',         color: '#c8622a' },
  { id: 'phantom',       label: 'Phantom',       color: '#c0001a' },
  { id: 'phantom-night', label: 'Phantom Night', color: '#111009' },
  // Add new themes here:
  // { id: 'mytheme', label: 'My Theme', color: '#hexcolor' },
];

const STORAGE_KEY = 'kirtas-theme';
const DEFAULT_THEME = 'parchment';


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


// ── Load saved theme ──
function getSavedTheme() {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME; }
  catch(e) { return DEFAULT_THEME; }
}


// ── Apply theme to document ──
function applyTheme(themeId) {
  const valid = THEMES.find(t => t.id === themeId);
  const id = valid ? themeId : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem(STORAGE_KEY, id); } catch(e) {}

  // Lazy-load Phantom fonts only when needed
  if (id === 'phantom' || id === 'phantom-night') {
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

  // Update dropdown UI if it exists
  document.querySelectorAll('.theme-option').forEach(el => {
    const isActive = el.dataset.theme === id;
    el.classList.toggle('active', isActive);
    el.querySelector('.theme-check').style.opacity = isActive ? '1' : '0';
  });
}


// ── Build nav HTML ──
function buildNav() {
  const activePath   = getActivePath();
  const currentTheme = getSavedTheme();
  const isSheet      = activePath === 'sheet.html';
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

  // Character switcher — only rendered on sheet.html
  const charSwitcher = isSheet ? `
    <div class="nav-char-switcher">
      <span class="nav-char-divider">|</span>
      ${CHARACTERS_NAV.map(c => `
        <a href="sheet.html?character=${c.key}"
           class="nav-char-link${c.key === activeChar ? ' active' : ''}">
          ${c.label}
        </a>`).join('')}
    </div>` : '';

  const themeOptions = THEMES.map(theme => `
    <div class="theme-option${currentTheme === theme.id ? ' active' : ''}"
         data-theme="${theme.id}"
         onclick="applyTheme('${theme.id}'); toggleThemeDropdown(event)">
      <span class="theme-dot" style="background:${theme.color}"></span>
      <span class="theme-name">${theme.label}</span>
      <span class="theme-check" style="opacity:${currentTheme === theme.id ? '1' : '0'}">✓</span>
    </div>
  `).join('');

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
                onclick="toggleThemeDropdown(event)"
                title="Change theme"
                aria-label="Change site theme">◐</button>
        <button class="nav-appearance-btn"
                onclick="event.stopPropagation();window.AppearanceUI&&window.AppearanceUI.open()"
                title="Customize appearance"
                aria-label="Customize appearance">⚙</button>
        <div class="appearance-drawer" id="appearance-drawer" aria-label="Appearance settings"></div>
        <div class="theme-dropdown" id="theme-dropdown">
          <div class="theme-dropdown-label">Theme</div>
          ${themeOptions}
        </div>
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


// ── Theme dropdown toggle ──
let dropdownOpen = false;

function toggleThemeDropdown(e) {
  e.stopPropagation();
  dropdownOpen = !dropdownOpen;
  const dropdown = document.getElementById('theme-dropdown');
  if (dropdown) dropdown.classList.toggle('open', dropdownOpen);
}

// Close on outside click
document.addEventListener('click', () => {
  if (dropdownOpen) {
    dropdownOpen = false;
    const dropdown = document.getElementById('theme-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  }
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
        `<a class="char-menu-row" href="sheet.html?character=${c.key}">` +
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
    .nav-appearance-btn {
      display: none;
      width: 28px; height: 28px;
      align-items: center; justify-content: center;
      background: var(--gold-dim);
      border: 1px solid var(--gold-dim);
      color: var(--gold);
      font-size: 0.92rem;
      cursor: pointer; padding: 0; line-height: 1;
      transition: background 0.2s, border-color 0.2s;
    }
    html.has-appearance .nav-appearance-btn { display: inline-flex; }
    .nav-appearance-btn:hover { background: rgba(184,149,42,0.2); border-color: var(--gold-mid); }
    @media (max-width: 600px) { .nav-appearance-btn { display: none !important; } }
    .appearance-drawer {
      position: fixed; top: 56px; right: 14px;
      width: 300px; max-height: calc(100vh - 72px); overflow-y: auto;
      background: rgba(10,16,15,0.98);
      border: 1px solid rgba(231,194,121,0.28);
      box-shadow: 0 18px 50px rgba(0,0,0,0.55);
      padding: 16px 16px 18px; z-index: 9999;
      opacity: 0; visibility: hidden; transform: translateY(-8px); pointer-events: none;
      transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s;
    }
    .appearance-drawer:empty { display: none; }
    .appearance-drawer.open { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }

    .theme-dropdown {
      position: absolute;
      top: 36px;
      right: 0;
      background: var(--nav-bg);
      border: 1px solid var(--nav-border);
      min-width: 130px;
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      z-index: 200;
    }
    .theme-dropdown.open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .theme-dropdown-label {
      font-family: var(--font-title);
      font-size: 0.48rem;
      letter-spacing: 0.35em;
      color: var(--muted);
      text-transform: uppercase;
      padding: 0.5rem 0.75rem 0.3rem;
      border-bottom: 1px solid var(--gold-dim);
      margin-bottom: 0.25rem;
    }

    .theme-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0.75rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .theme-option:hover { background: var(--gold-dim); }
    .theme-option.active { background: rgba(184,149,42,0.08); }

    .theme-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .theme-name {
      font-family: var(--font-title);
      font-size: 0.55rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--aged);
      flex: 1;
    }
    .theme-option.active .theme-name { color: var(--gold-light); }

    .theme-check {
      font-size: 0.6rem;
      color: var(--gold);
      transition: opacity 0.15s;
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

    /* Character switcher — sheet.html only */
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


// ── Init ──
// Theme applies immediately so the page never flickers to the wrong colours.
// Nav mount waits for the session check (~200ms) so unauthenticated users are
// redirected before the nav renders — no flash-then-kick.
injectNavStyles();
applyTheme(getSavedTheme());

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
