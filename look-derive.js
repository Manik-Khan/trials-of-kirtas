// ============================================================
// look-derive.js — one deriveLook() for the whole site
// The Trials of Kirtas
// ============================================================
//
// The site-wide color re-plumb's shared module, approved via mock v4
// (July 4): given the player's resolved ink + paper and a style
// { mode, wells, trim }, derive EVERY surface the site needs and,
// optionally, write them straight onto the theme.css token names as
// inline custom properties on <html> — inline style outranks any
// [data-theme] block, so token-faithful pages follow with zero edits.
//
// Vocabulary (mock v4, "finishes first, knobs demoted"):
//   FINISHES — five named macros over the three axes; the player-facing
//              vocabulary. Print on Sumi × Bone is the control case:
//              Phantom, derived instead of painted, so it can't rot.
//   mode   — 'follow' (ground=paper, text=ink — today's Phantom
//            orientation), 'dark' (a declared dark stage whatever the
//            paper), 'invert' (ink and paper trade places).
//   wells  — 'inked' (cards/panels carry the text color's hue) or
//            'neutral' (near-black / near-white blocks).
//   trim   — the dim-text voice on wells: 'auto' (ramp), 'gold'
//            (Parchment's aged #c9b48a, the font M missed), 'accent'.
//
// Contracts, pinned:
//   • NO catalog here. This module takes RESOLVED hex objects
//     ({ ink, accent } and { paper, dark }) so the ink/paper catalog
//     stays a two-party sync (settings-flyout.js ↔ shelfTheme.js) and
//     never grows a third mirror.
//   • Every derived tone is mixed HERE in JavaScript and emitted as an
//     rgb()/rgba() literal — no color-mix(), nothing newer than custom
//     properties reaches any stylesheet (the July 3 lesson).
//   • Fixed semantics (--hp-*, --prof-color, --crit-color, …) are NOT
//     touched: game meaning never follows the look.
//   • Truthful coincidence: with a dark ink on light paper, 'dark' and
//     'invert' produce the SAME page — they only diverge on light inks
//     and dark papers. The finish thumbnails show this honestly.
//
// Classic script; rides window.TokLook. Loaded by nav.js (stamped with
// SETTINGS_V) BEFORE settings-flyout.js, which drives it.
//
// July 4 (the wash migration, increment 2 — factions first): the WELL-
// SURFACE FAMILY joins the derivation, approved via the factions mock:
// modal gradient (cardBg warmed by the accent at the top, driven to the
// pole at the bottom), scrim, heraldry band, header ember, halftone dot
// color, card-muted, and accent-on-modal (legibility-guarded). All
// emitted as rgb()/rgba() literals like everything else, and written to
// NEW --look-* token names in ROOT_MAP — the fossil pages subscribe with
// their original hand-painted literals as var() fallbacks, so the
// switch-Off degrade is the pre-plumb page.
// ============================================================

