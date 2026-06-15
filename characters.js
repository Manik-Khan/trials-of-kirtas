// ============================================================
// characters.js — Character Data
// The Trials of Kirtas
//
// HOW TO UPDATE A CHARACTER AFTER A SESSION:
// 1. Open Roll20, open the character sheet
// 2. Open browser console, switch to the character's iframe
// 3. Run the scraper script
// 4. Copy the "// ── PASTE INTO characters.js ──" output
// 5. Replace the matching character entry below
// 6. Commit to GitHub — live in seconds
//
// HOW TO ADD A NEW CHARACTER:
// 1. Run the scraper on their sheet
// 2. Paste the output as a new entry in CHARACTERS below
// 3. Add their portrait to img/portraits/keyname.png
// 4. Add a card for them in party.html
//
// ============================================================

const CHARACTERS = {

  // ════════════════════════════════════════════════════════
  // COSMERE RUNESTAR
  // Warlock 2 / Sorcerer 1 — The Hexblade — Astral Elf
  // Last updated: Session 0
  // ════════════════════════════════════════════════════════
  cosmere: {

    name:         'Cosmere Runestar',
    classLabel:   'Warlock 2 / Sorcerer 1',
    subclass:     'Shadow | The Hexblade',
    level:        3,
    race:         'Astral Elf',
    background:   'Captain',
    alignment:    'Chaotic Good',
    xp:           900,
    portrait:     'img/portraits/cosmere.png',

    appearance: {
      age:    '112',
      height: "6'2\"",
      weight: '195 lbs',
      eyes:   'Golden',
      hair:   'Black',
      skin:   'Tan',
    },

    proficiencyBonus:  2,
    inspiration:       true,
    passivePerception: 12,

    abilities: {
      str: { score: 13, mod: 1  },
      dex: { score: 14, mod: 2  },
      con: { score: 14, mod: 2  },
      int: { score: 8,  mod: -1 },
      wis: { score: 11, mod: 0  },
      cha: { score: 17, mod: 3  },
    },

    combat: {
      ac:               18,
      hp:               20,
      hpMax:            20,
      hpTemp:           0,
      speed:            30,
      initiative:       2,
      hitDice:          '2d8+1d6',
      spellSaveDC:      13,
      spellAttackBonus: 5,
    },

    // Warlock saves: WIS and CHA proficiency
    saves: {
      str: { bonus: 1,  proficient: false },
      dex: { bonus: 2,  proficient: false },
      con: { bonus: 2,  proficient: false },
      int: { bonus: -1, proficient: false },
      wis: { bonus: 2,  proficient: true  },
      cha: { bonus: 5,  proficient: true  },
    },

    skills: [
      { name: 'Acrobatics',      attr: 'DEX', bonus: 4,  prof: 'full' },
      { name: 'Animal Handling', attr: 'WIS', bonus: 0,  prof: 'none' },
      { name: 'Arcana',          attr: 'INT', bonus: 1,  prof: 'full' },
      { name: 'Athletics',       attr: 'STR', bonus: 1,  prof: 'none' },
      { name: 'Deception',       attr: 'CHA', bonus: 5,  prof: 'full' },
      { name: 'History',         attr: 'INT', bonus: -1, prof: 'none' },
      { name: 'Insight',         attr: 'WIS', bonus: 0,  prof: 'none' },
      { name: 'Intimidation',    attr: 'CHA', bonus: 3,  prof: 'none' },
      { name: 'Investigation',   attr: 'INT', bonus: -1, prof: 'none' },
      { name: 'Medicine',        attr: 'WIS', bonus: 0,  prof: 'none' },
      { name: 'Nature',          attr: 'INT', bonus: -1, prof: 'none' },
      { name: 'Perception',      attr: 'WIS', bonus: 2,  prof: 'full' },
      { name: 'Performance',     attr: 'CHA', bonus: 3,  prof: 'none' },
      { name: 'Persuasion',      attr: 'CHA', bonus: 5,  prof: 'full' },
      { name: 'Religion',        attr: 'INT', bonus: -1, prof: 'none' },
      { name: 'Sleight of Hand', attr: 'DEX', bonus: 2,  prof: 'none' },
      { name: 'Stealth',         attr: 'DEX', bonus: 4,  prof: 'full' },
      { name: 'Survival',        attr: 'WIS', bonus: 0,  prof: 'none' },
    ],

    // Sorlock spell resources
    // Warlock pact slots recharge on short rest
    // Sorcerer slots recharge on long rest
    classFeatures: {
      pactSlots:         { current: 1, max: 1, level: 1 },  // Warlock 2: 1 slot
      sorcererSlots: {
        1: { current: 2, max: 2 },                          // Sorcerer 1: 2 level 1 slots
      },
      sorceryPoints:     { current: 0, max: 0 },            // unlocks at Sorcerer 2
      eldritchBlastBeams: { 1: 1, 5: 2, 11: 3, 17: 4 },
    },

    rollerFlags: {
      jackOfAllTrades: false,
      halfProfBonus:   1,
      reliableTalent:  false,
    },

    actions: [
      {
        id:       'eldritch_blast',
        label:    'Eldritch Blast',
        type:     'attack-cantrip',
        hitMod:   5,
        dmgDice:  '1d10', critDice: '2d10', dmgMod: 0,
        dmgType:  'Force',
        note:     'Agonizing Blast: +3 damage (CHA mod)',
      },
      {
        id:       'hex',
        label:    'Hex (damage)',
        type:     'damage-only',
        dmgDice:  '1d6', critDice: '2d6', dmgMod: 0,
        dmgType:  'Necrotic',
      },
      {
        id:       'longsword',
        label:    'Longsword',
        type:     'attack',
        hitMod:   5,
        dmgDice:  '1d8', critDice: '2d8', dmgMod: 3,
        dmgType:  'Slashing',
      },
      {
        id:       'longsword_2h',
        label:    'Longsword (Two-Handed)',
        type:     'attack',
        hitMod:   5,
        dmgDice:  '1d10', critDice: '2d10', dmgMod: 3,
        dmgType:  'Slashing',
      },
      {
        id:       'booming_blade',
        label:    'Booming Blade',
        type:     'attack-cantrip',
        hitMod:   5,
        dmgDice:  '1d8', critDice: '2d8', dmgMod: 0,
        dmgType:  'Thunder',
        note:     'Secondary 1d8 thunder if target moves before your next turn',
      },
      {
        id:       'green_flame_blade',
        label:    'Green-Flame Blade',
        type:     'attack-cantrip',
        hitMod:   5,
        dmgDice:  '1d8', critDice: '2d8', dmgMod: 3,
        dmgType:  'Fire',
      },
      {
        id:       'absorb_elements',
        label:    'Absorb Elements',
        type:     'damage-only',
        dmgDice:  '1d6', critDice: '2d6', dmgMod: 0,
        dmgType:  'Element (see text)',
      },
      {
        id:    'shield_spell',
        label: 'Shield',
        type:  'utility',
        note:  '+5 AC until start of next turn. Reaction when hit.',
      },
      {
        id:    'charm_person',
        label: 'Charm Person',
        type:  'utility',
        note:  'WIS save DC 13. 30 ft, 1 hour.',
      },
      {
        id:    'detect_magic',
        label: 'Detect Magic',
        type:  'utility',
        note:  'Ritual / Concentration. 10 minutes.',
      },
      {
        id:    'minor_illusion',
        label: 'Minor Illusion',
        type:  'utility',
        note:  '30 ft, 1 minute.',
      },
      {
        id:    'mage_hand',
        label: 'Mage Hand',
        type:  'utility',
        note:  '30 ft, 1 minute.',
      },
      {
        id:    'mending',
        label: 'Mending',
        type:  'utility',
        note:  'Touch, instantaneous.',
      },
    ],

    defaultSlots: ['eldritch_blast', 'longsword', 'hex', 'shield_spell'],

    spells: {
      cantrip: [
        { name: 'Eldritch Blast',   castingTime: '1 action', range: '120 ft',            duration: 'Instantaneous' },
        { name: 'Booming Blade',    castingTime: '1 action', range: 'Self (5-ft radius)', duration: '1 round' },
        { name: 'Green-Flame Blade',castingTime: '1 action', range: 'Self (5-ft radius)', duration: 'Instantaneous' },
        { name: 'Minor Illusion',   castingTime: '1 action', range: '30 ft',             duration: '1 minute' },
        { name: 'Mage Hand',        castingTime: '1 action', range: '30 ft',             duration: '1 minute' },
        { name: 'Mending',          castingTime: '1 minute', range: 'Touch',             duration: 'Instantaneous' },
      ],
      1: [
        { name: 'Shield',          castingTime: '1 reaction', range: 'Self',  duration: '1 round' },
        { name: 'Hex',             castingTime: '1 bonus action', range: '90 ft', duration: 'Up to 1 hour', concentration: true },
        { name: 'Charm Person',    castingTime: '1 action',   range: '30 ft', duration: '1 hour' },
        { name: 'Detect Magic',    castingTime: '1 action',   range: 'Self',  duration: 'Up to 10 min', concentration: true, ritual: true },
        { name: 'Absorb Elements', castingTime: '1 reaction', range: 'Self',  duration: '1 round' },
      ],
    },

    features: [
      { name: "Hexblade's Curse",                   source: 'The Hexblade',  desc: 'Curse a creature within 30 ft as a bonus action. Gain bonus to damage, crit on 19-20, regain HP on kill.' },
      { name: 'Hex Warrior',                         source: 'The Hexblade',  desc: 'Proficiency with medium armor, shields, and martial weapons. Use CHA for attack/damage with one weapon.' },
      { name: 'Eldritch Invocations',                source: 'Warlock',       desc: 'Gained two invocations at level 2.' },
      { name: 'Eldritch Invocation: Agonizing Blast',source: 'Warlock',       desc: 'Add CHA modifier (+3) to Eldritch Blast damage.' },
      { name: 'Eldritch Invocation: Repelling Blast',source: 'Warlock',       desc: 'Push targets 10 ft away on Eldritch Blast hit.' },
      { name: 'Eyes of the Dark',                    source: 'Shadow Magic',  desc: 'Darkvision 120 ft. Can cast Darkness using a spell slot.' },
      { name: 'Strength of the Grave',               source: 'Shadow Magic',  desc: 'When reduced to 0 HP, make CHA save to drop to 1 HP instead.' },
      { name: 'Fey Ancestry',                        source: 'Astral Elf',    desc: 'Advantage on saves against being charmed. Cannot be magically put to sleep.' },
      { name: 'Starlight Step',                      source: 'Astral Elf',    desc: 'Teleport up to 30 ft as a bonus action. Uses = proficiency bonus per long rest.' },
      { name: 'Astral Trance',                       source: 'Astral Elf',    desc: 'Trance for 4 hours instead of sleep. Gain a weapon or tool proficiency each trance.' },
      { name: "Ship's Passage",                      source: 'Captain',       desc: 'Secure free passage on ships for your party.' },
    ],

    proficiencies: {
      armor:     'Light Armor, Medium Armor, Shields',
      weapons:   'Longsword, Martial Weapons, Simple Weapons',
      tools:     "Navigator's Tools, Water Vehicles",
      languages: 'Common, Elvish',
    },

    inventory: [
      { name: 'Longsword',          weight: 3,  properties: 'Versatile (1d10)' },
      { name: 'Scale Mail',         weight: 45, properties: 'Stealth Disadvantage, AC 14' },
      { name: "Dungeoneer's Pack",  weight: 0,  properties: 'Adventuring Gear' },
      { name: 'Shield',             weight: 6,  properties: '+2 AC' },
    ],
    totalWeight: 54,

    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },

    bio: {
      personality: '',
      ideals:      'Might makes right, do onto others as you would have them do onto you.',
      bonds:       'Lost his crew in an astral storm and wants to find them.',
      flaws:       'Seeks power and is arrogant.',
      backstory:   '',
    },

  }, // end cosmere


  // ════════════════════════════════════════════════════════
  // CAIM
  // Monk — Way of Mercy
  // NOTE: Using 2024 Roll20 sheet — maintained manually
  // Last updated: Session 0
  // ════════════════════════════════════════════════════════
  caim: {

    name:         'Caim',
    classLabel:   'Monk',
    subclass:     'Way of Mercy',
    level:        3,
    race:         'Tiefling (Standard)',
    background:   'Urchin',
    alignment:    'Chaotic Good',
    xp:           0,
    portrait:     'img/portraits/caim.png',

    appearance: {
      age: '20', height: "5'9\"", weight: '135 lbs', eyes: 'Gold', hair: 'Obsidian Black', skin: 'Burgundy',
    },

    proficiencyBonus: 2,
    inspiration:      false,
    passivePerception: 13,

    abilities: {
      str: { score: 14, mod: 2 },
      dex: { score: 16, mod: 3 },
      con: { score: 14, mod: 2 },
      int: { score: 11, mod: 0 },
      wis: { score: 16, mod: 3 },
      cha: { score: 13, mod: 1 },
    },

    combat: {
      ac: 16, hp: 24, hpMax: 24, hpTemp: 0,
      speed: 40, initiative: 3,
      hitDice: '3d8',
      spellSaveDC: 11, spellAttackBonus: 0, // DEX save DC for Hellish Rebuke
    },

    saves: {
      str: { bonus: 4, proficient: true  },
      dex: { bonus: 5, proficient: true  },
      con: { bonus: 2, proficient: false },
      int: { bonus: 0, proficient: false },
      wis: { bonus: 3, proficient: false },
      cha: { bonus: 1, proficient: false },
    },

    skills: [
      { name: 'Acrobatics',      attr: 'DEX', bonus: 5, prof: 'full' },
      { name: 'Animal Handling', attr: 'WIS', bonus: 3, prof: 'none' },
      { name: 'Arcana',          attr: 'INT', bonus: 0, prof: 'none' },
      { name: 'Athletics',       attr: 'STR', bonus: 4, prof: 'full' },
      { name: 'Deception',       attr: 'CHA', bonus: 1, prof: 'none' },
      { name: 'History',         attr: 'INT', bonus: 0, prof: 'none' },
      { name: 'Insight',         attr: 'WIS', bonus: 5, prof: 'full' },
      { name: 'Intimidation',    attr: 'CHA', bonus: 1, prof: 'none' },
      { name: 'Investigation',   attr: 'INT', bonus: 0, prof: 'none' },
      { name: 'Medicine',        attr: 'WIS', bonus: 5, prof: 'full' },
      { name: 'Nature',          attr: 'INT', bonus: 0, prof: 'none' },
      { name: 'Perception',      attr: 'WIS', bonus: 3, prof: 'none' },
      { name: 'Performance',     attr: 'CHA', bonus: 1, prof: 'none' },
      { name: 'Persuasion',      attr: 'CHA', bonus: 1, prof: 'none' },
      { name: 'Religion',        attr: 'INT', bonus: 0, prof: 'none' },
      { name: 'Sleight of Hand', attr: 'DEX', bonus: 5, prof: 'full' },
      { name: 'Stealth',         attr: 'DEX', bonus: 5, prof: 'full' },
      { name: 'Survival',        attr: 'WIS', bonus: 3, prof: 'none' },
    ],

    // Monk-specific mechanics
    classFeatures: {
      kiPoints:       { current: 3, max: 3 },
      martialArtsDie: 'd4',   // d4 at levels 1-4, d6 at 5-10, d8 at 11-16, d10 at 17-20
      unarmedDmgDice: '1d4',
      unarmedHitMod:  4,      // +4 (DEX mod +3, PB +2, Martial Arts uses DEX)
    },

    rollerFlags: {
      jackOfAllTrades: false,
      reliableTalent:  false,
    },

    actions: [
      {
        id: 'unarmed',
        label: 'Unarmed Strike',
        type: 'attack',
        hitMod: 4,
        dmgDice: '1d4', critDice: '2d4', dmgMod: 3,
        dmgType: 'Bludgeoning',
        note: 'Martial Arts — uses DEX',
      },
      {
        id: 'shortsword',
        label: 'Shortsword',
        type: 'attack',
        hitMod: 5,
        dmgDice: '1d6', critDice: '2d6', dmgMod: 3,
        dmgType: 'Piercing',
        note: 'Finesse — uses DEX',
      },
      {
        id: 'hand_of_harm',
        label: 'Hand of Harm',
        type: 'damage-only',
        hitMod: 0,
        dmgDice: '1d4', critDice: '2d4', dmgMod: 3,
        dmgType: 'Necrotic',
        note: 'Costs 1 ki. Use after hitting with unarmed strike.',
      },
      {
        id: 'hand_of_healing',
        label: 'Hand of Healing',
        type: 'damage-only',
        hitMod: 0,
        dmgDice: '1d4', critDice: '2d4', dmgMod: 3,
        dmgType: 'Healing',
        note: 'Costs 1 ki. Touch a creature — restore 1d4+WIS HP.',
      },
    ],

    defaultSlots: ['unarmed', 'hand_of_harm', 'hand_of_healing', 'shortsword'],

    spells: {
      // Tiefling Infernal Legacy — not true spells, listed here for reference
      cantrips: [
        { name: 'Thaumaturgy', source: 'Tiefling', desc: 'Minor magical effects.' },
      ],
      level2: [
        { name: 'Hellish Rebuke', source: 'Tiefling (1/long rest)', prepared: true,
          desc: 'Reaction when damaged. DEX save DC 11 or take 2d10 fire damage (half on save). Range 60 ft.' },
      ],
    },

    features: [
      { name: 'Unarmored Defense',    source: 'Monk',         desc: 'AC = 10 + DEX mod (+3) + WIS mod (+3) = 16 base. Currently 19 — verify if magic item contributing.' },
      { name: 'Martial Arts',         source: 'Monk',         desc: 'Use DEX for unarmed strikes and monk weapons. Bonus unarmed strike after Attack action.' },
      { name: 'Ki',                   source: 'Monk',         desc: '3 ki points per long rest. Powers: Flurry of Blows, Patient Defense, Step of the Wind.' },
      { name: 'Unarmored Movement',   source: 'Monk',         desc: 'Speed +10 ft while unarmored and unshielded.' },
      { name: 'Deflect Missiles',     source: 'Monk',         desc: 'Reaction: reduce ranged weapon attack damage by 1d10 + DEX + level. Can catch and throw if reduced to 0.' },
      { name: 'Flurry of Blows',      source: 'Monk',         desc: 'Bonus action. Spend 1 ki to make two unarmed strikes immediately after the Attack action.' },
      { name: 'Patient Defense',      source: 'Monk',         desc: 'Bonus action. Spend 1 ki to Dodge.' },
      { name: 'Step of the Wind',     source: 'Monk',         desc: 'Bonus action. Spend 1 ki to Disengage or Dash. Jump distance doubled.' },
      { name: 'Implements of Mercy',  source: 'Way of Mercy', desc: 'Proficient in Insight and Medicine. Proficient with Herbalism Kit.' },
      { name: 'Hand of Healing',      source: 'Way of Mercy', desc: 'Action. Spend 1 ki to touch a creature and restore 1d4 + WIS mod HP.' },
      { name: 'Hand of Harm',         source: 'Way of Mercy', desc: 'Once per turn when hitting with unarmed strike, spend 1 ki to deal extra 1d4 + WIS mod necrotic damage.' },
      { name: 'Merciful Mask',        source: 'Way of Mercy', desc: 'Mask: Laughing Visage. Worn when using Hand of Healing or Hand of Harm.' },
      { name: 'Hellish Resistance',   source: 'Tiefling',     desc: 'Resistance to fire damage.' },
      { name: 'Infernal Legacy',      source: 'Tiefling',     desc: 'Cantrip: Thaumaturgy. Level 3: Hellish Rebuke 1/long rest (DEX save DC 11, 2d10 fire).' },
      { name: 'Darkvision',           source: 'Tiefling',     desc: '60 ft darkvision.' },
      { name: 'City Secrets',         source: 'Urchin',       desc: 'Know secret patterns of cities. Travel between locations in a city at twice normal speed.' },
    ],

    proficiencies: {
      armor:     'None',
      weapons:   'Simple Weapons, Shortswords',
      tools:     'Disguise Kit, Thieves\' Tools, Cook\'s Utensils, Herbalism Kit',
      languages: 'Common, Infernal',
    },

    inventory: [
      { name: 'Shortsword',    qty: 1, weight: 2,  equipped: true  },
      { name: 'Dart',          qty: 10, weight: 10, equipped: false },
      { name: 'Common Clothes', qty: 1, weight: 3,  equipped: true  },
      { name: 'Explorer\'s Pack', qty: 1, weight: 0, equipped: false },
      { name: 'Pet Mouse',     qty: 1, weight: 0,  equipped: false },
      { name: 'Small Knife',   qty: 1, weight: 0,  equipped: false },
      { name: 'Token to remember your parents by', qty: 1, weight: 0, equipped: false },
    ],
    totalWeight: 75.2,
    currency: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },

    bio: {
      personality: 'I bluntly say what other people are hinting at or hiding. I sleep with my back to a wall or tree, with everything I own wrapped in a bundle in my arms.',
      ideals:      'People. I help the people who help me — that\'s what keeps us alive. (Neutral)',
      bonds:       'I owe my survival to another urchin who taught me to live on the streets.',
      flaws:       'It\'s not stealing if I need it more than someone else.',
      backstory:   'A tiefling raised on the streets of Tiersgard. Orphaned and poor, shaped by desperation and survival. Quiet, watchful, and dangerous up close.',
    },

    // Flag this as manually maintained
    _manual: true,
    _note: 'Using 2024 Roll20 sheet — update manually until scraper supports it',

  }, // end caim


  // ════════════════════════════════════════════════════════
  // LÍADAN LUCHÓG
  // Bard — College of Creation
  // Last updated: Session 0
  // ════════════════════════════════════════════════════════
  liadan: {

    name:         'Líadan Luchóg',
    classLabel:   'Bard',
    subclass:     'College of Creation',
    level:        4,
    race:         'Mouseling',
    background:   'Entertainer (Singer)',
    alignment:    'Chaotic Good',
    xp:           900,
    portrait:     'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779732202/kirtas/portraits/liadan.png',

    appearance: {
      age:    '17',
      height: "3'",
      weight: '30 lbs',
      eyes:   'Brown/Black',
      hair:   'Grey',
      skin:   'Grey',
    },

    proficiencyBonus:  2,
    inspiration:       true,
    passivePerception: 14,

    abilities: {
      str: { score: 6,  mod: -2 },
      dex: { score: 12, mod: 1  },
      con: { score: 13, mod: 1  },
      int: { score: 12, mod: 1  },
      wis: { score: 14, mod: 2  },
      cha: { score: 15, mod: 2  },
    },

    combat: {
      ac:               12,
      hp:               19,
      hpMax:            19,
      hpTemp:           0,
      speed:            20,
      initiative:       2,
      hitDice:          '4d8',
      spellSaveDC:      12,
      spellAttackBonus: 4,
    },

    // Bard saves: DEX and CHA proficiency
    saves: {
      str: { bonus: -2, proficient: false },
      dex: { bonus: 3,  proficient: true  },
      con: { bonus: 1,  proficient: false },
      int: { bonus: 1,  proficient: false },
      wis: { bonus: 2,  proficient: false },
      cha: { bonus: 4,  proficient: true  },
    },

    // prof key:
    //   'expertise' = double prof (Performance +6, Medicine +6)
    //   'full'      = proficient (Acrobatics +3, Perception +4)
    //   'half'      = Jack of All Trades (+1 to everything else)
    //   'none'      = just stat mod (not used for Bard — everything gets at least half)
    skills: [
      { name: 'Acrobatics',      attr: 'DEX', bonus: 3,  prof: 'full'      },
      { name: 'Animal Handling', attr: 'WIS', bonus: 3,  prof: 'half'      },
      { name: 'Arcana',          attr: 'INT', bonus: 2,  prof: 'half'      },
      { name: 'Athletics',       attr: 'STR', bonus: -1, prof: 'half'      },
      { name: 'Deception',       attr: 'CHA', bonus: 3,  prof: 'half'      },
      { name: 'History',         attr: 'INT', bonus: 2,  prof: 'half'      },
      { name: 'Insight',         attr: 'WIS', bonus: 3,  prof: 'half'      },
      { name: 'Intimidation',    attr: 'CHA', bonus: 3,  prof: 'half'      },
      { name: 'Investigation',   attr: 'INT', bonus: 2,  prof: 'half'      },
      { name: 'Medicine',        attr: 'WIS', bonus: 6,  prof: 'expertise' },
      { name: 'Nature',          attr: 'INT', bonus: 2,  prof: 'half'      },
      { name: 'Perception',      attr: 'WIS', bonus: 4,  prof: 'full'      },
      { name: 'Performance',     attr: 'CHA', bonus: 6,  prof: 'expertise' },
      { name: 'Persuasion',      attr: 'CHA', bonus: 3,  prof: 'half'      },
      { name: 'Religion',        attr: 'INT', bonus: 2,  prof: 'half'      },
      { name: 'Sleight of Hand', attr: 'DEX', bonus: 2,  prof: 'half'      },
      { name: 'Stealth',         attr: 'DEX', bonus: 2,  prof: 'half'      },
      { name: 'Survival',        attr: 'WIS', bonus: 3,  prof: 'half'      },
    ],

    // Bard-specific mechanics
    classFeatures: {
      // Bardic Inspiration die: d6(1-4), d8(5-9), d10(10-14), d12(15+)
      bardicInspirationDie: 'd6',
      // Max = CHA mod (2), refills on long rest
      bardicInspiration: { current: 2, max: 2 },
      spellSlots: {
        1: { current: 4, max: 4 },
        2: { current: 2, max: 2 },
      },
      moteOfPotential:      true,
      performanceOfCreation: true,
    },

    rollerFlags: {
      jackOfAllTrades: true,
      halfProfBonus:   1,   // floor(2 / 2) — update when prof bonus changes
      reliableTalent:  false,
    },

    actions: [
      {
        id:      'vicious_mockery',
        label:   'Vicious Mockery',
        type:    'utility',
        note:    'WIS save DC 12 — on fail: 1d4 psychic dmg + disadv on next attack',
      },
      {
        id:       'cure_wounds',
        label:    'Cure Wounds',
        type:     'damage-only',
        dmgDice:  '1d8',
        critDice: '2d8',
        dmgMod:   2,
        dmgType:  'Healing',
      },
      {
        id:       'healing_word',
        label:    'Healing Word',
        type:     'damage-only',
        dmgDice:  '1d4',
        critDice: '2d4',
        dmgMod:   2,
        dmgType:  'Healing',
      },
      {
        id:       'sling',
        label:    'Sling',
        type:     'attack',
        hitMod:   3,
        dmgDice:  '1d4',
        critDice: '2d4',
        dmgMod:   1,
        dmgType:  'Bludgeoning',
      },
      {
        id:       'dagger',
        label:    'Dagger',
        type:     'attack',
        hitMod:   3,
        dmgDice:  '1d4',
        critDice: '2d4',
        dmgMod:   1,
        dmgType:  'Piercing',
      },
    ],

    defaultSlots: ['cure_wounds', 'healing_word', 'sling', 'vicious_mockery'],

    spells: {
      cantrip: [
        { name: 'Prestidigitation', castingTime: '1 action',      range: '10 ft',  duration: 'Up to 1 hour' },
        { name: 'Vicious Mockery',  castingTime: '1 action',      range: '60 ft',  duration: 'Instantaneous' },
        { name: 'Mage Hand',        castingTime: '1 action',      range: '30 ft',  duration: '1 minute' },
        { name: 'Guidance',         castingTime: '1 action',      range: 'Touch',  duration: 'Up to 1 minute', concentration: true },
        { name: 'Spare the Dying',  castingTime: '1 action',      range: 'Touch',  duration: 'Instantaneous' },
      ],
      1: [
        { name: 'Cure Wounds',  castingTime: '1 action',      range: 'Touch',   duration: 'Instantaneous' },
        { name: 'Healing Word', castingTime: '1 bonus action', range: '60 ft',   duration: 'Instantaneous' },
        { name: 'Detect Magic', castingTime: '1 action',      range: 'Self',    duration: 'Up to 10 min', concentration: true, ritual: true },
        { name: 'Charm Person', castingTime: '1 action',      range: '30 ft',   duration: '1 hour' },
        { name: 'Feather Fall', castingTime: '1 reaction',    range: '60 ft',   duration: '1 minute' },
        { name: 'Sanctuary',    castingTime: '1 bonus action', range: '30 ft',   duration: '1 minute' },
        { name: 'Bless',        castingTime: '1 action',      range: '30 ft',   duration: 'Up to 1 minute', concentration: true },
      ],
      2: [
        { name: 'Aid', castingTime: '1 action', range: '30 ft', duration: '8 hours' },
      ],
    },

    features: [
      { name: 'Bardic Inspiration',      source: 'Bard',              desc: 'Grant a d6 inspiration die to a creature within 60 ft as a bonus action. CHA mod (2) uses per long rest.' },
      { name: 'Jack of All Trades',      source: 'Bard',              desc: 'Add half proficiency bonus (+1) to any ability check not already using proficiency.' },
      { name: 'Song of Rest',            source: 'Bard',              desc: 'During a short rest, allies regain extra 1d6 HP when spending hit dice.' },
      { name: 'Expertise',               source: 'Bard',              desc: 'Double proficiency bonus on Performance and Medicine.' },
      { name: 'Magical Inspiration',     source: 'Bard',              desc: 'When a creature uses Bardic Inspiration for a spell, they can add the die to damage or healing.' },
      { name: 'Mote of Potential',       source: 'College of Creation', desc: 'Bardic Inspiration die grants a bonus effect based on how it is used.' },
      { name: 'Performance of Creation', source: 'College of Creation', desc: 'Create a medium or smaller nonmagical item worth up to 20 × bard level GP. 1/long rest.' },
      { name: 'Disciple of Life',        source: 'Life Domain',        desc: 'Healing spells restore additional HP equal to 2 + spell level.' },
      { name: 'Ritual Casting',          source: 'Bard',              desc: 'Cast bard spells with the ritual tag without expending a spell slot.' },
      { name: 'Observant Prey',          source: 'Mouseling',         desc: 'Racial feature — details TBD.' },
      { name: 'By Popular Demand',       source: 'Entertainer',       desc: 'Always find a place to perform, earn modest living, and have local recognition.' },
    ],

    proficiencies: {
      armor:     'Light Armor',
      weapons:   'Simple Weapons, Hand Crossbow, Longsword, Rapier, Shortsword',
      tools:     'Bagpipes, Disguise Kit, Flute, Lute, Viol',
      languages: '',
    },

    inventory: [
      { name: 'Dagger',            weight: 1,  properties: 'Finesse, Light, Thrown' },
      { name: 'Sling',             weight: 0,  properties: 'Ammunition, Range 30/120' },
      { name: 'Leather Armor',     weight: 10, properties: 'AC 11 + DEX' },
      { name: 'Flute',             weight: 1,  properties: 'Musical Instrument' },
      { name: 'Viol',              weight: 1,  properties: 'Musical Instrument' },
      { name: "Entertainer's Pack",weight: 0,  properties: 'Adventuring Gear' },
      { name: 'Disguise Kit',      weight: 3,  properties: '' },
      { name: 'Backpack',          weight: 5,  properties: '' },
      { name: 'Bedroll',           weight: 7,  properties: '' },
      { name: 'Candle',            weight: 0,  properties: '' },
      { name: 'Rations',           weight: 2,  properties: '' },
      { name: 'Waterskin',         weight: 5,  properties: '' },
      { name: 'Belt Pouch',        weight: 0,  properties: '' },
      { name: 'Trinket',           weight: 0,  properties: '' },
    ],
    totalWeight: 43,

    currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },

    bio: {
      personality: '',
      ideals:      'Greed. I\'m only in it for the money and fame.',
      bonds:       'I want to be famous, whatever it takes.',
      flaws:       'I\'ll do anything to win fame and renown.',
      backstory:   '',
    },

  }, // end liadan


  // ════════════════════════════════════════════════════════
  // VESPERIAN VALE
  // Fighter — Eldritch Knight
  // Last updated: Session 0
  // NOTE: Longsword hit mod flagged — verify DEX vs STR vs INT
  // ════════════════════════════════════════════════════════
  vesperian: {

    name:         'Vesperian Vale',
    classLabel:   'Fighter',
    subclass:     'Eldritch Knight',
    level:        3,
    race:         'Shadar-kai',
    background:   'Dimir Operative',
    alignment:    'Neutral',
    xp:           900,
    portrait:     'img/portraits/vesperian.jpg',

    appearance: {
      age:    '94',
      height: "6'1\"",
      weight: '180 lbs',
      eyes:   'Violet',
      hair:   'Midnight',
      skin:   'Ashen',
    },

    proficiencyBonus:  2,
    inspiration:       true,
    passivePerception: 13,

    abilities: {
      str: { score: 8,  mod: -1 },
      dex: { score: 18, mod: 4  },
      con: { score: 16, mod: 3  },
      int: { score: 14, mod: 2  },
      wis: { score: 12, mod: 1  },
      cha: { score: 10, mod: 0  },
    },

    combat: {
      ac:               18,
      hp:               31,
      hpMax:            31,
      hpTemp:           0,
      speed:            30,
      initiative:       4,
      hitDice:          '3d10',
      spellSaveDC:      12,
      spellAttackBonus: 4,
    },

    // Fighter saves: STR and CON proficiency
    saves: {
      str: { bonus: 1,  proficient: true  },
      dex: { bonus: 4,  proficient: false },
      con: { bonus: 5,  proficient: true  },
      int: { bonus: 2,  proficient: false },
      wis: { bonus: 1,  proficient: false },
      cha: { bonus: 0,  proficient: false },
    },

    // Proficient: Acrobatics, Arcana, History, Perception, Stealth
    // NOTE: Acrobatics +6 = DEX(+4) + prof(+2) ✓
    //       Stealth    +6 = DEX(+4) + prof(+2) ✓
    //       Arcana     +4 = INT(+2) + prof(+2) ✓
    //       History    +4 = INT(+2) + prof(+2) ✓
    //       Perception +3 = WIS(+1) + prof(+2) ✓
    skills: [
      { name: 'Acrobatics',      attr: 'DEX', bonus: 6,  prof: 'full' },
      { name: 'Animal Handling', attr: 'WIS', bonus: 1,  prof: 'none' },
      { name: 'Arcana',          attr: 'INT', bonus: 4,  prof: 'full' },
      { name: 'Athletics',       attr: 'STR', bonus: -1, prof: 'none' },
      { name: 'Deception',       attr: 'CHA', bonus: 0,  prof: 'none' },
      { name: 'History',         attr: 'INT', bonus: 4,  prof: 'full' },
      { name: 'Insight',         attr: 'WIS', bonus: 1,  prof: 'none' },
      { name: 'Intimidation',    attr: 'CHA', bonus: 0,  prof: 'none' },
      { name: 'Investigation',   attr: 'INT', bonus: 2,  prof: 'none' },
      { name: 'Medicine',        attr: 'WIS', bonus: 1,  prof: 'none' },
      { name: 'Nature',          attr: 'INT', bonus: 2,  prof: 'none' },
      { name: 'Perception',      attr: 'WIS', bonus: 3,  prof: 'full' },
      { name: 'Performance',     attr: 'CHA', bonus: 0,  prof: 'none' },
      { name: 'Persuasion',      attr: 'CHA', bonus: 0,  prof: 'none' },
      { name: 'Religion',        attr: 'INT', bonus: 2,  prof: 'none' },
      { name: 'Sleight of Hand', attr: 'DEX', bonus: 4,  prof: 'none' },
      { name: 'Stealth',         attr: 'DEX', bonus: 6,  prof: 'full' },
      { name: 'Survival',        attr: 'WIS', bonus: 1,  prof: 'none' },
    ],

    // Fighter-specific mechanics
    classFeatures: {
      actionSurge:  { current: 1, max: 1 },   // recharges on short or long rest
      secondWind:   { current: 1, max: 1 },   // recharges on short or long rest
      spellSlots: {
        1: { current: 2, max: 2 },            // Eldritch Knight gets 2 at Fighter 3
      },
      weaponBond:   ['Longsword'],             // bonded weapons
      fightingStyle: 'Dueling',               // +2 damage one-handed weapon
    },

    rollerFlags: {
      jackOfAllTrades: false,
      halfProfBonus:   1,
      reliableTalent:  false,
    },

    // NOTE: Longsword hit mod set to +6 (DEX +4 + prof +2)
    // If Vesperian uses a different stat, update hitMod accordingly
    // Dueling style: +2 damage when wielding one-handed — applied to 1H longsword
    actions: [
      {
        id:       'bb_vesperian',
        label:    'Booming Blade',
        type:     'attack-cantrip',
        hitMod:   6,          // DEX +4 + prof +2
        dmgDice:  '1d8',
        critDice: '2d8',
        dmgMod:   0,          // weapon damage only at this level; secondary thunder on movement
        dmgType:  'Slashing + Thunder (on move)',
        note:     'Secondary 1d8 thunder if target moves before your next turn',
      },
      {
        id:       'ls_1h',
        label:    'Longsword (One-Handed)',
        type:     'attack',
        hitMod:   6,          // DEX +4 + prof +2 — verify with player
        dmgDice:  '1d8',
        critDice: '2d8',
        dmgMod:   2,          // Dueling fighting style +2
        dmgType:  'Slashing',
      },
      {
        id:       'ls_2h',
        label:    'Longsword (Two-Handed)',
        type:     'attack',
        hitMod:   6,
        dmgDice:  '1d10',
        critDice: '2d10',
        dmgMod:   0,          // no Dueling bonus when two-handing
        dmgType:  'Slashing',
      },
      {
        id:    'shield_spell',
        label: 'Shield',
        type:  'utility',
        note:  '+5 AC until start of next turn. Reaction when hit.',
      },
      {
        id:    'second_wind',
        label: 'Second Wind',
        type:  'damage-only',
        dmgDice: '1d10',
        critDice: '2d10',
        dmgMod:  3,           // + Fighter level
        dmgType: 'Healing',
        note:    'Bonus action. Recharges on short/long rest.',
      },
    ],

    defaultSlots: ['bb_vesperian', 'ls_1h', 'shield_spell', 'second_wind'],

    spells: {
      cantrip: [
        { name: 'Minor Illusion', castingTime: '1 action', range: '30 ft',             duration: '1 minute' },
        { name: 'Booming Blade',  castingTime: '1 action', range: 'Self (5-ft radius)', duration: '1 round' },
      ],
      1: [
        { name: 'Shield',        castingTime: '1 reaction', range: 'Self',    duration: '1 round' },
        { name: 'Find Familiar', castingTime: '1 hour',     range: '10 ft',   duration: 'Instantaneous', ritual: true },
      ],
    },

    features: [
      { name: 'Second Wind',               source: 'Fighter',         desc: 'Bonus action: regain 1d10 + 3 HP. Recharges on short or long rest.' },
      { name: 'Action Surge',              source: 'Fighter',         desc: 'Take one additional action on your turn. Recharges on short or long rest.' },
      { name: 'Dueling',                   source: 'Fighter',         desc: '+2 damage when wielding a melee weapon in one hand and no other weapons.' },
      { name: 'Weapon Bond',               source: 'Eldritch Knight', desc: 'Bonded to Longsword. Cannot be disarmed. Summon as a bonus action.' },
      { name: 'Spellcasting',              source: 'Eldritch Knight', desc: 'INT-based spellcasting. 2 level 1 slots. Spell save DC 12, attack +4.' },
      { name: 'Blessing of the Raven Queen', source: 'Shadar-kai',   desc: 'Teleport up to 30 ft as a bonus action. Resistance to all damage until start of next turn. 1/long rest.' },
      { name: 'Trance',                    source: 'Shadar-kai',      desc: 'Meditate for 4 hours instead of sleeping. Proficiency in a weapon or tool after each trance.' },
      { name: 'Guild Spells',              source: 'Dimir Operative', desc: 'Background feature — additional spells from the Dimir guild list.' },
    ],

    proficiencies: {
      armor:     'All Armor, Shields',
      weapons:   'Simple Weapons, Martial Weapons',
      tools:     'Disguise Kit',
      languages: 'Common, Elvish, Undercommon',
    },

    inventory: [
      { name: 'Scale Mail',       weight: 45, properties: 'Stealth Disadvantage, AC 14' },
      { name: 'Shield',           weight: 6,  properties: '+2 AC' },
      { name: 'Longsword',        weight: 3,  properties: 'Versatile (1d10), Bonded' },
      { name: "Explorer's Pack",  weight: 0,  properties: 'Adventuring Gear' },
    ],
    totalWeight: 56,

    currency: { cp: 0, sp: 0, ep: 0, gp: 120, pp: 0 },

    bio: {
      personality: '',
      ideals:      '',
      bonds:       '',
      flaws:       '',
      backstory:   '',
    },

  }, // end vesperian

}; // end CHARACTERS
