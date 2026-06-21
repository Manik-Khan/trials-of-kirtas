// appearance.js
// ---------------------------------------------------------------------------
// Per-player Appearance engine for Trials of Kirtas.
//
//   import { initAppearance, buildAppearancePanel } from './appearance.js';
//   await initAppearance(supabase, uid);                 // on every themed page
//   buildAppearancePanel(document.getElementById('mount'), { supabase, uid });
//
// Injects a fixed background stack behind the page, applies a player's saved
// look (read from profiles.appearance jsonb), and can render the settings pane.
//
// INTEGRATION NOTES
//  - The background layers sit at NEGATIVE z-index, so the page body should be
//    transparent (or the deep ground colour) and let these layers be the ground.
//  - Backgrounds are file URLs under BG_PATH (Netlify CDN). Grain + weave are
//    tiny and embedded here so the module is self-contained.
//  - Saving writes only the player's own profiles row, covered by existing RLS.
// ---------------------------------------------------------------------------

import { BG_PATH, BACKGROUNDS, SHAPES, DEFAULT_APPEARANCE } from './appearance-data.js';

const WEAVE = "data:image/webp;base64,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";
const GRAIN = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='130' height='130'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>";

const STYLE = `
:root{--bg-hue:0deg;--bg-sat:1;--ac-hue:0deg;--bg-blur:0px;--bg-chroma:grayscale(0);--grain:.09;--fx-weave:0;--fx-scan:0;--fx-vig:0}
#tok-bg{position:fixed;inset:0;z-index:-4;pointer-events:none;background-position:center;background-size:cover;background-repeat:no-repeat;filter:hue-rotate(var(--bg-hue)) saturate(var(--bg-sat)) blur(var(--bg-blur)) var(--bg-chroma)}
#tok-veil{position:fixed;inset:0;z-index:-3;pointer-events:none;background:linear-gradient(180deg,rgba(10,20,18,.40),rgba(10,20,18,.22) 33%,rgba(10,20,18,.50)),radial-gradient(125% 105% at 50% 38%,transparent 50%,rgba(7,15,13,.55) 100%)}
#tok-weave{position:fixed;inset:0;z-index:-2;pointer-events:none;mix-blend-mode:overlay;opacity:var(--fx-weave);background-image:url("${WEAVE}");background-size:220px 220px;background-repeat:repeat}
#tok-scan{position:fixed;inset:0;z-index:-2;pointer-events:none;mix-blend-mode:overlay;opacity:var(--fx-scan);background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 1px,transparent 1px 3px)}
#tok-geo{position:fixed;inset:0;z-index:-2;pointer-events:none;width:100%;height:100%;mix-blend-mode:screen;opacity:0}
#tok-vig{position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:var(--fx-vig);background:radial-gradient(120% 100% at 50% 45%,transparent 42%,rgba(4,9,8,.96) 100%)}
#tok-grain{position:fixed;inset:0;z-index:9998;pointer-events:none;mix-blend-mode:overlay;opacity:var(--grain);background-image:url("${GRAIN}")}
.tok-ap-h{font-family:"Oswald",sans-serif;font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:#e7c279;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid rgba(231,194,121,.25)}
.tok-ap-sec{font-family:"Oswald",sans-serif;font-weight:500;letter-spacing:.14em;text-transform:uppercase;font-size:9.5px;color:#9fb3ad;margin:14px 0 7px}
.tok-ap-pick{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.tok-ap-sw{height:34px;border:1px solid rgba(236,226,205,.18);background-size:cover;background-position:center;cursor:pointer;padding:0;border-radius:0;transition:border-color .15s ease,transform .1s ease}
.tok-ap-sw:hover{transform:translateY(-1px)}
.tok-ap-sw.on{border-color:#e7c279;box-shadow:0 0 0 1px #e7c279}
.tok-ap-sel{display:block;width:100%;margin-top:2px;background:rgba(8,16,15,.92);color:#d8cdb4;border:1px solid rgba(236,226,205,.2);font-family:"Oswald",sans-serif;font-size:11px;letter-spacing:.04em;padding:6px 7px;border-radius:0}
.tok-ap-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 10px;font-family:"Oswald",sans-serif;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:#9fb3ad;margin-bottom:9px}
.tok-ap-row input[type=range]{grid-column:1 / -1;width:100%;accent-color:#e7c279;height:3px}
.tok-ap-row span{color:#d8cdb4;font-variant-numeric:tabular-nums}
.tok-ap-btns{display:flex;gap:8px;margin-top:16px}
.tok-ap-btns button{flex:1;background:transparent;border:1px solid rgba(236,226,205,.25);color:#d8cdb4;font-family:"Oswald",sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:8px;cursor:pointer;border-radius:0;transition:background .15s ease,border-color .15s ease,color .15s ease}
.tok-ap-btns button:hover{border-color:#e7c279;color:#e7c279}
.tok-ap-primary{background:rgba(231,194,121,.14)!important;border-color:rgba(231,194,121,.5)!important;color:#e7c279!important}
.tok-ap-saved{background:rgba(231,194,121,.32)!important}
`;

