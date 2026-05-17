// ============================================================
// tooltips.js — Shared Tooltip System
// The Trials of Kirtas
// Supports: NPCs, Locations, Character Portraits
// ============================================================
//
// QUICK REFERENCE:
//
// Link an NPC in text:
//   <span class="npc-link" data-npc="darius">Darius</span>
//
// Link a location in text:
//   <span class="location-link" data-location="tiersgard">Tiersgard</span>
//
// Both pages need these two lines to activate tooltips:
//   <link rel="stylesheet" href="tooltips.css">       ← in <head>
//   <script src="tooltips.js"></script>               ← before </body>
//
// ============================================================


// ============================================================
// NPC DATA
// ============================================================
//
// HOW TO ADD A NEW NPC:
// 1. Add an entry below following the same format
// 2. Key must be lowercase with no spaces (e.g. 'captainaldric')
// 3. portrait is optional — if present, put the image at:
//    img/portraits/keyname.png  and set portrait: true
//
// status options: 'alive' | 'dead' | 'unknown' | 'hostile'
//
// ── ADD NEW NPCS IN THIS OBJECT ──

const NPC_DATA = {

  // ── Party Members ──

  tyros: {
    name: 'Tyros Darkstar',
    role: 'Warlock (The Hexblade) · Level 3 · Astral Elf',
    status: 'alive',
    portrait: true,
    desc: 'An Astral Elf warlock of the Hexblade pact, bearing the subclass of The Hexblade. Captain by background, Chaotic Good by nature. Wielder of Eldritch Blast and the longsword.'
  },

  caim: {
    name: 'Caim',
    role: 'Party Member · Killshot',
    status: 'alive',
    portrait: true,
    desc: 'A tiefling of striking appearance, crouched in the streets of Tiersgard with the quiet watchfulness of someone who has learned survival the hard way.'
  },

  liadan: {
    name: 'Líadan Luchóg',
    role: 'Party Member · Nazzy',
    status: 'alive',
    portrait: true,
    desc: 'A quick-witted mouse-folk bard, lute in hand and feathered cap tilted at a jaunty angle. Do not let the size fool you.'
  },

  vesperian: {
    name: 'Vesperian Vale',
    role: 'Party Member',
    status: 'alive',
    portrait: true,
    desc: 'A brooding elven figure bearing a runic shield and a spectral owl familiar, conjured from shadow and blue flame. Walks the line between arcane scholar and something far darker.'
  },

  // ── Named NPCs ──

  tyrus: {
    name: 'Tyrus Ranec',
    role: 'King of Kirtas — The Wolven',
    status: 'alive',
    portrait: false,
    desc: 'The king\'s younger brother who assumed the throne after Aluin III\'s death. Crueler and more paranoid than he once was, but still dreams of reunifying the kingdom under his banner.'
  },

  darius: {
    name: 'General Darius',
    role: 'Leader — Alliance to Restore Kirtas',
    status: 'alive',
    portrait: false,
    desc: 'The former king\'s most senior general. Encamped in the Long Hills with Lord Reykoldt, fighting on in the name of a prince few believe still lives.'
  },

  reykoldt: {
    name: 'Lord Reykoldt',
    role: 'Duke of Yevennia — Blue Jackets',
    status: 'alive',
    portrait: false,
    desc: 'The former king\'s closest advisor and one of the last surviving members of the King\'s Council. Holds Darius\'s forces together through iron will and political acumen.'
  },

  prince: {
    name: 'The Young Prince',
    role: 'Heir to the Kirtas Throne',
    status: 'unknown',
    portrait: false,
    desc: 'Born two months after Tyrus\'s ascension to a royal concubine. The rightful heir — or so Darius claims. He has not been seen in years. Many suspect he is dead.'
  },

  aluin: {
    name: 'Aluin Ranec III',
    role: 'Former King of Kirtas — Deceased',
    status: 'dead',
    portrait: false,
    desc: 'Ruled vigorously for decades before dying of pox. Unable to produce a male heir, he named his brother Tyrus as successor — a decision that tore the kingdom apart.'
  },

  eneos: {
    name: 'King Eneos II',
    role: 'King of Numior',
    status: 'alive',
    portrait: false,
    desc: 'The young king of Numior and a strong supporter of the Red Eagles. Increasingly drawn to hawkish advisors urging expansion into Kirtas while the kingdom is distracted.'
  },

  rhadig: {
    name: 'Rhadig of Koria',
    role: 'Commander — Band of the Rook',
    status: 'hostile',
    portrait: false,
    desc: 'A brutal and unscrupulous man who took command of the once-honorable Band of the Rook after Ryol\'s Creek. Under him, the regiment has become little more than bandits.'
  },

  solci: {
    name: 'Lucius Solci',
    role: 'Commander — The Stags',
    status: 'unknown',
    portrait: false,
    desc: 'A former Dalarian general turned mercenary. A skillful tactician who keeps his regiment fresh and disciplined, currently hired by King Eneos of Numior.'
  }

  // ── ADD NEW NPCS ABOVE THIS LINE ──
  // Don't forget the comma after the previous entry!
  //
  // Example with portrait:
  // aldric: {
  //   name: 'Captain Aldric',
  //   role: 'Gate Captain — Tiersgard City Watch',
  //   status: 'alive',
  //   portrait: true,       ← set true when img/portraits/aldric.png exists
  //   desc: 'A weathered veteran who has kept the peace at Tiersgard\'s eastern gate.'
  // },

};


