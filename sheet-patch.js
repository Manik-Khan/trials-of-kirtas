// =============================================================
// SHEET.HTML PATCH — Editable Equipment + Bio + Notes
// The Trials of Kirtas
//
// HOW TO APPLY:
// 1. In <head>, after the existing <script> tags, add:
//      <script src="character-store.js"></script>
//
// 2. Replace the Equipment tab render function (renderEquipmentTab)
//    with the version below.
//
// 3. Replace the Bio tab render function (renderBioTab)
//    with the version below.
//
// 4. After the existing DOMContentLoaded / init block, add
//    the CharacterStore init block at the bottom of this file.
//
// 5. Add the CSS block below into the existing <style> tag.
// =============================================================


// =============================================================
// CSS — add into existing <style> block in sheet.html
// =============================================================
/*

.cs-sync-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-title);
  font-size: 0.42rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--gold-dim);
  background: rgba(0,0,0,0.15);
}
.cs-sync-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--muted); flex-shrink: 0;
  transition: background 0.3s;
}
.cs-sync-dot.saving  { background: #c9b48a; }
.cs-sync-dot.saved   { background: #5a9a6a; }
.cs-sync-dot.error   { background: #c05060; }
.cs-sync-dot.loading { background: #5a9aaa; }

.cs-section-label {
  font-family: var(--font-title);
  font-size: 0.45rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 0.5rem 0 0.4rem;
  border-bottom: 1px solid var(--gold-dim);
  margin-bottom: 0.6rem;
}

.cs-currency-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  margin-bottom: 1.2rem;
}
.cs-currency-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--gold-dim);
  padding: 0.4rem 0.3rem;
}
.cs-currency-label {
  font-family: var(--font-title);
  font-size: 0.4rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.cs-currency-input {
  width: 100%;
  text-align: center;
  background: transparent;
  border: none;
  color: var(--parchment);
  font-family: var(--font-title);
  font-size: 0.85rem;
  outline: none;
  padding: 0;
}
.cs-currency-input:focus { border-bottom: 1px solid var(--gold-mid); }
.cs-currency-box.gp .cs-currency-label { color: var(--gold); }
.cs-currency-box.gp .cs-currency-input { color: var(--gold-light); }

.cs-inv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.cs-add-btn {
  font-family: var(--font-title);
  font-size: 0.42rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--gold-dim);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.12s;
}
.cs-add-btn:hover { color: var(--aged); border-color: var(--gold-mid); }

.cs-inv-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.5rem;
}
.cs-inv-table th {
  font-family: var(--font-title);
  font-size: 0.38rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: left;
  padding: 0.2rem 0.4rem 0.4rem;
  border-bottom: 1px solid var(--gold-dim);
}
.cs-inv-table th.right { text-align: right; }
.cs-inv-table td {
  padding: 0.45rem 0.4rem;
  border-bottom: 1px solid rgba(184,149,42,0.08);
  vertical-align: middle;
}
.cs-inv-name { font-family: var(--font-body); font-size: 0.88rem; color: var(--parchment); }
.cs-inv-detail { font-size: 0.72rem; color: var(--muted); font-family: var(--font-body); font-style: italic; }
.cs-inv-qty {
  font-family: var(--font-title);
  font-size: 0.8rem;
  color: var(--aged);
  text-align: center;
  width: 50px;
}
.cs-inv-qty-input {
  width: 40px;
  text-align: center;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--gold-dim);
  color: var(--parchment);
  font-family: var(--font-title);
  font-size: 0.8rem;
  padding: 0.1rem 0.2rem;
  outline: none;
}
.cs-inv-wt { font-size: 0.75rem; color: var(--muted); text-align: right; }
.cs-inv-del {
  width: 22px; height: 22px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.75rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.cs-inv-del:hover { color: #c05060; border-color: rgba(192,80,96,0.3); }

.cs-weight-bar {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--muted);
  padding: 0.4rem 0;
  border-top: 1px solid var(--gold-dim);
  margin-bottom: 1rem;
}
.cs-weight-bar span { color: var(--aged); }

.cs-item-search-wrap {
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--gold-dim);
  padding: 0.75rem;
  margin-bottom: 1rem;
}
.cs-item-search-wrap.hidden { display: none; }
.cs-item-search {
  width: 100%;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--gold-dim);
  color: var(--parchment);
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 0.35rem 0.6rem;
  outline: none;
  margin-bottom: 0.5rem;
}
.cs-item-search:focus { border-color: var(--gold-mid); }
.cs-item-search::placeholder { color: var(--muted); }
.cs-item-results {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.cs-item-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--gold-dim);
  background: transparent;
  color: var(--parchment);
  font-family: var(--font-body);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.1s;
  text-align: left;
  width: 100%;
}
.cs-item-result:hover { background: rgba(184,149,42,0.08); border-color: var(--gold-mid); }
.cs-item-result-meta { font-size: 0.72rem; color: var(--muted); font-style: italic; }
.cs-item-empty { font-size: 0.8rem; color: var(--muted); font-style: italic; padding: 0.3rem 0.5rem; }

.cs-notes-area {
  width: 100%;
  min-height: 100px;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--gold-dim);
  color: var(--parchment);
  font-family: var(--font-body);
  font-size: 0.9rem;
  line-height: 1.65;
  padding: 0.6rem 0.75rem;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s;
}
.cs-notes-area:focus { border-color: var(--gold-mid); }
.cs-notes-area::placeholder { color: var(--muted); }

.cs-bio-field { margin-bottom: 1rem; }
.cs-bio-label {
  font-family: var(--font-title);
  font-size: 0.4rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  display: block;
  margin-bottom: 0.3rem;
}

*/