const DEFS = `<svg id="tok-appearance-defs" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs><filter id="glitch1" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="-2" dy="0" result="ro"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="2" dy="0" result="bo"/><feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter><filter id="glitch2" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="1" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" result="d"/><feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="-3.5" dy="0" result="ro"/><feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/><feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="3.5" dy="0" result="bo"/><feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter><filter id="glitch3" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="1" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/><feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="-6" dy="0" result="ro"/><feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/><feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="6" dy="0" result="bo"/><feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter><filter id="glitch4" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="1" seed="19" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="24" xChannelSelector="R" yChannelSelector="G" result="d"/><feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="-9" dy="0" result="ro"/><feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/><feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="9" dy="0" result="bo"/><feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter><pattern id="geo-hex" patternUnits="userSpaceOnUse" width="46" height="40"><path d="M11.5 1 L34.5 1 L46 20 L34.5 39 L11.5 39 L0 20 Z" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1.1"/></pattern><pattern id="geo-triangles" patternUnits="userSpaceOnUse" width="20" height="17.32"><path d="M0 0 L10 17.32 L20 0 M0 17.32 L10 0 L20 17.32 M0 0 H20 M0 17.32 H20" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern><pattern id="geo-diamonds" patternUnits="userSpaceOnUse" width="28" height="28"><path d="M14 0 L28 14 L14 28 L0 14 Z" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern><pattern id="geo-grid" patternUnits="userSpaceOnUse" width="26" height="26"><path d="M26 0 H0 V26" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern><pattern id="geo-dots" patternUnits="userSpaceOnUse" width="22" height="22"><circle cx="11" cy="11" r="1.7" fill="rgba(236,226,205,.82)"/></pattern><pattern id="geo-rings" patternUnits="userSpaceOnUse" width="30" height="30"><circle cx="15" cy="15" r="9" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern><pattern id="geo-crosses" patternUnits="userSpaceOnUse" width="24" height="24"><path d="M12 7 V17 M7 12 H17" fill="none" stroke="rgba(236,226,205,.82)" stroke-width="1"/></pattern></defs></svg>`;

const LAYERS_HTML =
  '<div id="tok-bg"></div><div id="tok-veil"></div><div id="tok-weave"></div>' +
  '<div id="tok-scan"></div>' +
  '<svg id="tok-geo" preserveAspectRatio="none"><rect id="tok-geo-rect" width="100%" height="100%" fill="url(#geo-hex)"></rect></svg>' +
  '<div id="tok-vig"></div><div id="tok-grain"></div>';

