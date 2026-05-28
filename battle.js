// ============================================================
// battle.js — Battle Mode HUD Overlay
// The Trials of Kirtas
// ============================================================
//
// SETUP ON EACH PAGE:
// Just before </body>, after nav.js:
//   <script src="battle.js"></script>
//
// battle.js is self-contained. It:
//   1. Injects its own styles
//   2. Appends a ⚔ Battle button to #site-nav (after nav.js mounts)
//   3. Mounts a fixed-position HUD overlay on battle activation
//
// CHARACTER DEFAULT:
//   Reads localStorage 'kirtas-active-character' (set by sheet.html / chronicle.html).
//   Falls back to 'liadan' if nothing is stored.
// ============================================================

(function () {
  'use strict';

  // ── SVG icons for pip types ──
  const LSVG = `<svg viewBox="0 0 12 12"><path d="M8 1C10 1 11 2.5 11 4C11 6 9.5 7.5 8 7.5C7.2 7.5 6.6 7.2 6 6.8L2 10.5C1.6 11 1 10.5 1 10C1 9.5 1.4 9 1.8 8.6L5.5 5C5 4.4 4.5 3.8 4.5 3C4.5 1.8 6 1 8 1Z"/></svg>`;
  const FSVG = `<svg viewBox="0 0 13 13"><path d="M4 2L4 6L2 6C1.5 6 1 6.5 1 7L1 9C1 10.5 2.5 12 4 12L8 12C9.5 12 11 10.5 11 9L11 5C11 4.5 10.5 4 10 4L9 4L9 2C9 1.5 8.5 1 8 1C7.5 1 7 1.5 7 2L7 4L6 4L6 2C6 1.5 5.5 1 5 1C4.5 1 4 1.5 4 2Z"/></svg>`;

  // ── Battle cries ──
  const CRIES = [
    'Fight or DIE!',
    'Round 1... FIGHT',
    'Steel yourselves.',
    'For the Mousketeers.',
    'Into the dark.',
    'The mouse has entered combat.',
    'No mercy. No retreat.',
    'The Gold Leaf feels far away.',
    "Fight or DIE! (Please don't die.)",
    "Veren's Watch is watching.",
  ];

  // ── Character data ──
  // Hardcoded for now. Future: read from characters.js + data/characters/[name].json
  const CHARS = [
    {
      id: 'liadan', label: 'Líadan', initials: 'LL',
      color: '#1d9e75', colorDim: '#0d2a20',
      hp: 24, hpMax: 24, ac: 14, speed: 30, init: 2,
      saves: { STR: false, DEX: true, CON: false, INT: false, WIS: true, CHA: true },
      conditions: [],
      resources: [
        { key: 'bard',  label: 'Bardic',   type: 'lute',   cur: 3, max: 3, color: '#1d9e75' },
        { key: 'bard1', label: 'Bard L1',  type: 'circle', cur: 3, max: 4, color: '#1d9e75' },
        { key: 'bard2', label: 'Bard L2',  type: 'circle', cur: 1, max: 1, color: '#1d9e75' },
        { key: 'cler1', label: 'Cleric L1',type: 'circle', cur: 2, max: 2, color: '#5a8aaa' },
      ],
      splColor: '#1d9e75', splLabel: 'Spell',
      sets: [
        { label: 'Set A', actions: [
          { name: 'Vicious Mockery',    hit: '+5', dmg: '1d4 psych',    type: 'spell',  res: 'bard1' },
          { name: 'Mace',               hit: '+4', dmg: '1d6+2',        type: 'attack' },
          { name: 'Healing Word',       hit: '—',  dmg: '1d4+3 heal',   type: 'spell',  res: 'bard1' },
          { name: 'Guiding Bolt',       hit: '+4', dmg: '4d6 radiant',  type: 'spell',  res: 'cler1' },
        ]},
        { label: 'Set B', actions: [
          { name: 'Dissonant Whispers', hit: '+5', dmg: '3d6 psych',    type: 'spell',  res: 'bard1' },
          { name: 'Cure Wounds',        hit: '—',  dmg: '1d8+3',        type: 'spell',  res: 'cler1' },
          { name: 'Thunderwave',        hit: '—',  dmg: '2d8',          type: 'spell',  res: 'bard1' },
          { name: '— empty —',          hit: '',   dmg: '',             type: 'empty' },
        ]},
      ],
      bonActions: [
        { name: 'Healing Word',       hit: '—', dmg: '1d4+3',  type: 'spell', res: 'bard1' },
        { name: 'Bardic Inspiration', hit: '—', dmg: 'give d6', type: 'bardi', res: 'bard' },
      ],
      spells: [
        { name: 'Vicious Mockery',    hit: '+5', dmg: '1d4 psych', res: 'bard1' },
        { name: 'Healing Word',       hit: '—',  dmg: '1d4+3',     res: 'bard1' },
        { name: 'Dissonant Whispers', hit: '+5', dmg: '3d6',       res: 'bard1' },
        { name: 'Thunderwave',        hit: '—',  dmg: '2d8',       res: 'bard1' },
        { name: 'Cure Wounds',        hit: '—',  dmg: '1d8+3',     res: 'cler1' },
        { name: 'Guiding Bolt',       hit: '+4', dmg: '4d6',       res: 'cler1' },
      ],
    },
    {
      id: 'cosmere', label: 'Cosmere', initials: 'CR',
      color: '#9d4edd', colorDim: '#16101e',
      hp: 20, hpMax: 20, ac: 13, speed: 30, init: 2,
      saves: { STR: false, DEX: true, CON: false, INT: false, WIS: false, CHA: true },
      conditions: [],
      resources: [
        { key: 'pact',  label: 'Pact',    type: 'diamond', cur: 2, max: 3, color: '#9d4edd' },
        { key: 'sorc1', label: 'Sorc L1', type: 'circle',  cur: 2, max: 4, color: '#9d4edd', dim: true },
      ],
      splColor: '#9d4edd', splLabel: 'Spell',
      sets: [
        { label: 'Set A', actions: [
          { name: 'Eldritch Blast',   hit: '+5', dmg: '1d10 force', type: 'spell',  res: 'pact' },
          { name: 'Longsword',        hit: '+5', dmg: '1d8+3',      type: 'attack' },
          { name: 'Shield',           hit: '—',  dmg: '+5 AC',      type: 'spell',  res: 'pact' },
          { name: 'Hex (dmg)',        hit: '—',  dmg: '1d6 necro',  type: 'bonus' },
        ]},
        { label: 'Set B', actions: [
          { name: 'Misty Step',       hit: '—',  dmg: 'teleport 30ft', type: 'spell', res: 'pact' },
          { name: 'Hunger of Hadar',  hit: '—',  dmg: 'zone',          type: 'spell', res: 'pact' },
          { name: 'Eldritch Blast',   hit: '+5', dmg: '1d10 force',    type: 'spell', res: 'pact' },
          { name: '— empty —',        hit: '',   dmg: '',              type: 'empty' },
        ]},
      ],
      bonActions: [
        { name: 'Hex', hit: '—', dmg: 'curse target', type: 'spell', res: 'pact' },
      ],
      spells: [
        { name: 'Eldritch Blast',  hit: '+5', dmg: '1d10 force', res: 'pact' },
        { name: 'Shield',          hit: '—',  dmg: '+5 AC',      res: 'pact' },
        { name: 'Misty Step',      hit: '—',  dmg: 'teleport',   res: 'pact' },
        { name: 'Hunger of Hadar', hit: '—',  dmg: 'zone',       res: 'pact' },
        { name: 'Hex',             hit: '—',  dmg: 'curse',      res: 'sorc1' },
      ],
    },
    {
      id: 'caim', label: 'Caim', initials: 'Caim',
      color: '#c0001a', colorDim: '#1e0808',
      hp: 24, hpMax: 24, ac: 16, speed: 40, init: 3,
      saves: { STR: true, DEX: true, CON: false, INT: false, WIS: false, CHA: false },
      conditions: [],
      resources: [
        { key: 'ki', label: 'Ki', type: 'fist', cur: 3, max: 3, color: '#c0001a' },
      ],
      splColor: '#c0001a', splLabel: 'Ki',
      sets: [
        { label: 'Set A', actions: [
          { name: 'Unarmed Strike',   hit: '+5', dmg: '1d4+3',        type: 'attack' },
          { name: 'Flurry of Blows',  hit: '+5', dmg: '2×1d4+3',      type: 'ki',     res: 'ki', cost: 1 },
          { name: 'Grapple',          hit: '+5', dmg: 'restrain',      type: 'attack' },
          { name: "Healer's Kit",     hit: '—',  dmg: 'stabilize',     type: 'item' },
        ]},
        { label: 'Set B', actions: [
          { name: 'Unarmed Strike',   hit: '+5', dmg: '1d4+3',        type: 'attack' },
          { name: 'Hands of Mercy',   hit: '+5', dmg: '1d6+3+blind',  type: 'ki',     res: 'ki', cost: 1 },
          { name: 'Grapple',          hit: '+5', dmg: 'restrain',      type: 'attack' },
          { name: '— empty —',        hit: '',   dmg: '',             type: 'empty' },
        ]},
      ],
      bonActions: [
        { name: 'Unarmed Strike',    hit: '+5', dmg: '1d4+3',   type: 'attack' },
        { name: 'Patient Defense',   hit: '—',  dmg: 'Dodge',   type: 'ki', res: 'ki', cost: 1 },
        { name: 'Step of the Wind',  hit: '—',  dmg: 'Disengage', type: 'ki', res: 'ki', cost: 1 },
      ],
      spells: [
        { name: 'Flurry of Blows',  hit: '+5', dmg: '2×1d4+3',    res: 'ki', cost: 1 },
        { name: 'Patient Defense',  hit: '—',  dmg: 'Dodge',       res: 'ki', cost: 1 },
        { name: 'Step of the Wind', hit: '—',  dmg: 'Disengage',   res: 'ki', cost: 1 },
        { name: 'Hands of Mercy',   hit: '+5', dmg: '1d6+3+blind', res: 'ki', cost: 1 },
      ],
    },
    {
      id: 'vesperian', label: 'Vesperian', initials: 'VV',
      color: '#b8952a', colorDim: '#1a1408',
      hp: 32, hpMax: 32, ac: 18, speed: 30, init: 2,
      saves: { STR: true, DEX: false, CON: true, INT: false, WIS: false, CHA: false },
      conditions: [],
      resources: [
        { key: 'ek',    label: 'EK Slots', type: 'circle', cur: 2, max: 2, color: '#b8952a' },
        { key: 'surge', label: 'Surge',    type: 'circle', cur: 1, max: 1, color: '#b8952a' },
      ],
      splColor: '#b8952a', splLabel: 'EK',
      sets: [
        { label: 'Set A', actions: [
          { name: 'Longsword',       hit: '+5', dmg: '1d8+3 slash', type: 'attack' },
          { name: 'Longsword ×2',    hit: '+5', dmg: '2×1d8+3',     type: 'attack' },
          { name: 'Eldritch Blast',  hit: '+5', dmg: '1d10 force',  type: 'attack' },
          { name: 'Shield Bash',     hit: '+5', dmg: 'push+STR',    type: 'attack' },
        ]},
        { label: 'Set B', actions: [
          { name: 'Longsword',       hit: '+5', dmg: '1d8+3',       type: 'attack' },
          { name: 'Thrown Handaxe',  hit: '+5', dmg: '1d6+3',       type: 'attack' },
          { name: 'Eldritch Blast',  hit: '+5', dmg: '1d10 force',  type: 'attack' },
          { name: 'Healing Potion',  hit: '—',  dmg: '2d4+2 heal',  type: 'item' },
        ]},
      ],
      bonActions: [
        { name: 'Second Wind',  hit: '—', dmg: '1d10+3 heal', type: 'surge', res: 'surge' },
        { name: 'Action Surge', hit: '—', dmg: '+1 Action',   type: 'surge', res: 'surge' },
      ],
      spells: [
        { name: 'Shield',      hit: '—', dmg: '+5 AC react',  res: 'ek' },
        { name: 'Thunderwave', hit: '—', dmg: '2d8 thunder',  res: 'ek' },
      ],
    },
  ];

  // ── State ──
  const CHAR_KEY = 'kirtas-active-character';
  let battleOn    = false;
  let cIdx        = 0;
  let openPanelId = null;
  let activeSet   = 0;
  let resIdx      = 0;
  let holdTimer   = null;
  let rollTimer   = null;
  let toastTimer  = null;

  function C() { return CHARS[cIdx]; }

  function getDefaultCharIdx() {
    try {
      const saved = localStorage.getItem(CHAR_KEY);
      if (saved) {
        const idx = CHARS.findIndex(c => c.id === saved);
        if (idx >= 0) return idx;
      }
    } catch(e) {}
    return 0; // default: liadan
  }

  // ── Inject styles ──
  function injectStyles() {
    if (document.getElementById('battle-styles')) return;
    const style = document.createElement('style');
    style.id = 'battle-styles';
    style.textContent = `
      /* ── Nav additions ── */
      #battle-nav-group {
        display: none;
        align-items: center;
        gap: 5px;
        margin-left: 6px;
        flex-shrink: 0;
      }
      #battle-nav-group.visible { display: flex; }

      #battle-btn {
        padding: 3px 9px;
        border: 1.5px solid #c0001a;
        background: transparent;
        color: #c0001a;
        font-family: var(--font-title, 'Barlow Condensed', system-ui, sans-serif);
        font-size: 0.5rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
        flex-shrink: 0;
        line-height: 1;
        height: 24px;
      }
      #battle-btn:hover,
      #battle-btn.on { background: #c0001a; color: #f0ece4; }

      /* Character switcher — only visible in battle mode */
      #battle-char-switcher {
        display: none;
        align-items: center;
        gap: 4px;
      }
      #battle-char-switcher.visible { display: flex; }

      .bchar-tab {
        padding: 2px 6px;
        border-radius: 3px;
        border: 1px solid transparent;
        background: transparent;
        font-family: var(--font-title, 'Barlow Condensed', system-ui, sans-serif);
        font-size: 0.45rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted, #555);
        cursor: pointer;
        transition: all 0.12s;
        white-space: nowrap;
      }
      .bchar-tab:hover { color: var(--aged, #888); }
      .bchar-tab.on {
        color: #f0ece4;
        background: #1e1e2a;
        border-color: #2a2a3a;
      }

      /* ── Marquee strip ── */
      #battle-mq {
        position: fixed;
        top: 52px; /* below nav */
        left: 0; right: 0;
        height: 18px;
        background: #c0001a;
        overflow: hidden;
        z-index: 149;
        display: none;
      }
      #battle-mq.show { display: block; }
      .bm-inner {
        display: flex;
        align-items: center;
        height: 18px;
        white-space: nowrap;
        animation: bm-roll 14s linear infinite;
      }
      @keyframes bm-roll {
        from { transform: translateX(50%); }
        to   { transform: translateX(-100%); }
      }
      .bm-txt {
        font-family: var(--font-title, 'Barlow Condensed', system-ui, sans-serif);
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #f0ece4;
        padding: 0 20px;
      }
      .bm-sep { color: rgba(240,236,228,0.35); padding: 0 8px; }

      /* ── Flash overlay ── */
      #battle-flash {
        position: fixed;
        inset: 0;
        background: rgba(6,4,8,0.96);
        z-index: 300;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
      }
      #battle-flash.show { display: flex; }
      .bf-eye {
        font-family: var(--font-title, 'Barlow Condensed', system-ui, sans-serif);
        font-size: 9px;
        letter-spacing: 0.4em;
        text-transform: uppercase;
        color: rgba(192,0,26,0.5);
      }
      .bf-txt {
        font-family: var(--font-title, 'Barlow Condensed', system-ui, sans-serif);
        font-size: 2.8rem;
        font-weight: 900;
        text-transform: uppercase;
        color: #f0ece4;
        letter-spacing: 0.06em;
        line-height: 1.1;
        text-align: center;
        padding: 0 1.5rem;
      }
      .bf-sub {
        font-family: var(--font-title, 'Barlow Condensed', system-ui, sans-serif);
        font-size: 8px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(192,0,26,0.4);
        margin-top: 4px;
      }

      /* ── HUD container ── */
      #battle-hud {
        position: fixed;
        bottom: 16px;
        left: 12px;
        z-index: 150;
        display: none;
        flex-direction: column;
        gap: 5px;
        width: 300px;
        font-family: var(--font-title, 'Barlow Condensed', system-ui, sans-serif);
      }
      #battle-hud.show { display: flex; }

      /* Roll result */
      #b-rroll {
        background: #111018;
        border-left: 3px solid #b8952a;
        border-radius: 4px;
        padding: 6px 10px;
        display: none;
      }
      #b-rroll.show { display: block; }
      .b-rr-name { font-size: 10px; font-weight: 700; color: #f0ece4; }
      .b-rr-val  { font-size: 22px; font-weight: 900; color: #f0ece4; display: block; line-height: 1.1; }
      .b-rr-det  { font-size: 8px; color: #555; }

      /* Toast */
      #b-toast {
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 8px;
        letter-spacing: 0.06em;
        text-align: center;
        display: none;
      }
      #b-toast.show { display: block; }

      /* Orb + shelf row */
      .b-hud-row {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }

      /* ── Orb ── */
      .b-orb-zone {
        position: relative;
        width: 110px;
        height: 110px;
        flex-shrink: 0;
      }
      .b-orb-svg {
        position: absolute;
        top: 0; left: 0;
        width: 110px; height: 110px;
        pointer-events: none;
      }
      .b-orb-btn {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 62px; height: 62px;
        border-radius: 50%;
        background: #09090d;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: pointer; z-index: 6;
        user-select: none;
        transition: background 0.12s;
        border: none; outline: none;
      }
      .b-orb-btn:hover { background: #111018; }
      .b-orb-init    { font-size: 14px; font-weight: 900; line-height: 1; }
      .b-orb-hp-tag  { font-size: 7px; color: #5a9a6a; margin-top: 1px; }
      .b-orb-hp-tag.warn { color: #a07800; }
      .b-orb-hp-tag.crit { color: #c0001a; }
      .b-orb-res-lbl { font-size: 7px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
      .b-orb-res-cnt { font-size: 11px; font-weight: 900; line-height: 1; }
      .b-orb-hint    { font-size: 6px; color: #333; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1px; }

      /* Cardinal nodes */
      .b-rnode {
        position: absolute;
        border-radius: 50%;
        background: #09090d;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: pointer; z-index: 6;
        user-select: none;
        transition: background 0.12s;
        width: 30px; height: 30px;
      }
      .b-rnode:hover,
      .b-rnode.active { background: #1a1a2a; }
      .b-rnode-icon { font-size: 11px; }
      .b-rnode-lbl  { font-size: 6px; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1px; }
      .b-n-top    { top: 3px;    left: 50%; transform: translateX(-50%); }
      .b-n-right  { top: 50%;   right: 3px; transform: translateY(-50%); }
      .b-n-bottom { bottom: 3px; left: 50%; transform: translateX(-50%); }
      .b-n-left   { top: 50%;   left: 3px;  transform: translateY(-50%); }

      /* ── Shelf + panel ── */
      .b-shelf-zone {
        flex: 1;
        display: flex; flex-direction: column;
        gap: 5px; min-width: 0;
      }
      .b-shelf {
        background: #111018;
        border-radius: 5px;
        padding: 5px 8px;
        display: flex; flex-direction: column;
        gap: 3px;
      }
      .b-srow  { display: flex; align-items: center; gap: 4px; }
      .b-slbl  { font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; color: #444; width: 32px; flex-shrink: 0; }
      .b-pips  { display: flex; gap: 2px; align-items: center; flex-wrap: wrap; }

      /* Pips */
      .b-pc { width: 7px; height: 7px; border-radius: 50%; transition: all 0.2s; }
      .b-pd { width: 7px; height: 7px; transform: rotate(45deg); border-radius: 1px; transition: all 0.2s; }
      .b-on-teal  { background: #1d9e75; }
      .b-off-teal { background: #0d1e1e; border: 1px solid #1a2a20; }
      .b-on-blue  { background: #5a8aaa; }
      .b-off-blue { background: #0d1620; }
      .b-on-pur   { background: #9d4edd; }
      .b-off-pur  { background: #1e1028; border: 1px solid #2a1840; }
      .b-on-pur-d { background: #9d4edd; opacity: 0.4; }
      .b-on-red   { background: #c0001a; }
      .b-off-red  { background: #2a0a0a; border: 1px solid #3a0808; }
      .b-on-gold  { background: #b8952a; }
      .b-off-gold { background: #1a1408; }
      .b-lute, .b-fist { width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; }
      .b-lute svg, .b-fist svg { width: 10px; height: 10px; }
      .b-lute.on svg path  { fill: #1d9e75; }
      .b-lute.off svg path { fill: #0d1e1e; }
      .b-fist.on svg path  { fill: #c0001a; }
      .b-fist.off svg path { fill: #2a0a0a; }
      @keyframes b-lp { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .b-lute.on { animation: b-lp 2.2s ease-in-out infinite; }

      /* Panel */
      .b-panel {
        background: #0d0d14;
        border-radius: 8px;
        border: 1px solid #1e1e2a;
        overflow: hidden;
        display: none;
        max-height: 260px;
        overflow-y: auto;
      }
      .b-panel.show { display: block; }
      .b-ph {
        display: flex; align-items: center; gap: 5px;
        padding: 5px 8px;
        border-bottom: 1px solid #1e1e2a;
        position: sticky; top: 0;
        background: #0d0d14; z-index: 1;
      }
      .b-ph-dot   { width: 5px; height: 5px; border-radius: 50%; }
      .b-ph-title { font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; flex: 1; }
      .b-ph-close {
        font-size: 10px; color: #444; cursor: pointer;
        padding: 0 2px; background: none; border: none;
        font-family: inherit;
      }
      .b-ph-close:hover { color: #f0ece4; }

      /* Set tabs */
      .b-set-tabs { display: flex; border-bottom: 1px solid #1e1e2a; }
      .b-stab {
        flex: 1; padding: 4px; text-align: center;
        font-size: 7px; letter-spacing: 0.12em; text-transform: uppercase;
        cursor: pointer; color: #444;
        border-bottom: 2px solid transparent;
        background: none; border-left: none; border-right: none; border-top: none;
        font-family: inherit;
      }
      .b-stab.on { color: #f0ece4; }

      /* Action items */
      .b-aitem {
        display: flex; align-items: center; gap: 5px;
        padding: 6px 8px;
        border-bottom: 1px solid #131320;
        cursor: pointer;
        transition: background 0.1s;
      }
      .b-aitem:last-child { border-bottom: none; }
      .b-aitem:hover { background: #111018; }
      .b-aitem.empty { opacity: 0.25; cursor: default; pointer-events: none; }
      .b-ai-name { font-size: 11px; color: #e8e3da; flex: 1; }
      .b-ai-hit  { font-size: 10px; font-weight: 700; }
      .b-ai-dmg  { font-size: 8px; color: #555; }
      .b-ai-roll {
        width: 18px; height: 18px; border-radius: 3px;
        background: #1e1e2a; border: 1px solid #2a2a3a;
        display: flex; align-items: center; justify-content: center;
        font-size: 8px; color: #b8952a; flex-shrink: 0;
      }
      .b-ai-tag { font-size: 7px; padding: 1px 4px; border-radius: 2px; margin-left: 2px; }
      .b-tag-item  { background: rgba(184,149,42,0.12); color: #b8952a; }
      .b-tag-ki    { background: rgba(192,0,26,0.12);   color: #c0001a; }
      .b-tag-spell { background: rgba(157,78,221,0.1);  color: #9d4edd; }

      /* HP panel */
      .b-hp-panel { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
      .b-hp-track-row { display: flex; align-items: center; gap: 6px; }
      .b-hp-num  { font-size: 24px; font-weight: 900; color: #5a9a6a; line-height: 1; }
      .b-hp-max  { font-size: 12px; color: #444; align-self: flex-end; margin-bottom: 2px; }
      .b-hp-adj  { display: flex; gap: 3px; margin-left: auto; align-items: center; }
      .b-hp-adj-input {
        width: 36px; padding: 3px 4px;
        background: #111018; border: 1px solid #1e1e2a;
        border-radius: 3px; color: #f0ece4;
        font-family: inherit; font-size: 11px;
        text-align: center; outline: none;
      }
      .b-hp-adj-input:focus { border-color: #5a9a6a; }
      .b-hp-adj-btn {
        width: 26px; height: 26px; border-radius: 4px; border: 1px solid;
        background: #111018; color: inherit; font-size: 14px;
        font-family: inherit; cursor: pointer;
        display: flex; align-items: center; justify-content: center; line-height: 1;
      }
      .b-hp-adj-btn.dmg  { border-color: #c0001a; color: #c0001a; }
      .b-hp-adj-btn.heal { border-color: #5a9a6a; color: #5a9a6a; }
      .b-stat-grid {
        display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px;
      }
      .b-stat-box { background: #111018; border-radius: 3px; padding: 4px 6px; text-align: center; }
      .b-stat-val { font-size: 14px; font-weight: 700; color: #f0ece4; display: block; line-height: 1; }
      .b-stat-lbl { font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; color: #444; display: block; margin-top: 1px; }
      .b-sec-lbl  { font-size: 7px; letter-spacing: 0.2em; text-transform: uppercase; color: #333; margin-top: 2px; }
      .b-save-row, .b-cond-row { display: flex; flex-wrap: wrap; gap: 3px; }
      .b-save-pip {
        padding: 2px 5px; border-radius: 3px;
        font-size: 7px; letter-spacing: 0.08em; text-transform: uppercase; border: 1px solid;
      }
      .b-save-pip.prof  { background: rgba(58,122,80,0.12); border-color: rgba(58,122,80,0.3); color: #3a7a50; }
      .b-save-pip.no    { background: transparent; border-color: #1e1e2a; color: #333; }
      .b-cond {
        padding: 2px 5px; border-radius: 3px; font-size: 7px;
        background: #1e1e2a; border: 1px solid #2a2a3a; color: #555;
        cursor: pointer; transition: all 0.12s;
      }
      .b-cond.active { background: rgba(192,0,26,0.15); border-color: rgba(192,0,26,0.3); color: #c0001a; }

      /* Resource hold panel */
      .b-res-hold { padding: 8px; display: flex; flex-direction: column; gap: 3px; }
      .b-rh-row {
        display: flex; align-items: center; gap: 6px;
        padding: 5px 6px; border-radius: 4px;
        background: #111018; border: 1px solid #1e1e2a;
        cursor: pointer; transition: all 0.12s;
      }
      .b-rh-row:hover { border-color: #2a2a3a; }
      .b-rh-label { font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; width: 52px; flex-shrink: 0; }
      .b-rh-pips  { display: flex; gap: 2px; align-items: center; flex: 1; }
      .b-rh-count { font-size: 11px; font-weight: 700; margin-left: auto; }
      .b-rh-hint  { font-size: 7px; color: #333; margin-top: 3px; text-align: center; }
    `;
    document.head.appendChild(style);
  }

  // ── Pip HTML ──
  function pipHtml(r) {
    let h = '';
    for (let i = 0; i < r.max; i++) {
      const on = i < r.cur;
      if (r.type === 'lute') {
        h += `<div class="b-lute ${on ? 'on' : 'off'}" ${on ? `style="animation-delay:${i * 0.35}s"` : ''}>${LSVG}</div>`;
      } else if (r.type === 'fist') {
        h += `<div class="b-fist ${on ? 'on' : 'off'}">${FSVG}</div>`;
      } else if (r.type === 'diamond') {
        h += `<div class="b-pd ${on ? (r.dim ? 'b-on-pur-d' : 'b-on-pur') : 'b-off-pur'}"></div>`;
      } else {
        const oc = r.color === '#1d9e75' ? 'b-on-teal' : r.color === '#5a8aaa' ? 'b-on-blue' : r.color === '#b8952a' ? 'b-on-gold' : r.dim ? 'b-on-pur-d' : 'b-on-pur';
        const fc = r.color === '#1d9e75' ? 'b-off-teal' : r.color === '#5a8aaa' ? 'b-off-blue' : r.color === '#b8952a' ? 'b-off-gold' : 'b-off-pur';
        h += `<div class="b-pc ${on ? oc : fc}"></div>`;
      }
    }
    return h;
  }

  // ── Panel helpers ──
  function ph(color, title) {
    return `<div class="b-ph"><div class="b-ph-dot" style="background:${color}"></div><span class="b-ph-title" style="color:${color}">${title}</span><button class="b-ph-close" onclick="window.__battle.closePanel()">✕</button></div>`;
  }

  function aRow(a, color) {
    if (a.type === 'empty') return `<div class="b-aitem empty"><span class="b-ai-name" style="color:#333">— empty slot —</span></div>`;
    const c = C();
    const r = c.resources.find(r => r.key === a.res);
    const ok = !r || (r.cur >= (a.cost || 1));
    const tag = a.type === 'item'  ? '<span class="b-ai-tag b-tag-item">item</span>'
              : a.type === 'ki'    ? `<span class="b-ai-tag b-tag-ki">${a.cost || 1} ki</span>`
              : a.type === 'spell' ? '<span class="b-ai-tag b-tag-spell">spell</span>'
              : '';
    const hitStr = a.hit && a.hit !== '—' ? `<span class="b-ai-hit" style="color:${color}">${a.hit}</span>` : '';
    return `<div class="b-aitem ${ok ? '' : 'empty'}" onclick="window.__battle.doAction('${a.name}','${a.hit || ''}','${a.dmg || ''}','${a.type || ''}','${a.res || ''}',${a.cost || 1})">
      <span class="b-ai-name">${a.name}${tag}</span>
      ${hitStr}
      <span class="b-ai-dmg">${a.dmg}</span>
      <div class="b-ai-roll">d</div>
    </div>`;
  }

  // ── Render functions ──
  function renderOrb() {
    const c = C();
    const oi = document.getElementById('b-orbInit');
    if (!oi) return;
    oi.textContent = c.initials || c.label;
    oi.style.color = c.color;

    const ht = document.getElementById('b-orbHpTag');
    ht.textContent = c.hp + '/' + c.hpMax;
    ht.className = 'b-orb-hp-tag' + (c.hp <= Math.floor(c.hpMax * 0.25) ? ' crit' : c.hp <= Math.floor(c.hpMax * 0.5) ? ' warn' : '');

    const res = c.resources[resIdx % c.resources.length];
    const rl = document.getElementById('b-orbResLbl'); rl.textContent = res.label; rl.style.color = res.color;
    const rc = document.getElementById('b-orbResCnt'); rc.textContent = res.cur + '/' + res.max; rc.style.color = res.color;

    // Bottom node (spell/ki)
    const ns = document.getElementById('b-nSpl');
    ns.style.borderColor = c.splColor;
    ns.innerHTML = `<span class="b-rnode-icon" style="color:${c.splColor}">✦</span><span class="b-rnode-lbl" style="color:${c.splColor}">${c.splLabel}</span>`;

    // Rings
    const pr = c.resources[0], sr = c.resources[1];
    const co = 2 * Math.PI * 50, ci = 2 * Math.PI * 41;
    document.getElementById('b-ro-bg').setAttribute('stroke', c.colorDim);
    document.getElementById('b-ro').setAttribute('stroke', pr.color);
    document.getElementById('b-ro').setAttribute('stroke-dasharray', `${co * (pr.cur / pr.max)} ${co * (1 - pr.cur / pr.max)}`);
    if (sr) {
      document.getElementById('b-ri-bg').setAttribute('stroke', c.colorDim);
      document.getElementById('b-ri').setAttribute('stroke', sr.color || c.color);
      document.getElementById('b-ri').setAttribute('stroke-dasharray', `${ci * (sr.cur / sr.max)} ${ci * (1 - sr.cur / sr.max)}`);
      document.getElementById('b-ri').style.display = '';
      document.getElementById('b-ri-bg').style.display = '';
    } else {
      document.getElementById('b-ri').style.display = 'none';
      document.getElementById('b-ri-bg').style.display = 'none';
    }
  }

  function renderShelf() {
    const shelf = document.getElementById('b-shelf');
    if (!shelf) return;
    shelf.innerHTML = C().resources.map(r =>
      `<div class="b-srow"><span class="b-slbl">${r.label}</span><div class="b-pips">${pipHtml(r)}</div></div>`
    ).join('');
  }

  function renderAll() { renderOrb(); renderShelf(); openPanelId ? renderPanel(openPanelId) : hidePanel(); }

  function renderPanel(id) {
    const p = document.getElementById('b-panel');
    if (!p) return;
    p.classList.add('show');
    const c = C();
    if (id === 'act') {
      const set = c.sets[activeSet];
      let h = ph('#c0001a', 'Standard action');
      h += `<div class="b-set-tabs">${c.sets.map((s, i) => `<button class="b-stab ${i === activeSet ? 'on' : ''}" style="${i === activeSet ? 'color:#f0ece4;border-bottom:2px solid #c0001a;' : ''}" onclick="window.__battle.switchSet(${i})">${s.label}</button>`).join('')}</div>`;
      h += set.actions.map(a => aRow(a, '#c0001a')).join('');
      p.innerHTML = h;
    } else if (id === 'bon') {
      p.innerHTML = ph('#2d7dd2', 'Bonus action') + c.bonActions.map(a => aRow(a, '#2d7dd2')).join('');
    } else if (id === 'spl') {
      const lbl = c.id === 'caim' ? 'Ki abilities' : 'Spells';
      let h = ph(c.splColor, lbl);
      h += c.spells.map(a => {
        const r = c.resources.find(r => r.key === a.res);
        const ok = !r || (r.cur >= (a.cost || 1));
        const cost = a.cost ? `<span class="b-ai-tag b-tag-ki">${a.cost} ki</span>` : '';
        const cnt = r ? `<span style="font-size:8px;color:${r.color};margin-left:2px">${r.cur}</span>` : '';
        return `<div class="b-aitem ${ok ? '' : 'empty'}" onclick="window.__battle.doAction('${a.name}','${a.hit || ''}','${a.dmg || ''}','spell','${a.res || ''}',${a.cost || 1})">
          <span class="b-ai-name">${a.name}${cost}</span>
          ${a.hit && a.hit !== '—' ? `<span class="b-ai-hit" style="color:${c.splColor}">${a.hit}</span>` : ''}
          <span class="b-ai-dmg">${a.dmg}</span>${cnt}
          <div class="b-ai-roll">d</div>
        </div>`;
      }).join('');
      p.innerHTML = h;
    } else if (id === 'hp') {
      const savesH = Object.entries(c.saves).map(([k, v]) => `<div class="b-save-pip ${v ? 'prof' : 'no'}">${k}</div>`).join('');
      const conds = ['Poisoned','Frightened','Paralyzed','Prone','Stunned','Concentration'];
      const condH = conds.map(cd => `<div class="b-cond ${c.conditions.includes(cd) ? 'active' : ''}" onclick="window.__battle.toggleCond('${cd}')">${cd}</div>`).join('');
      p.innerHTML = `${ph('#5a9a6a','Stats & HP')}<div class="b-hp-panel">
        <div class="b-hp-track-row">
          <span class="b-hp-num" id="b-hpNum">${c.hp}</span><span class="b-hp-max">/ ${c.hpMax}</span>
          <div class="b-hp-adj">
            <input class="b-hp-adj-input" id="b-hpInput" type="number" min="1" max="99" value="1">
            <button class="b-hp-adj-btn dmg"  onclick="window.__battle.adjHp(-1)">−</button>
            <button class="b-hp-adj-btn heal" onclick="window.__battle.adjHp(1)">+</button>
          </div>
        </div>
        <div class="b-stat-grid">
          <div class="b-stat-box"><span class="b-stat-val">${c.ac}</span><span class="b-stat-lbl">AC</span></div>
          <div class="b-stat-box"><span class="b-stat-val">${c.speed}</span><span class="b-stat-lbl">Speed</span></div>
          <div class="b-stat-box"><span class="b-stat-val">+${c.init}</span><span class="b-stat-lbl">Init</span></div>
        </div>
        <div class="b-sec-lbl">Save Proficiencies</div><div class="b-save-row">${savesH}</div>
        <div class="b-sec-lbl">Conditions</div><div class="b-cond-row">${condH}</div>
      </div>`;
    } else if (id === 'res') {
      let h = ph(c.color, 'Resources — tap to spend');
      h += '<div class="b-res-hold">';
      h += c.resources.map(r => `<div class="b-rh-row" onclick="window.__battle.spendRes('${r.key}',1,false)">
        <span class="b-rh-label" style="color:${r.color}">${r.label}</span>
        <div class="b-rh-pips">${pipHtml(r)}</div>
        <span class="b-rh-count" style="color:${r.color}">${r.cur}/${r.max}</span>
      </div>`).join('');
      h += '<div class="b-rh-hint">tap a row to spend 1</div></div>';
      p.innerHTML = h;
    }
  }

  function openPanel(id) {
    openPanelId = id;
    renderPanel(id);
    document.querySelectorAll('.b-rnode').forEach(n => n.classList.remove('active'));
    const nodeMap = { act: 'b-nAct', bon: 'b-nBon', spl: 'b-nSpl' };
    if (nodeMap[id]) document.getElementById(nodeMap[id]).classList.add('active');
  }

  function hidePanel() {
    const p = document.getElementById('b-panel');
    if (p) p.classList.remove('show');
  }

  function closePanel() {
    openPanelId = null;
    hidePanel();
    document.querySelectorAll('.b-rnode').forEach(n => n.classList.remove('active'));
  }

  // ── Actions ──
  function switchSet(i) { activeSet = i; renderPanel('act'); }

  function doAction(name, hit, dmg, type, resKey, cost) {
    if (['ki','spell','bardi','surge'].includes(type)) spendRes(resKey, parseInt(cost) || 1, true);
    roll(name, hit, dmg);
    closePanel();
  }

  function spendRes(key, amt, silent) {
    const r = C().resources.find(r => r.key === key);
    if (!r || r.cur <= 0) return;
    r.cur = Math.max(0, r.cur - amt);
    renderOrb(); renderShelf();
    if (!silent) showToast(`${r.label}: ${r.cur}/${r.max}`, r.color);
    if (openPanelId === 'res') renderPanel('res');
  }

  function adjHp(dir) {
    const amt = Math.max(1, parseInt(document.getElementById('b-hpInput').value) || 1);
    const c = C();
    c.hp = Math.max(0, Math.min(c.hpMax, c.hp + (dir * amt)));
    document.getElementById('b-hpNum').textContent = c.hp;
    const ht = document.getElementById('b-orbHpTag');
    ht.textContent = c.hp + '/' + c.hpMax;
    ht.className = 'b-orb-hp-tag' + (c.hp <= Math.floor(c.hpMax * 0.25) ? ' crit' : c.hp <= Math.floor(c.hpMax * 0.5) ? ' warn' : '');
    showToast(`${dir > 0 ? '+' : ''}${dir * amt} HP → ${c.hp}/${c.hpMax}`, dir > 0 ? '#5a9a6a' : '#c0001a');
  }

  function toggleCond(cd) {
    const c = C(), i = c.conditions.indexOf(cd);
    i >= 0 ? c.conditions.splice(i, 1) : c.conditions.push(cd);
    renderPanel('hp');
  }

  function roll(name, hit, dmg) {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const mod = parseInt((hit || '+0').replace('+', '')) || 0;
    document.getElementById('b-rrName').textContent = name;
    document.getElementById('b-rrVal').textContent  = hit && hit !== '—' ? d20 + mod + ' to hit' : dmg;
    document.getElementById('b-rrDet').textContent  = hit && hit !== '—' ? `d20(${d20}) ${hit} · ${dmg}` : name;
    document.getElementById('b-rroll').classList.add('show');
    if (rollTimer) clearTimeout(rollTimer);
    rollTimer = setTimeout(() => document.getElementById('b-rroll').classList.remove('show'), 4000);
  }

  function showToast(msg, color) {
    const t = document.getElementById('b-toast');
    t.textContent = msg;
    t.style.background = color + '18';
    t.style.border = `1px solid ${color}44`;
    t.style.color = color;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  // ── HUD DOM ──
  function buildHudHTML() {
    return `
      <!-- Marquee -->
      <div id="battle-mq">
        <div class="bm-inner">
          <span class="bm-txt" id="bm-txt1">Fight or DIE!</span>
          <span class="bm-sep">✦</span>
          <span class="bm-txt">Round 1</span>
          <span class="bm-sep">✦</span>
          <span class="bm-txt" id="bm-txt2">Fight or DIE!</span>
        </div>
      </div>

      <!-- Flash -->
      <div id="battle-flash" onclick="window.__battle.dismissFlash()">
        <div class="bf-eye">Round 1</div>
        <div class="bf-txt" id="bf-txt">Fight or DIE!</div>
        <div class="bf-sub">tap to dismiss</div>
      </div>

      <!-- HUD overlay -->
      <div id="battle-hud">
        <div id="b-rroll">
          <div class="b-rr-name" id="b-rrName"></div>
          <span class="b-rr-val" id="b-rrVal"></span>
          <div class="b-rr-det" id="b-rrDet"></div>
        </div>
        <div id="b-toast"></div>
        <div class="b-hud-row">
          <!-- Orb -->
          <div class="b-orb-zone">
            <svg class="b-orb-svg" viewBox="0 0 110 110" fill="none">
              <circle cx="55" cy="55" r="50" id="b-ro-bg" stroke-width="3.5"/>
              <circle cx="55" cy="55" r="50" id="b-ro"    stroke-width="3.5" stroke-linecap="round" stroke-dashoffset="70"/>
              <circle cx="55" cy="55" r="41" id="b-ri-bg" stroke-width="2.5"/>
              <circle cx="55" cy="55" r="41" id="b-ri"    stroke-width="2.5" stroke-linecap="round" stroke-dashoffset="55" opacity="0.35"/>
            </svg>
            <!-- Cardinal nodes -->
            <div class="b-rnode b-n-top"   id="b-nAct" style="border:1.5px solid #c0001a;"  onclick="window.__battle.openPanel('act')">
              <span class="b-rnode-icon" style="color:#c0001a">⚔</span>
              <span class="b-rnode-lbl"  style="color:#c0001a">Act</span>
            </div>
            <div class="b-rnode b-n-right" id="b-nBon" style="border:1.5px solid #2d7dd2;"  onclick="window.__battle.openPanel('bon')">
              <span class="b-rnode-icon" style="color:#2d7dd2">⚡</span>
              <span class="b-rnode-lbl"  style="color:#2d7dd2">Bon</span>
            </div>
            <div class="b-rnode b-n-bottom" id="b-nSpl" onclick="window.__battle.openPanel('spl')"></div>
            <div class="b-rnode b-n-left"              style="border:1.5px solid #5a9a6a;"  onclick="window.__battle.openPanel('hp')">
              <span class="b-rnode-icon" style="color:#5a9a6a">♡</span>
              <span class="b-rnode-lbl"  style="color:#5a9a6a">Info</span>
            </div>
            <!-- Center orb button -->
            <button class="b-orb-btn" id="b-orbBtn">
              <span class="b-orb-init"    id="b-orbInit">LL</span>
              <span class="b-orb-hp-tag"  id="b-orbHpTag">24/24</span>
              <span class="b-orb-res-lbl" id="b-orbResLbl">Bardic</span>
              <span class="b-orb-res-cnt" id="b-orbResCnt">3/3</span>
              <span class="b-orb-hint">tap · hold</span>
            </button>
          </div>
          <!-- Shelf + panel -->
          <div class="b-shelf-zone">
            <div class="b-shelf" id="b-shelf"></div>
            <div class="b-panel" id="b-panel"></div>
          </div>
        </div>
      </div>
    `;
  }

  function mountHud() {
    if (document.getElementById('battle-hud')) return;
    const wrap = document.createElement('div');
    wrap.id = 'battle-hud-root';
    wrap.innerHTML = buildHudHTML();
    document.body.appendChild(wrap);

    // Orb tap → cycle resource, hold → open resource panel
    const ob = document.getElementById('b-orbBtn');
    ob.addEventListener('click', () => { resIdx = (resIdx + 1) % C().resources.length; renderOrb(); });
    ob.addEventListener('mousedown', () => { holdTimer = setTimeout(() => { holdTimer = null; openPanel('res'); }, 500); });
    ob.addEventListener('touchstart', () => { holdTimer = setTimeout(() => { holdTimer = null; openPanel('res'); }, 500); }, { passive: true });
    ['mouseup','mouseleave','touchend'].forEach(e => ob.addEventListener(e, () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }));
  }

  // ── Battle toggle ──
  function toggleBattle() {
    battleOn = !battleOn;
    const btn = document.getElementById('battle-btn');
    if (btn) btn.classList.toggle('on', battleOn);

    if (battleOn) {
      // Mount HUD on first activation
      mountHud();

      // Pick a random battle cry
      const cry = CRIES[Math.floor(Math.random() * CRIES.length)];
      document.getElementById('bf-txt').textContent   = cry;
      document.getElementById('bm-txt1').textContent  = cry;
      document.getElementById('bm-txt2').textContent  = cry;

      // Show flash + marquee + HUD
      document.getElementById('battle-flash').classList.add('show');
      document.getElementById('battle-mq').classList.add('show');
      document.getElementById('battle-hud').classList.add('show');

      // Show char switcher in nav
      const sw = document.getElementById('battle-char-switcher');
      if (sw) sw.classList.add('visible');

      // Render with current character
      renderAll();
    } else {
      // Hide everything
      const flash = document.getElementById('battle-flash');
      const mq    = document.getElementById('battle-mq');
      const hud   = document.getElementById('battle-hud');
      if (flash) flash.classList.remove('show');
      if (mq)    mq.classList.remove('show');
      if (hud)   hud.classList.remove('show');

      const sw = document.getElementById('battle-char-switcher');
      if (sw) sw.classList.remove('visible');

      closePanel();
    }
  }

  function dismissFlash() {
    const f = document.getElementById('battle-flash');
    if (f) f.classList.remove('show');
  }

  // ── Character switching ──
  function setChar(i) {
    cIdx = i; activeSet = 0; resIdx = 0; openPanelId = null;
    // Update nav tab highlights
    document.querySelectorAll('.bchar-tab').forEach((t, j) => t.classList.toggle('on', j === i));
    // Persist choice
    try { localStorage.setItem(CHAR_KEY, CHARS[i].id); } catch(e) {}
    // Clear roll/toast
    const rr = document.getElementById('b-rroll');
    const tt = document.getElementById('b-toast');
    if (rr) rr.classList.remove('show');
    if (tt) tt.classList.remove('show');
    renderAll();
  }

  // ── Inject Battle button + char switcher into nav ──
  function injectNavButton() {
    const nav = document.getElementById('site-nav');
    if (!nav) return; // nav.js hasn't mounted yet — shouldn't happen, but guard it

    // Build the group: char switcher + battle button
    const group = document.createElement('div');
    group.id = 'battle-nav-group';
    group.classList.add('visible');

    // Character switcher (hidden until battle is on)
    const switcher = document.createElement('div');
    switcher.id = 'battle-char-switcher';
    CHARS.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'bchar-tab' + (i === cIdx ? ' on' : '');
      btn.textContent = c.label;
      btn.addEventListener('click', () => setChar(i));
      switcher.appendChild(btn);
    });

    // Battle button
    const battleBtn = document.createElement('button');
    battleBtn.id = 'battle-btn';
    battleBtn.textContent = '⚔ Battle';
    battleBtn.addEventListener('click', toggleBattle);

    group.appendChild(switcher);
    group.appendChild(battleBtn);
    nav.appendChild(group);
  }

  // ── Expose public API for inline onclick handlers ──
  window.__battle = {
    openPanel,
    closePanel,
    switchSet,
    doAction,
    spendRes,
    adjHp,
    toggleCond,
    dismissFlash,
  };

  // ── Init ──
  injectStyles();
  cIdx = getDefaultCharIdx();
  injectNavButton();

})();
