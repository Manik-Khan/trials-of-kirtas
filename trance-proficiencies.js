/* trance-proficiencies.js — temporary proficiency choices granted by elven Trance.
 *
 * Structural stores the entitlement; vitals stores the current long-rest picks.
 * apply() projects those picks onto a cloned structural for rolls and display, so
 * temporary knowledge never becomes a permanent Forge proficiency.
 *
 * Classic-script + CommonJS dual export. Sheet ESM imports it for the browser
 * global; Soul Shards and the smoke harness use the same functions directly.
 */
(function () {
  'use strict';

  var SKILLS = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
  var WEAPONS = [
    { name:'Club', category:'simple' }, { name:'Dagger', category:'simple' }, { name:'Greatclub', category:'simple' },
    { name:'Handaxe', category:'simple' }, { name:'Javelin', category:'simple' }, { name:'Light Hammer', category:'simple' },
    { name:'Mace', category:'simple' }, { name:'Quarterstaff', category:'simple' }, { name:'Sickle', category:'simple' },
    { name:'Spear', category:'simple' }, { name:'Light Crossbow', category:'simple' }, { name:'Dart', category:'simple' },
    { name:'Shortbow', category:'simple' }, { name:'Sling', category:'simple' },
    { name:'Battleaxe', category:'martial' }, { name:'Flail', category:'martial' }, { name:'Glaive', category:'martial' },
    { name:'Greataxe', category:'martial' }, { name:'Greatsword', category:'martial' }, { name:'Halberd', category:'martial' },
    { name:'Lance', category:'martial' }, { name:'Longsword', category:'martial' }, { name:'Maul', category:'martial' },
    { name:'Morningstar', category:'martial' }, { name:'Pike', category:'martial' }, { name:'Rapier', category:'martial' },
    { name:'Scimitar', category:'martial' }, { name:'Shortsword', category:'martial' }, { name:'Trident', category:'martial' },
    { name:'War Pick', category:'martial' }, { name:'Warhammer', category:'martial' }, { name:'Whip', category:'martial' },
    { name:'Blowgun', category:'martial' }, { name:'Hand Crossbow', category:'martial' }, { name:'Heavy Crossbow', category:'martial' },
    { name:'Longbow', category:'martial' }, { name:'Net', category:'martial' }
  ];
  var TOOLS = [
    "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools", "Cartographer's Tools",
    "Cobbler's Tools", "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools",
    "Mason's Tools", "Painter's Supplies", "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools",
    "Woodcarver's Tools", 'Disguise Kit', 'Forgery Kit', 'Herbalism Kit', "Navigator's Tools", "Poisoner's Kit",
    "Thieves' Tools", 'Vehicles (Land)', 'Vehicles (Water)', 'Dice Set', 'Dragonchess Set', 'Playing Card Set',
    'Three-Dragon Ante Set', 'Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn', 'Pan Flute', 'Shawm', 'Viol'
  ];

  function clone(v) { return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function key(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+weapons?$/, '').replace(/[^a-z0-9]+/g, ''); }
  function has(list, value) { var k = key(value); return (list || []).some(function (x) { return key(x) === k; }); }
  function add(list, value) { if (value && !has(list, value)) list.push(value); }
  function sourceOf(race) { return String((race && (race.source || race.s)) || '').toUpperCase(); }
  function nameOf(race) { return String((race && (race.name || race.n)) || ''); }

  function modernElfSpec(name, source) {
    var n = String(name || '').toLowerCase(), src = String(source || '').toUpperCase();
    if (n === 'astral elf' && (!src || src === 'AAG')) return {
      version: 1, id: 'astral-trance', source: 'Astral Trance',
      choices: [
        { id:'skill', label:'Skill', kinds:['skill'] },
        { id:'memory', label:'Weapon or tool', kinds:['weapon','tool'] }
      ]
    };
    if ((n === 'shadar-kai' || n === 'shadar kai' || n === 'eladrin' || n === 'sea elf') && (!src || src === 'MPMM')) return {
      version: 1, id: 'elven-trance', source: 'Trance',
      choices: [
        { id:'memory-1', label:'Weapon or tool', kinds:['weapon','tool'] },
        { id:'memory-2', label:'Weapon or tool', kinds:['weapon','tool'] }
      ]
    };
    return null;
  }

  function specFromRace(race, subraceName) {
    var sub = null;
    if (race && subraceName) sub = (race.subraces || []).filter(function (s) { return s && (s.name === subraceName || s.label === subraceName); })[0] || null;
    return modernElfSpec(sub ? (sub.name || nameOf(race)) : nameOf(race), sub ? sourceOf(sub) : sourceOf(race))
      || modernElfSpec(nameOf(race), sourceOf(race));
  }

  function specFromStructural(structural) {
    structural = structural || {};
    if (structural.restProficiencies && Array.isArray(structural.restProficiencies.choices)) return clone(structural.restProficiencies);
    var buildSpecies = structural._build && structural._build.species;
    return modernElfSpec(structural.race || (buildSpecies && (buildSpecies.n || buildSpecies.name)), buildSpecies && (buildSpecies.s || buildSpecies.source));
  }

  function permanent(structural) {
    var p = (structural && structural.proficiencies) || {};
    return {
      skills: Array.isArray(p.skills) ? p.skills : [],
      weapons: Array.isArray(p.weapons) ? p.weapons : (p.weapons ? String(p.weapons).split(',') : []),
      tools: Array.isArray(p.tools) ? p.tools : (p.tools ? String(p.tools).split(',') : [])
    };
  }

  function optionsForKind(spec, choiceIndex, kind, structural, selections) {
    var choice = spec && spec.choices && spec.choices[choiceIndex];
    if (!choice || choice.kinds.indexOf(kind) === -1) return [];
    var p = permanent(structural), used = (selections || []).filter(function (s) { return s && s.id !== choice.id; });
    function available(name) {
      if (has(used.map(function (s) { return s.name; }), name)) return false;
      var list = kind === 'skill' ? p.skills : (kind === 'weapon' ? p.weapons : p.tools);
      return !has(list, name);
    }
    if (kind === 'skill') return SKILLS.filter(available);
    if (kind === 'tool') return TOOLS.filter(available);
    var allSimple = p.weapons.some(function (x) { return /^(?:all\s+)?simple(?:\s+weapons?)?$/i.test(String(x).trim()); });
    var allMartial = p.weapons.some(function (x) { return /^(?:all\s+)?martial(?:\s+weapons?)?$/i.test(String(x).trim()); });
    return WEAPONS.filter(function (w) { return !(w.category === 'simple' && allSimple) && !(w.category === 'martial' && allMartial) && available(w.name); }).map(function (w) { return w.name; });
  }

  function normalizeSelections(spec, selections, structural) {
    var out = [];
    (spec && spec.choices || []).forEach(function (choice, i) {
      var raw = (selections || []).filter(function (s) { return s && (s.id === choice.id || (!s.id && out.length === i)); })[0];
      if (!raw || choice.kinds.indexOf(raw.kind) === -1) return;
      var opts = optionsForKind(spec, i, raw.kind, structural, out);
      var canonical = opts.filter(function (x) { return key(x) === key(raw.name); })[0];
      if (canonical) out.push({ id:choice.id, kind:raw.kind, name:canonical });
    });
    return out;
  }

  function currentSelections(vitals, spec, structural) {
    var t = vitals && vitals.temporaryProficiencies;
    if (!t || !spec || t.specId !== spec.id) return [];
    return normalizeSelections(spec, t.selections, structural);
  }

  function withSelections(vitals, spec, selections, structural) {
    var v = clone(vitals || {}) || {};
    var valid = normalizeSelections(spec, selections, structural);
    v.temporaryProficiencies = { version:1, specId:spec.id, source:spec.source, selections:valid };
    return v;
  }

  function apply(structural, vitals) {
    var base = clone(structural || {}) || {}, spec = specFromStructural(base);
    if (!spec) return base;
    base.restProficiencies = spec;
    var selections = currentSelections(vitals, spec, base);
    base.baseProficiencies = clone(base.proficiencies || {}) || {};
    base.proficiencies = clone(base.proficiencies || {}) || {};
    ['skills','weapons','tools'].forEach(function (type) { if (!Array.isArray(base.proficiencies[type])) base.proficiencies[type] = []; });
    selections.forEach(function (s) { add(base.proficiencies[s.kind + 's'], s.name); });
    if (selections.some(function (s) { return s.kind === 'skill'; })) {
      var pb = Number(base.proficiencyBonus) || 0;
      base.skills = (base.skills || []).map(function (skill) {
        var pick = selections.filter(function (s) { return s.kind === 'skill' && key(s.name) === key(skill.name); })[0];
        if (!pick || skill.prof) return skill;
        return Object.assign({}, skill, { prof:true, bonus:(Number(skill.bonus) || 0) + pb, temporaryProficiency:true });
      });
      ['Perception','Insight'].forEach(function (name) {
        var row = base.skills.filter(function (s) { return s.name === name; })[0];
        if (row) base[name === 'Perception' ? 'passivePerception' : 'passiveInsight'] = 10 + (Number(row.bonus) || 0);
      });
    }
    base.temporaryProficiencies = { source:spec.source, selections:selections };
    return base;
  }

  var API = {
    SKILLS: SKILLS.slice(), WEAPONS: WEAPONS.map(function (w) { return w.name; }), TOOLS: TOOLS.slice(),
    specFromRace: specFromRace, specFromStructural: specFromStructural,
    optionsForKind: optionsForKind, normalizeSelections: normalizeSelections,
    currentSelections: currentSelections, withSelections: withSelections, apply: apply
  };
  if (typeof window !== 'undefined') window.TranceProficiencies = API;
  if (typeof globalThis !== 'undefined') globalThis.TranceProficiencies = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