// =============================================================
// EQUIPMENT TAB — replace renderEquipmentTab() in sheet.html
// =============================================================

function renderEquipmentTab(char) {
  const live = CharacterStore.get() || {};
  const inv  = live.inventory  || char.inventory  || [];
  const cur  = live.currency   || char.currency   || { pp:0, gp:0, ep:0, sp:0, cp:0 };
  const notes = live.notes     || '';

  // Total weight
  const totalWeight = inv.reduce((sum, item) => sum + ((parseFloat(item.weight)||0) * (parseInt(item.qty)||1)), 0);
  const weightStr   = totalWeight > 0 ? `${totalWeight.toFixed(1)} lb` : '—';

  return `
    <div class="cs-sync-bar">
      <div class="cs-sync-dot" id="cs-sync-dot"></div>
      <span id="cs-sync-label">Loading…</span>
    </div>

    <div style="padding: 0.75rem 1rem">

      <div class="cs-section-label">Currency</div>
      <div class="cs-currency-row">
        ${['pp','gp','ep','sp','cp'].map(coin => `
          <div class="cs-currency-box ${coin}">
            <div class="cs-currency-label">${coin.toUpperCase()}</div>
            <input class="cs-currency-input"
              type="number" min="0" value="${cur[coin]||0}"
              id="cs-cur-${coin}"
              onchange="csUpdateCurrency()"
              aria-label="${coin} coins">
          </div>`).join('')}
      </div>

      <div class="cs-inv-header">
        <div class="cs-section-label" style="margin-bottom:0;border-bottom:none;padding-bottom:0">Inventory</div>
        <button class="cs-add-btn" onclick="csToggleItemSearch()" id="cs-add-toggle">+ Add Item</button>
      </div>

      <div class="cs-item-search-wrap hidden" id="cs-item-search-wrap">
        <input class="cs-item-search" id="cs-item-search-input"
          placeholder="Search 5etools… e.g. Shortsword, Potion of Healing"
          oninput="csSearchItems(this.value)"
          autocomplete="off">
        <div class="cs-item-results" id="cs-item-results">
          <div class="cs-item-empty">Start typing to search items…</div>
        </div>
      </div>

      ${inv.length === 0 ? `
        <div style="color:var(--muted);font-style:italic;font-size:0.85rem;padding:0.5rem 0">No items yet. Use + Add Item to search the 5etools compendium.</div>
      ` : `
        <table class="cs-inv-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="right" style="width:50px">Qty</th>
              <th class="right" style="width:60px">Weight</th>
              <th style="width:28px"></th>
            </tr>
          </thead>
          <tbody id="cs-inv-body">
            ${inv.map((item, i) => `
              <tr data-idx="${i}">
                <td>
                  <div class="cs-inv-name">${escapeHtml(item.name)}</div>
                  ${item.detail ? `<div class="cs-inv-detail">${escapeHtml(item.detail)}</div>` : ''}
                </td>
                <td>
                  <input class="cs-inv-qty-input" type="number" min="0"
                    value="${item.qty||1}"
                    onchange="csUpdateQty(${i}, this.value)"
                    aria-label="Quantity for ${escapeHtml(item.name)}">
                </td>
                <td class="cs-inv-wt">${item.weight ? item.weight + ' lb' : '—'}</td>
                <td>
                  <button class="cs-inv-del" onclick="csDeleteItem(${i})" aria-label="Remove ${escapeHtml(item.name)}">✕</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="cs-weight-bar">Total weight <span>${weightStr}</span></div>
      `}

      <div class="cs-section-label" style="margin-top:1rem">Session Notes</div>
      <textarea class="cs-notes-area" id="cs-notes"
        placeholder="Ki points remaining, loot leads, reminders for next session…"
        oninput="csNotesChanged()">${escapeHtml(notes)}</textarea>

    </div>`;
}


// =============================================================
// BIO TAB — replace renderBioTab() in sheet.html
// =============================================================

function renderBioTab(char) {
  const live = CharacterStore.get() || {};
  const bio  = { ...char.bio, ...(live.bio || {}) }; // live data overrides static

  const fields = [
    { key: 'personality', label: 'Personality Traits' },
    { key: 'ideals',      label: 'Ideals' },
    { key: 'bonds',       label: 'Bonds' },
    { key: 'flaws',       label: 'Flaws' },
    { key: 'backstory',   label: 'Backstory' },
  ];

  return `
    <div class="cs-sync-bar">
      <div class="cs-sync-dot" id="cs-sync-dot-bio"></div>
      <span id="cs-sync-label-bio">Loading…</span>
    </div>
    <div style="padding:0.75rem 1rem">
      ${fields.map(f => `
        <div class="cs-bio-field">
          <label class="cs-bio-label" for="cs-bio-${f.key}">${f.label}</label>
          <textarea class="cs-notes-area" id="cs-bio-${f.key}"
            rows="${f.key === 'backstory' ? 5 : 3}"
            placeholder="${f.label}…"
            oninput="csBioChanged('${f.key}', this.value)"
          >${escapeHtml(bio[f.key]||'')}</textarea>
        </div>`).join('')}
    </div>`;
}


// =============================================================
// CHARACTERSTORE INIT + EVENT HANDLERS
// Add this block after your existing DOMContentLoaded init
// =============================================================

// ── Escape helper (if not already in sheet.html) ──
function escapeHtml(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Cached 5etools item data ──
let _itemsCache = null;

async function csLoadItems() {
  if (_itemsCache) return _itemsCache;
  try {
    const res  = await fetch('https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data/items.json');
    const json = await res.json();
    _itemsCache = (json.item || []).filter(i => i.name && i.type);
    return _itemsCache;
  } catch(e) {
    console.error('[cs] items fetch failed', e);
    return [];
  }
}

// ── Search handler ──
async function csSearchItems(query) {
  const resultsEl = document.getElementById('cs-item-results');
  if (!resultsEl) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    resultsEl.innerHTML = '<div class="cs-item-empty">Start typing to search items…</div>';
    return;
  }
  resultsEl.innerHTML = '<div class="cs-item-empty">Searching…</div>';
  const items = await csLoadItems();
  const matches = items.filter(i =>
    i.name.toLowerCase().includes(q)
  ).slice(0, 12);

  if (!matches.length) {
    resultsEl.innerHTML = '<div class="cs-item-empty">No items found.</div>';
    return;
  }
  resultsEl.innerHTML = matches.map(i => {
    const rarity = i.rarity && i.rarity !== 'none' ? ` · ${i.rarity}` : '';
    const weight = i.weight ? ` · ${i.weight} lb` : '';
    const detail = [i.type, i.weaponCategory, i.dmgType ? `${i.dmg1} ${i.dmgType}` : ''].filter(Boolean).join(' · ');
    return `<button class="cs-item-result" onclick="csAddItem(${JSON.stringify(JSON.stringify(i))})">
      <span>${escapeHtml(i.name)}</span>
      <span class="cs-item-result-meta">${escapeHtml(detail + rarity + weight)}</span>
    </button>`;
  }).join('');
}

// ── Add item from search ──
function csAddItem(itemJson) {
  const item = JSON.parse(itemJson);
  const live = CharacterStore.get() || {};
  const inv  = [...(live.inventory || [])];

  // Check if already in inventory — bump qty instead
  const existing = inv.findIndex(i => i.name === item.name);
  if (existing >= 0) {
    inv[existing] = { ...inv[existing], qty: (inv[existing].qty||1) + 1 };
  } else {
    const detail = [
      item.weaponCategory,
      item.dmg1 && item.dmgType ? `${item.dmg1} ${item.dmgType}` : null,
      item.ac ? `AC ${item.ac}` : null,
    ].filter(Boolean).join(' · ');

    inv.push({
      name:   item.name,
      detail: detail || null,
      qty:    1,
      weight: item.weight || null,
      source: item.source || null,
    });
  }

  CharacterStore.save({ inventory: inv }, currentIdentity?.name);

  // Reset search UI
  document.getElementById('cs-item-search-input').value = '';
  document.getElementById('cs-item-results').innerHTML = '<div class="cs-item-empty">Start typing to search items…</div>';

  // Re-render equipment tab
  switchTab('equipment');
}

// ── Update qty ──
function csUpdateQty(idx, val) {
  const live = CharacterStore.get() || {};
  const inv  = [...(live.inventory || [])];
  if (!inv[idx]) return;
  const qty = parseInt(val);
  if (qty <= 0) {
    inv.splice(idx, 1);
  } else {
    inv[idx] = { ...inv[idx], qty };
  }
  CharacterStore.save({ inventory: inv }, currentIdentity?.name);
}

// ── Delete item ──
function csDeleteItem(idx) {
  const live = CharacterStore.get() || {};
  const inv  = [...(live.inventory || [])];
  inv.splice(idx, 1);
  CharacterStore.save({ inventory: inv }, currentIdentity?.name);
  switchTab('equipment');
}

// ── Update currency ──
function csUpdateCurrency() {
  const coins = ['pp','gp','ep','sp','cp'];
  const currency = {};
  coins.forEach(c => {
    const el = document.getElementById(`cs-cur-${c}`);
    currency[c] = el ? parseInt(el.value)||0 : 0;
  });
  CharacterStore.save({ currency }, currentIdentity?.name);
}

// ── Toggle item search drawer ──
function csToggleItemSearch() {
  const wrap = document.getElementById('cs-item-search-wrap');
  const btn  = document.getElementById('cs-add-toggle');
  if (!wrap) return;
  const open = wrap.classList.toggle('hidden', !wrap.classList.contains('hidden'));
  btn.textContent = wrap.classList.contains('hidden') ? '+ Add Item' : '— Cancel';
  if (!wrap.classList.contains('hidden')) {
    document.getElementById('cs-item-search-input')?.focus();
  }
}

// ── Notes debounce ──
let _notesTimer = null;
function csNotesChanged() {
  clearTimeout(_notesTimer);
  _notesTimer = setTimeout(() => {
    const val = document.getElementById('cs-notes')?.value || '';
    CharacterStore.save({ notes: val }, currentIdentity?.name);
  }, 800);
}

// ── Bio field debounce ──
let _bioTimers = {};
function csBioChanged(field, value) {
  clearTimeout(_bioTimers[field]);
  _bioTimers[field] = setTimeout(() => {
    CharacterStore.save({ bio: { [field]: value } }, currentIdentity?.name);
  }, 800);
}

// ── Sync status indicator ──
function csUpdateSyncUI(status) {
  ['', '-bio'].forEach(suffix => {
    const dot   = document.getElementById(`cs-sync-dot${suffix}`);
    const label = document.getElementById(`cs-sync-label${suffix}`);
    if (!dot || !label) return;
    dot.className = 'cs-sync-dot ' + status;
    label.textContent = {
      idle:    'Up to date',
      loading: 'Loading…',
      saving:  'Saving…',
      saved:   'Saved',
      error:   'Error — changes not saved',
    }[status] || status;
  });
}

// ── Init — call this after the character key is known ──
// In sheet.html, add inside your existing init (where character key is parsed from URL):
//
//   const charKey = new URLSearchParams(window.location.search).get('character');
//   CharacterStore.load(charKey);
//   CharacterStore.onUpdate(({ type, status }) => {
//     if (type === 'status') csUpdateSyncUI(status);
//   });
//   window.addEventListener('beforeunload', () => CharacterStore.flush());
//
