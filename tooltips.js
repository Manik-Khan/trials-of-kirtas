// ============================================================
// tooltips.js — Shared NPC Tooltip System
// The Trials of Kirtas
// ============================================================
//
// HOW TO ADD A NEW NPC TO THE TOOLTIP SYSTEM:
//
// 1. Add an entry to the NPC_DATA object below, following
//    the same format as the existing entries.
//    The key (e.g. 'darius') must be lowercase, no spaces.
//
// 2. On any page where you want to link that NPC's name,
//    wrap it in a span like this:
//
//    <span class="npc-link" data-npc="darius">Darius</span>
//
//    That's it. The tooltip will appear automatically on hover.
//
// 3. Make sure the page includes both script tags at the bottom:
//    <link rel="stylesheet" href="tooltips.css">
//    <script src="tooltips.js"></script>
//
// ============================================================

const NPC_DATA = {

  tyrus: {
    name: 'Tyrus Ranec',
    role: 'King of Kirtas — The Wolven',
    status: 'alive',
    desc: 'The king\'s younger brother who assumed the throne after Aluin III\'s death. Crueler and more paranoid than he once was, but still dreams of reunifying the kingdom under his banner.'
  },

  darius: {
    name: 'General Darius',
    role: 'Leader — Alliance to Restore Kirtas',
    status: 'alive',
    desc: 'The former king\'s most senior general. Encamped in the Long Hills with Lord Reykoldt, fighting on in the name of a prince few believe still lives.'
  },

  reykoldt: {
    name: 'Lord Reykoldt',
    role: 'Duke of Yevennia — Blue Jackets',
    status: 'alive',
    desc: 'The former king\'s closest advisor and one of the last surviving members of the King\'s Council. Holds Darius\'s forces together through iron will and political acumen.'
  },

  prince: {
    name: 'The Young Prince',
    role: 'Heir to the Kirtas Throne',
    status: 'unknown',
    desc: 'Born two months after Tyrus\'s ascension to a royal concubine. The rightful heir — or so Darius claims. He has not been seen in years. Many suspect he is dead.'
  },

  aluin: {
    name: 'Aluin Ranec III',
    role: 'Former King of Kirtas — Deceased',
    status: 'dead',
    desc: 'Ruled vigorously for decades before dying of pox. Unable to produce a male heir, he named his brother Tyrus as successor — a decision that tore the kingdom apart.'
  },

  eneos: {
    name: 'King Eneos II',
    role: 'King of Numior',
    status: 'alive',
    desc: 'The young king of Numior and a strong supporter of the Red Eagles. Increasingly drawn to hawkish advisors urging expansion into Kirtas while the kingdom is distracted.'
  },

  rhadig: {
    name: 'Rhadig of Koria',
    role: 'Commander — Band of the Rook',
    status: 'hostile',
    desc: 'A brutal and unscrupulous man who took command of the once-honorable Band of the Rook after Ryol\'s Creek. Under him, the regiment has become little more than bandits.'
  },

  solci: {
    name: 'Lucius Solci',
    role: 'Commander — The Stags',
    status: 'unknown',
    desc: 'A former Dalarian general turned mercenary. A skillful tactician who keeps his regiment fresh and disciplined, currently hired by King Eneos of Numior.'
  }

  // ── ADD NEW NPCS BELOW THIS LINE ──
  // Format:
  // keyname: {
  //   name: 'Full Name',
  //   role: 'Title or Role',
  //   status: 'alive' | 'dead' | 'unknown' | 'hostile',
  //   desc: 'A sentence or two about this person.'
  // },

};

// ============================================================
// TOOLTIP ENGINE — no need to edit below this line
// ============================================================

const statusLabels = {
  alive:   'Alive',
  dead:    'Deceased',
  unknown: 'Whereabouts Unknown',
  hostile: 'Hostile'
};

// Create the tooltip element
const tooltip = document.createElement('div');
tooltip.id = 'npc-tooltip';
tooltip.setAttribute('aria-hidden', 'true');
document.body.appendChild(tooltip);

let hideTimeout = null;

function showTooltip(el) {
  const key = el.dataset.npc;
  const npc = NPC_DATA[key];
  if (!npc) return;

  clearTimeout(hideTimeout);

  const statusLabel = statusLabels[npc.status] || npc.status;

  tooltip.innerHTML = `
    <div class="tt-name">${npc.name}</div>
    <div class="tt-role">${npc.role}</div>
    <div class="tt-status tt-status--${npc.status}">${statusLabel}</div>
    <div class="tt-desc">${npc.desc}</div>
  `;

  tooltip.classList.add('visible');
  positionTooltip(el);
}

function hideTooltip() {
  hideTimeout = setTimeout(() => {
    tooltip.classList.remove('visible');
  }, 120);
}

function positionTooltip(el) {
  const rect = el.getBoundingClientRect();
  const ttWidth = 280;
  const margin = 12;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + margin;

  // Prevent overflow off right edge
  if (left + ttWidth > window.innerWidth - margin) {
    left = window.innerWidth - ttWidth - margin;
  }

  // Prevent overflow off left edge
  if (left < margin) left = margin;

  // If too close to bottom, show above instead
  if (rect.bottom + 200 > window.innerHeight) {
    top = rect.top + window.scrollY - 200 - margin;
  }

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

// Attach events to all .npc-link elements
document.querySelectorAll('.npc-link').forEach(el => {
  el.addEventListener('mouseenter', () => showTooltip(el));
  el.addEventListener('mouseleave', hideTooltip);
  el.addEventListener('focus', () => showTooltip(el));
  el.addEventListener('blur', hideTooltip);
});

// Also keep tooltip visible when hovering over it
tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
tooltip.addEventListener('mouseleave', hideTooltip);