// ============================================================
// LOCATION DATA
// ============================================================
//
// HOW TO ADD A NEW LOCATION:
// 1. Add an entry below following the same format
// 2. Key must be lowercase with no spaces (e.g. 'longhills')
//
// status options:
//   'neutral'   — independent or unaligned
//   'wolven'    — held by Tyrus / The Wolven
//   'bluejacks' — held by Darius / Blue Jackets
//   'contested' — fought over by multiple factions
//   'dangerous' — controlled by monsters, undead, etc.
//   'foreign'   — outside Kirtas
//   'unknown'   — party hasn't been here yet
//
// ── ADD NEW LOCATIONS IN THIS OBJECT ──

const LOCATION_DATA = {

  tiersgard: {
    name: 'Tiersgard',
    type: 'Coastal Trade City — The Andan Sea',
    status: 'neutral',
    desc: 'The only city that retains a semblance of its former glory. Merchants grow rich on the tools of war while agents from both sides operate in its streets. Ostensibly neutral.'
  },

  capital: {
    name: 'The Capital',
    type: 'Royal Seat — Kirtas',
    status: 'wolven',
    desc: 'Held by Tyrus and his remaining veteran regiments. The seat of Kirtian power for generations, now garrisoned by a king increasingly desperate for men and coin.'
  },

  yevennia: {
    name: 'Yevennia',
    type: 'Duchy — Kirtas',
    status: 'contested',
    desc: 'Home of Lord Reykoldt, where Darius and the King\'s Council first rallied in support of the young prince. The seat of the original rebellion against Tyrus.'
  },

  longhills: {
    name: 'The Long Hills',
    type: 'Highland Region — Northern Kirtas',
    status: 'bluejacks',
    desc: 'Where Darius and Lord Reykoldt have encamped with the remnants of their forces. Remote, defensible, and slowly becoming a legend in its own right.'
  },

  kharak: {
    name: 'The Kharak Mountains',
    type: 'Mountain Range — South-East Kirtas',
    status: 'dangerous',
    desc: 'A natural barrier between Kirtas and the kingdom of Numior. Orc and Goblin warbands pour from the passes as the border watches have collapsed.'
  },

  ilora: {
    name: 'Ilora',
    type: 'Elven Forest — North-East',
    status: 'dangerous',
    desc: 'The great Elven forest, whose inhabitants have withdrawn entirely from the outside world. Those who stray near the treeline seldom return.'
  },

  numior: {
    name: 'Numior',
    type: 'Kingdom — South of the Kharak Range',
    status: 'foreign',
    desc: 'Once a vassal state of Kirtas, now an independent kingdom growing in confidence and military ambition. King Eneos II watches the north with hungry eyes.'
  }

  // ── ADD NEW LOCATIONS ABOVE THIS LINE ──
  // Don't forget the comma after the previous entry!
  //
  // Example:
  // ryolscreek: {
  //   name: "Ryol's Creek",
  //   type: 'Battlefield — Central Kirtas',
  //   status: 'dangerous',
  //   desc: 'Site of the devastating battle that destroyed the Band of the Rook.'
  // },

};


// ============================================================
// TOOLTIP ENGINE — no need to edit below this line
// ============================================================

const npcStatusLabels = {
  alive:   'Alive',
  dead:    'Deceased',
  unknown: 'Whereabouts Unknown',
  hostile: 'Hostile'
};