(function () {
  'use strict';

  // ── the finish vocabulary (mock v4, approved) ──
  var FINISHES = [
    { key: 'print',      name: 'Print',      mode: 'follow', wells: 'neutral', trim: 'gold',
      desc: 'Your paper. Plain dark cards, gilded captions.' },
    { key: 'manuscript', name: 'Manuscript', mode: 'follow', wells: 'inked',   trim: 'auto',
      desc: 'Everything drawn from your ink.' },
    { key: 'ledger',     name: 'Ledger',     mode: 'follow', wells: 'neutral', trim: 'accent',
      desc: 'Plain cards; the accent does the talking.' },
    { key: 'stage',      name: 'Stage',      mode: 'dark',   wells: 'inked',   trim: 'auto',
      desc: 'The page goes dark, whatever the paper.' },
    { key: 'reversed',   name: 'Reversed',   mode: 'invert', wells: 'inked',   trim: 'auto',
      desc: 'Ink and paper trade places.' },
  ];
  var DEFAULT_STYLE = { mode: 'follow', wells: 'inked', trim: 'auto' };

  function finishOf(key) {
    for (var i = 0; i < FINISHES.length; i++) if (FINISHES[i].key === key) return FINISHES[i];
    return null;
  }
  // the finish a style corresponds to, if any (so tuning back INTO a finish
  // re-lights its card instead of stranding the player in Custom)
  function matchFinish(style) {
    for (var i = 0; i < FINISHES.length; i++) {
      var f = FINISHES[i];
      if (f.mode === style.mode && f.wells === style.wells && f.trim === style.trim) return f.key;
    }
    return null;
  }

  // ── color math: hex/rgb triples in, rgb()/rgba() literals out ──
  function toRGB(c) {
    if (Object.prototype.toString.call(c) === '[object Array]') return c;
    var n = parseInt(String(c).replace('#', ''), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function css(c) { c = toRGB(c); return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function cssA(c, a) { c = toRGB(c); return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')'; }
  function mix(a, b, t) {
    var A = toRGB(a), B = toRGB(b);
    return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  }
  function lum(c) {
    var s = toRGB(c).map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }
  function contrast(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  var DEEP = '#131110';               // the stage floor light inks deepen toward
  var GOLD_TRIM_ON_DARK  = '#c9b48a'; // Parchment's --aged — the gilded caption
  var GOLD_TRIM_ON_LIGHT = '#8a6d1e'; // same family, driven dark for light wells

  // ── deriveLook: (inkObj {ink,accent}, paperObj {paper,dark}, style) → surfaces ──
  // All values returned as rgb()/rgba() strings unless noted.
  function deriveLook(I, P, style) {
    style = style || DEFAULT_STYLE;
    var mode = style.mode || 'follow', wellsMode = style.wells || 'inked', trimMode = style.trim || 'auto';

    // page roles
    var g, t;
    if (mode === 'invert') { g = toRGB(I.ink); t = toRGB(P.paper); }
    else if (mode === 'dark') {
      if (P.dark) { g = toRGB(P.paper); t = toRGB(I.ink); }
      else if (lum(I.ink) < 0.25) { g = toRGB(I.ink); t = toRGB(P.paper); }
      else { g = mix(I.ink, DEEP, 0.80); t = toRGB(P.paper); }
    }
    else { g = toRGB(P.paper); t = toRGB(I.ink); }
    var acc = toRGB(I.accent);
    var groundDark = lum(g) < 0.35;

    // wells: opposite polarity of the ground; 'inked' keeps the text's hue,
    // 'neutral' collapses to near-black / near-white. The polarity PUSH
    // matters (mock v3's caught bug): under 'invert' a light ink makes the
    // text light too, so the well must be driven to the far side of the
    // ground, keeping the hue — a small nudge isn't enough.
    var wellDark = !groundDark;
    var cardBg;
    if (wellsMode === 'neutral') {
      cardBg = wellDark ? toRGB('#1a1a1a') : toRGB('#F2EFE7');
    } else {
      cardBg = wellDark
        ? (lum(t) < 0.35 ? mix(t, '#000000', 0.15) : mix(t, '#131110', 0.82))
        : (lum(t) >= 0.35 ? mix(t, '#FFFFFF', 0.06) : mix(t, '#F2EFE7', 0.78));
    }
    var cardT = g.slice();

    // trim: the dim-text voice on wells, with a converging legibility guard
    var trim;
    if (trimMode === 'gold')        trim = toRGB(lum(cardBg) < 0.35 ? GOLD_TRIM_ON_DARK : GOLD_TRIM_ON_LIGHT);
    else if (trimMode === 'accent') trim = mix(acc, cardT, 0.30);
    else                            trim = mix(cardT, cardBg, 0.32);
    for (var i = 0; i < 5 && contrast(trim, cardBg) < 2.0; i++) trim = mix(trim, cardT, 0.45);

    // nav chrome: derived dark, whatever the page does
    var navBg = P.dark ? mix(P.paper, '#000000', 0.35) : mix(I.ink, '#000000', 0.45);
    var navFg = P.dark ? mix(I.ink, P.paper, 0.15) : mix(P.paper, navBg, 0.12);

    // ── the well-surface family (July 4, factions mock, approved) ──
    // Everything a fossil page's hand-painted surfaces need, derived from
    // cardBg + accent + ground so the whole family moves with the look.
    var cardDark = lum(cardBg) < 0.35;
    // the modal gradient: cardBg warmed by the accent at the top, driven
    // toward the pole at the bottom. Fossil: #2a1e10 → #140f08.
    var modalG1 = mix(cardBg, acc, cardDark ? 0.10 : 0.06);
    var modalG2 = cardDark ? mix(modalG1, '#000000', 0.55)
                           : mix(modalG1, '#FFFFFF', 0.35);
    var modalDark = lum(modalG2) < 0.35;
    // accent voice ON the modal, pushed toward the far pole for legibility
    var accOnModal = modalDark ? mix(acc, '#FFFFFF', 0.25) : mix(acc, '#000000', 0.10);
    for (var j = 0; j < 5 && contrast(accOnModal, modalG1) < 2.0; j++)
      accOnModal = mix(accOnModal, modalDark ? '#FFFFFF' : '#000000', 0.30);

    return {
      groundDark: groundDark,                       // boolean, for polarity hooks
      g: css(g), t: css(t),
      gDeep: css(mix(g, groundDark ? '#000000' : '#FFFFFF', 0.30)),
      smoke: css(mix(g, t, 0.10)),
      t2: css(mix(t, g, 0.12)),
      dim: css(mix(t, g, 0.35)),
      mut: css(mix(t, g, 0.55)),
      acc: css(acc), accLight: css(mix(acc, '#FFFFFF', 0.14)),
      accDim: cssA(acc, 0.12), accMid: cssA(acc, 0.25),
      cardBg: css(cardBg), cardT: css(cardT),
      cardBorder: cssA(mix(t, g, 0.5), 0.35),
      well: css(mix(cardBg, lum(cardBg) < 0.35 ? '#000000' : '#FFFFFF', lum(cardBg) < 0.35 ? 0.38 : 0.10)),
      trim: css(trim),
      onAcc: css(contrast(acc, cardT) >= contrast(acc, g) ? cardT : g),
      sectionBg: cssA(t, 0.08), sectionBorder: cssA(t, 0.15),
      navBg: cssA(navBg, 0.98), navBorder: cssA(acc, 0.35),
      noise: groundDark ? '0.30' : '0.15',
      // the well-surface family
      cardMuted: css(mix(cardT, cardBg, 0.40)),      // alias lines on cards
      accStrong: cssA(acc, 0.35),                    // hover borders
      modalG1: css(modalG1), modalG2: css(modalG2),
      modalText2: css(mix(cardT, modalG2, 0.15)),
      modalMuted: css(mix(cardT, modalG2, 0.45)),
      accOnModal: css(accOnModal),
      scrim: groundDark ? cssA(mix(g, '#000000', 0.60), 0.85)
                        : cssA(mix(t, '#000000', 0.50), 0.55),
      band: cssA(mix(cardBg, cardDark ? '#000000' : '#FFFFFF', 0.30), 0.5),
      headerEmber: groundDark ? cssA(mix(acc, '#000000', 0.78), 0.8)
                              : cssA(acc, 0.08),
      dots: cssA('#000000', cardDark ? 0.3 : 0.08),
    };
  }

  // ── the root applier: derived surfaces → theme.css token names ──
  // Inline custom properties on <html> outrank every [data-theme] block,
  // so token-faithful pages follow instantly. Fixed semantics untouched.
  var ROOT_MAP = {
    '--ink': 'g', '--ink-deep': 'gDeep', '--smoke': 'smoke',
    '--parchment': 't', '--parchment2': 't2', '--aged': 'dim', '--muted': 'mut',
    '--gold': 'acc', '--gold-light': 'accLight', '--gold-dim': 'accDim', '--gold-mid': 'accMid',
    '--nav-bg': 'navBg', '--nav-border': 'navBorder',
    '--section-bg': 'sectionBg', '--section-border': 'sectionBorder',
    '--bubble-bg': 'cardBg', '--bubble-bg-right': 'well',
    '--noise-opacity': 'noise',
    // the well-surface family — NEW names (no theme.css legacy to reuse).
    // Fossil pages subscribe as var(--look-*, <original literal>) so the
    // degrade path is the hand-painted page.
    '--look-card-bg': 'cardBg', '--look-card-text': 'cardT',
    '--look-card-muted': 'cardMuted', '--look-card-border': 'cardBorder',
    '--look-well': 'well', '--look-trim': 'trim',
    '--look-accent-strong': 'accStrong',
    '--look-modal-g1': 'modalG1', '--look-modal-g2': 'modalG2',
    '--look-modal-text2': 'modalText2', '--look-modal-muted': 'modalMuted',
    '--look-accent-on-modal': 'accOnModal',
    '--look-scrim': 'scrim', '--look-band': 'band',
    '--look-header-ember': 'headerEmber', '--look-dots': 'dots',
  };
  var applied = false;
  function applyToRoot(derived) {
    var st = document.documentElement.style;
    for (var token in ROOT_MAP) st.setProperty(token, derived[ROOT_MAP[token]]);
    document.documentElement.setAttribute('data-look-polarity', derived.groundDark ? 'dark' : 'light');
    applied = true;
  }
  function clearRoot() {
    if (!applied) return;
    var st = document.documentElement.style;
    for (var token in ROOT_MAP) st.removeProperty(token);
    document.documentElement.removeAttribute('data-look-polarity');
    applied = false;
  }

  window.TokLook = {
    FINISHES: FINISHES,
    DEFAULT_STYLE: DEFAULT_STYLE,
    finishOf: finishOf,
    matchFinish: matchFinish,
    deriveLook: deriveLook,
    applyToRoot: applyToRoot,
    clearRoot: clearRoot,
    isApplied: function () { return applied; },
    // exposed for smokes and future consumers
    contrast: contrast, lum: lum, mix: function (a, b, t) { return css(mix(a, b, t)); },
  };
})();
