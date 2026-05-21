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
  { label: 'Factions',   path: 'factions.html' },
  { label: 'Chronicle',  path: 'chronicle.html' },
  { label: 'NPCs',       path: 'npcs.html' },
  { label: 'World',      path: 'world.html' },
  { label: 'Lore',       path: 'lore.html' },
  { label: 'Compendium', path: 'compendium.html' },
];


// ── Available themes ──
// Add new themes here after adding their variables to theme.css.
// 'id' must match the [data-theme="id"] selector in theme.css.
// 'color' is the swatch dot color shown in the dropdown.
const THEMES = [
  { id: 'parchment', label: 'Parchment', color: '#b8952a' },
  { id: 'elysian',   label: 'Elysian',   color: '#8096dc' },
  { id: 'disco',     label: 'Disco',     color: '#c8622a' },
  // Add new themes here:
  // { id: 'mytheme', label: 'My Theme', color: '#hexcolor' },
];

const STORAGE_KEY = 'kirtas-theme';
const DEFAULT_THEME = 'parchment';


// ── Characters for the sheet switcher ──
// Add new characters here when the party grows
const CHARACTERS_NAV = [
  { key: 'tyros',     label: 'Tyros' },
  { key: 'caim',      label: 'Caim' },
  { key: 'liadan',    label: 'Líadan' },
  { key: 'vesperian', label: 'Vesperian' },
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
    return `<a href="${page.path}" class="nav-link${isActive ? ' active' : ''}">${page.label}</a>`;
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
        <button class="nav-theme-btn"
                onclick="toggleThemeDropdown(event)"
                title="Change theme"
                aria-label="Change site theme">◐</button>
        <div class="theme-dropdown" id="theme-dropdown">
          <div class="theme-dropdown-label">Theme</div>
          ${themeOptions}
        </div>
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
});


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
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--nav-border);
      padding: 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 52px;
      transition: background 0.3s ease, border-color 0.3s ease;
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
        /* Fade edges to hint scrollability */
        -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
        mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
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
    return;
  }
  // Fallback: prepend to body
  document.body.insertAdjacentHTML('afterbegin', buildNav());
}


// ── Init ──
injectNavStyles();
applyTheme(getSavedTheme());
mountNav();