const locationStatusLabels = {
  neutral:   'Neutral',
  wolven:    'Wolven-Held',
  bluejacks: 'Blue Jackets Territory',
  contested: 'Contested',
  dangerous: 'Dangerous',
  foreign:   'Foreign Power',
  unknown:   'Uncharted'
};

// Single shared tooltip element
const tooltip = document.createElement('div');
tooltip.id = 'kirtas-tooltip';
tooltip.setAttribute('aria-hidden', 'true');
document.body.appendChild(tooltip);

let hideTimeout = null;

function showNpcTooltip(el) {
  const key = el.dataset.npc;
  const npc = NPC_DATA[key];
  if (!npc) return;

  clearTimeout(hideTimeout);

  const statusLabel = npcStatusLabels[npc.status] || npc.status;
  const portraitExt = key === 'vesperian' ? 'jpg' : 'png';
  const portraitHtml = npc.portrait
    ? `<img class="tt-portrait" src="img/portraits/${key}.${portraitExt}" alt="${npc.name}" onerror="this.style.display='none'">`
    : '';

  tooltip.className = 'tt-npc';
  tooltip.innerHTML = `
    ${portraitHtml}
    <div class="tt-name">${npc.name}</div>
    <div class="tt-role">${npc.role}</div>
    <div class="tt-status tt-status--${npc.status}">${statusLabel}</div>
    <div class="tt-desc">${npc.desc}</div>
  `;

  tooltip.classList.add('visible');
  positionTooltip(el, npc.portrait);
}

function showLocationTooltip(el) {
  const key = el.dataset.location;
  const loc = LOCATION_DATA[key];
  if (!loc) return;

  clearTimeout(hideTimeout);

  const statusLabel = locationStatusLabels[loc.status] || loc.status;

  tooltip.className = 'tt-location';
  tooltip.innerHTML = `
    <div class="tt-location-icon">◈</div>
    <div class="tt-name">${loc.name}</div>
    <div class="tt-role">${loc.type}</div>
    <div class="tt-status tt-status--loc-${loc.status}">${statusLabel}</div>
    <div class="tt-desc">${loc.desc}</div>
  `;

  tooltip.classList.add('visible');
  positionTooltip(el, false);
}

function hideTooltip() {
  hideTimeout = setTimeout(() => {
    tooltip.classList.remove('visible');
  }, 120);
}

function positionTooltip(el, hasPortrait) {
  const rect = el.getBoundingClientRect();
  const ttWidth  = 280;
  const ttHeight = hasPortrait ? 320 : 220;
  const margin   = 12;

  // Use viewport coordinates (no scrollY) since tooltip is position:fixed
  let left = rect.left;
  let top  = rect.bottom + margin;

  // Prevent overflow off right edge
  if (left + ttWidth > window.innerWidth - margin) {
    left = window.innerWidth - ttWidth - margin;
  }
  // Prevent overflow off left edge
  if (left < margin) left = margin;

  // If too close to bottom of viewport, show above instead
  if (rect.bottom + ttHeight + margin > window.innerHeight) {
    top = rect.top - ttHeight - margin;
  }
  // Prevent going above viewport
  if (top < margin) top = margin;

  tooltip.style.left = left + 'px';
  tooltip.style.top  = top  + 'px';
}

// ── Attach tooltip events to a container (or whole document) ──
// Call attachTooltips() on page load, or pass a specific element
// to attach events to dynamically injected content.
function attachTooltips(root) {
  const scope = root || document;

  scope.querySelectorAll('.npc-link').forEach(el => {
    // Avoid double-attaching
    if (el.dataset.tooltipBound) return;
    el.dataset.tooltipBound = '1';
    el.addEventListener('mouseenter', () => showNpcTooltip(el));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('focus',      () => showNpcTooltip(el));
    el.addEventListener('blur',       hideTooltip);
  });

  scope.querySelectorAll('.location-link').forEach(el => {
    if (el.dataset.tooltipBound) return;
    el.dataset.tooltipBound = '1';
    el.addEventListener('mouseenter', () => showLocationTooltip(el));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('focus',      () => showLocationTooltip(el));
    el.addEventListener('blur',       hideTooltip);
  });
}

// Initial page attachment
attachTooltips();

// Keep tooltip open when hovering over it
tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
tooltip.addEventListener('mouseleave', hideTooltip);