let injected = false;
function ensureLayers(){
  if (injected || typeof document === 'undefined' || !document.body) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'tok-appearance-style';
  style.textContent = STYLE;
  document.head.appendChild(style);
  document.body.insertAdjacentHTML('afterbegin', DEFS + LAYERS_HTML);
}

// Apply a saved look. Pure DOM/CSS, no network.
export function applyAppearance(a){
  ensureLayers();
  const bgEl = document.getElementById('tok-bg');
  if (!bgEl) return; // layers not mounted yet (called before <body>)
  a = Object.assign({}, DEFAULT_APPEARANCE, a || {});
  const r = document.documentElement.style;
  r.setProperty('--bg-hue', a.bgHue + 'deg');
  r.setProperty('--bg-sat', a.bgSat / 100);
  r.setProperty('--ac-hue', a.acHue + 'deg');
  r.setProperty('--bg-blur', a.blur + 'px');
  r.setProperty('--bg-chroma', a.glitch ? `url(#glitch${a.glitch})` : 'grayscale(0)');
  r.setProperty('--grain', a.grain / 100);
  r.setProperty('--fx-weave', a.weave / 100);
  r.setProperty('--fx-scan', a.scan / 100);
  r.setProperty('--fx-vig', a.vig / 100);

  const b = BACKGROUNDS.find(x => x.id === a.bg) || BACKGROUNDS[0];
  if (b.solid){ bgEl.style.backgroundImage = 'none'; bgEl.style.backgroundColor = b.solid; }
  else { const src = b.url || (BG_PATH + b.file); bgEl.style.backgroundImage = `url("${src}")`; bgEl.style.backgroundColor = 'transparent'; }

  const geo = document.getElementById('tok-geo');
  if (a.geoShape && a.geoShape !== 'none'){
    document.getElementById('tok-geo-rect').setAttribute('fill', `url(#geo-${a.geoShape})`);
    const pat = document.getElementById('geo-' + a.geoShape);
    if (pat) pat.setAttribute('patternTransform', `scale(${a.geoScale / 100})`);
    geo.style.opacity = a.geoInt / 100;
  } else {
    geo.style.opacity = 0;
  }
}

// Read the player's saved look from Supabase and apply it. Paints a default
// first so there is no flash before the row arrives.
export async function loadAppearance(supabase, uid){
  applyAppearance(DEFAULT_APPEARANCE);
  if (!supabase || !uid) return DEFAULT_APPEARANCE;
  try {
    const { data } = await supabase.from('profiles').select('appearance').eq('user_id', uid).maybeSingle();
    const a = Object.assign({}, DEFAULT_APPEARANCE, (data && data.appearance) || {});
    applyAppearance(a);
    return a;
  } catch (_) {
    return DEFAULT_APPEARANCE;
  }
}

// Persist a look. profiles writes are overseer-only, so this goes through the
// set_my_appearance RPC (SECURITY DEFINER, pinned to auth.uid()) which updates
// only the caller's own appearance column. `uid` is unused but kept for signature.
export function saveAppearance(supabase, uid, cfg){
  return supabase.rpc('set_my_appearance', { p_appearance: cfg });
}

// Convenience: mount layers + load the player's look in one call.
export async function initAppearance(supabase, uid){
  ensureLayers();
  return loadAppearance(supabase, uid);
}

// ---- Settings pane --------------------------------------------------------
// Renders the Appearance controls into `mount` and wires them live. Save writes
// to Supabase; Reset reverts the panel to DEFAULT_APPEARANCE (click Save to keep).
const SLIDERS = [
  ['Color',    [['bgHue','Background hue',-180,180,'deg'],['bgSat','Background saturation',0,200,'%'],['acHue','Accent hue',-180,180,'deg']]],
  ['Texture',  [['grain','Film grain',0,30,''],['weave','Canvas weave',0,70,''],['scan','Scanlines',0,50,'']]],
  ['Geometry', [['geoInt','Density',0,90,''],['geoScale','Scale',50,250,'']]],
  ['Lens',     [['blur','Blur',0,12,''],['vig','Vignette',0,80,''],['glitch','Glitch',0,4,'']]],
];

export function buildAppearancePanel(mount, opts){
  opts = opts || {};
  const cfg = Object.assign({}, DEFAULT_APPEARANCE, opts.current || {});
  const el = (t, p) => Object.assign(document.createElement(t), p || {});
  mount.innerHTML = '';
  mount.appendChild(el('div', { className:'tok-ap-h', textContent:'Appearance' }));

  // backgrounds
  mount.appendChild(el('div', { className:'tok-ap-sec', textContent:'Background' }));
  const pick = el('div', { className:'tok-ap-pick' });
  BACKGROUNDS.forEach(b => {
    const sw = el('button', { className:'tok-ap-sw', title:b.label });
    if (b.solid) sw.style.background = b.solid;
    else sw.style.backgroundImage = `url("${b.url || (BG_PATH + b.file)}")`;
    if (b.id === cfg.bg) sw.classList.add('on');
    sw.addEventListener('click', () => {
      cfg.bg = b.id;
      Array.prototype.forEach.call(pick.children, c => c.classList.remove('on'));
      sw.classList.add('on');
      applyAppearance(cfg);
    });
    pick.appendChild(sw);
  });
  mount.appendChild(pick);

  // geometry shape
  mount.appendChild(el('div', { className:'tok-ap-sec', textContent:'Geometry shape' }));
  const sel = el('select', { className:'tok-ap-sel' });
  SHAPES.forEach(sh => sel.appendChild(el('option', { value:sh.id, textContent:sh.label })));
  sel.value = cfg.geoShape;
  sel.addEventListener('change', () => { cfg.geoShape = sel.value; applyAppearance(cfg); });
  mount.appendChild(sel);

  // slider groups
  SLIDERS.forEach(group => {
    const title = group[0], rows = group[1];
    mount.appendChild(el('div', { className:'tok-ap-sec', textContent:title }));
    rows.forEach(row => {
      const key = row[0], label = row[1], min = row[2], max = row[3], unit = row[4];
      const wrap = el('label', { className:'tok-ap-row' });
      const out = el('span', { textContent: cfg[key] + unit });
      const inp = el('input', { type:'range', min:min, max:max, value: cfg[key] });
      inp.addEventListener('input', () => { cfg[key] = +inp.value; out.textContent = inp.value + unit; applyAppearance(cfg); });
      wrap.appendChild(document.createTextNode(label));
      wrap.appendChild(out);
      wrap.appendChild(inp);
      mount.appendChild(wrap);
    });
  });

  // buttons
  const btns = el('div', { className:'tok-ap-btns' });
  const save = el('button', { className:'tok-ap-primary', textContent:'Save' });
  const reset = el('button', { textContent:'Reset' });
  save.addEventListener('click', async () => {
    if (!opts.supabase || !opts.uid){
      save.textContent = 'Not signed in';
      setTimeout(() => { save.textContent = 'Save'; }, 1600);
      return;
    }
    save.textContent = 'Saving\u2026';
    try {
      const res = await saveAppearance(opts.supabase, opts.uid, cfg);
      if (res && res.error) throw res.error;          // .rpc() returns {error}, it doesn't throw
      save.textContent = 'Saved \u2713';
      save.classList.add('tok-ap-saved');
    } catch (e) {
      console.error('[appearance] save failed:', (e && e.message) || e);
      save.textContent = 'Save failed';
    }
    setTimeout(() => { save.textContent = 'Save'; save.classList.remove('tok-ap-saved'); }, 1600);
  });
  reset.addEventListener('click', () => {
    buildAppearancePanel(mount, Object.assign({}, opts, { current: {} }));
  });
  btns.appendChild(save);
  btns.appendChild(reset);
  mount.appendChild(btns);

  applyAppearance(cfg);
  return cfg;
}
