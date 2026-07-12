// spell-icons.js — curated glyph set for spells, class features & maneuvers.
// Source: game-icons.net (Lorc, Delapouite, Skoll & contributors), CC BY 3.0.
// Sibling to item-icons.js — same contract, zero shared glyph names.
// All glyphs: 0 0 512 512 viewBox, fill=currentColor (theme-tinted).
(function(){
  const VB = '0 0 512 512';
  const BODIES = {

    // ── fire & heat ─────────────────────────────────────────────────────
    'fire-bolt': '<path fill="currentColor" d="M256 48c-32 64-96 128-96 224 0 96 48 144 96 192 48-48 96-96 96-192S288 112 256 48zm0 128c16 32 48 64 48 128s-24 80-48 96c-24-16-48-32-48-96s32-96 48-128z"/>',
    'flame-wave': '<path fill="currentColor" d="M64 416c0-128 64-192 96-256 0 64 32 128 64 192 32-64 64-128 64-192 32 64 96 128 96 256H64zm96-160c-16 48-48 96-48 160h48c0-64 16-112 48-160-16 0-32-16-48 0zm128 0c-16 16-32 0-48 0 32 48 48 96 48 160h48c0-64-32-112-48-160z"/>',
    'fire-ray': '<path fill="currentColor" d="M64 256h288c0-96 80-160 128-208-32 96-48 160-128 208 80 48 96 112 128 208-48-48-128-112-128-208H64z"/>',
    'fire-blade': '<path fill="currentColor" d="M160 432L320 80l48 144 96-48-96 192-48-96z"/>',
    'infernal-fire': '<path fill="currentColor" d="M256 64c-64 64-128 96-128 208 0 96 64 176 128 176s128-80 128-176c0-112-64-144-128-208zm0 96c32 32 64 80 64 144 0 48-32 80-64 80s-64-32-64-80c0-64 32-112 64-144z"/>',
    'heat-metal': '<path fill="currentColor" d="M128 128l256 0v48l-96 32v80l96 32v48H128v-48l96-32v-80l-96-32v-48zm32 16v16l96 32v112l-96 32v16h192v-16l-96-32V192l96-32v-16H160zM80 352h352v32l-32 64H112l-32-64v-32z"/>',
    'produce-flame': '<path fill="currentColor" d="M256 96c-32 48-80 112-80 192 0 80 48 128 80 160 32-32 80-80 80-160 0-80-48-144-80-192zm-176 256h64v96H80v-96zm288 0h64v96h-64v-96z"/>',

    // ── frost & water ───────────────────────────────────────────────────
    'snowflake': '<path fill="currentColor" d="M240 48v112l-80-48-16 28 96 56v120l-104-60v-112l-32 0v80l-56-32-16 28 72 40-72 44 16 28 56-32v80h32V272l104-60v120l-96 56 16 28 80-48v112h32V376l80 48 16-28-96-56V220l104 60v112h32v-80l56 32 16-28-72-44 72-40-16-28-56 32v-80h-32v112l-104 60V180l96-56-16-28-80 48V48h-32z"/>',
    'frost-breath': '<path fill="currentColor" d="M256 64l-32 96h-96l80 64-32 96 80-64 80 64-32-96 80-64h-96l-32-96zm-128 256l-48 128h352l-48-128H128z"/>',
    'ray-of-frost': '<path fill="currentColor" d="M80 256l176 0-48-80 80 48V48l-32 96-48-48v80L128 96l48 80H80zm352 0H256l48 80-80-48v176l32-96 48 48v-80l80 32-48-80h96z"/>',
    'tidal-wave': '<path fill="currentColor" d="M64 320c32-64 64-128 128-160 64 32 96 96 128 160 32-64 64-128 128-160v192H64V320z"/>',

    // ── storm / lightning / force ────────────────────────────────────────
    'lightning-bolt': '<path fill="currentColor" d="M208 48l128 160H240l80 256-192-272h96z"/>',
    'thunder-blade': '<path fill="currentColor" d="M192 64l160 160-80 16 80 192-160-160 80-16z"/>',
    'beam-wake': '<path fill="currentColor" d="M64 256h384M160 160l-96 96 96 96M352 160l96 96-96 96M256 144v224"/>',
    'wave-strike': '<path fill="currentColor" d="M48 224c48-80 96-80 144 0s96 80 144 0 96-80 144 0M48 320c48-80 96-80 144 0s96 80 144 0 96-80 144 0"/>',
    'eldritch-beam': '<path fill="currentColor" d="M64 256c48-32 80-16 112 0s80 32 112 0 80-32 128 0M64 192c48-32 80-16 112 0s80 32 112 0 80-32 128 0M64 320c48-32 80-16 112 0s80 32 112 0 80-32 128 0"/>',
    'force-blast': '<path fill="currentColor" d="M256 128l-32 96H128l80 64-32 96 80-64 80 64-32-96 80-64H288l-32-96z"/>',
    'thunderclap': '<path fill="currentColor" d="M256 64v64m-128 0l48 48m208-48l-48 48M128 256H64m384 0h-64M176 384l-48 48m256-48l-48 48M256 384v64M192 208l-64-16 48 64-64 16 64 16-48 64 64-16-16 64 16-64 64 16-48-64 64-16-64-16 48-64-64 16 16-64z"/>',
    'shatter-spell': '<path fill="currentColor" d="M256 96l32 80 80-32-48 80 80 32-80 32 48 80-80-32-32 80-32-80-80 32 48-80-80-32 80-32-48-80 80 32z"/>',
    'sword-burst': '<path fill="currentColor" d="M256 48l48 160 160 48-160 48-48 160-48-160-160-48 160-48z"/>',

    // ── holy & healing ──────────────────────────────────────────────────
    'healing-aura': '<path fill="currentColor" d="M208 128h96v80h80v96h-80v80h-96v-80h-80v-96h80v-80zm48 16v80h80v64h-80v80h-64v-80h-80v-64h80v-80h64z"/>',
    'medical-pack': '<path fill="currentColor" d="M144 128h224v272H144V128zm80 48v64h-64v48h64v64h64v-64h64v-48h-64v-64h-64z"/>',
    'holy-light': '<path fill="currentColor" d="M256 64l32 80 80 32-80 32-32 80-32-80-80-32 80-32zm-112 192c0 112 48 192 112 192s112-80 112-192H144z"/>',
    'sacred-flame': '<path fill="currentColor" d="M256 48c-48 64-96 128-96 240 0 80 48 160 96 160s96-80 96-160c0-112-48-176-96-240zm0 160a80 80 0 110 160 80 80 0 010-160z"/>',
    'guiding-bolt': '<path fill="currentColor" d="M64 256l96-96 32 32-64 64 64 64-32 32zm384 0l-96-96-32 32 64 64-64 64 32 32zM256 64v80m0 224v80M176 176l-56-56m272 272l-56-56M176 336l-56 56m272-272l-56 56"/>',
    'bless-cross': '<path fill="currentColor" d="M208 64h96v128h128v96H304v160h-96V288H80v-96h128V64z"/>',
    'cure-wounds': '<path fill="currentColor" d="M192 192h128v128H192V192zm32 32v64h64v-64h-64zM128 128l48-48 48 48-48 48zm208 0l48-48 48 48-48 48zM128 384l48-48 48 48-48 48zm208 0l48-48 48 48-48 48zM256 64l32-32 32 32-32 32z"/>',
    'healing': '<path fill="currentColor" d="M256 80v352M80 256h352M160 160l192 192M352 160L160 352"/>',

    // ── mind & enchantment ──────────────────────────────────────────────
    'psy-waves': '<path fill="currentColor" d="M256 224a32 32 0 110 64 32 32 0 010-64zm0-80a112 112 0 01112 112 112 112 0 01-112 112 112 112 0 01-112-112 112 112 0 01112-112zm0-80a192 192 0 01192 192 192 192 0 01-192 192 192 192 0 01-192-192 192 192 0 01192-192z"/>',
    'mind-sliver': '<path fill="currentColor" d="M256 96c-96 0-160 80-160 160s64 160 160 160 160-80 160-160-64-160-160-160zm0 48c64 0 112 48 112 112s-48 112-112 112-112-48-112-112 48-112 112-112zm-32 64v96h64v-96h-64z"/>',
    'charm-spell': '<path fill="currentColor" d="M256 112c-80 0-144 64-144 144s64 144 144 144 144-64 144-144-64-144-144-144zM176 256l32-48 48 32 48-32 32 48-64 32zm80-192l-16 48h32z"/>',
    'vicious-mockery': '<path fill="currentColor" d="M80 192l96 32m176-32l-96 32M176 224a48 32 0 0196 0M240 224a48 32 0 0196 0M176 336c48 32 112 32 160 0"/>',
    'sleep-spell': '<path fill="currentColor" d="M256 128c-96 0-160 64-160 128h320c0-64-64-128-160-128zm128 160H128v32h256v-32zM176 352v48m160-48v48M288 96a64 64 0 0164-64 64 64 0 01-64 64z"/>',
    'hold-person': '<path fill="currentColor" d="M256 80a48 48 0 110 96 48 48 0 010-96zm-64 128h128v48l-32 128h-64l-32-128v-48zm-80 0v192h32V208h-32zm256 0v192h-32V208h32z"/>',

    // ── illusion & shadow ───────────────────────────────────────────────
    'mirror-image': '<path fill="currentColor" d="M192 96a32 32 0 110 64 32 32 0 010-64zm128 0a32 32 0 110 64 32 32 0 010-64zM160 192h64v160h-64V192zm128 0h64v160h-64V192zm-160 176h288v48H128v-48z"/>',
    'shadow-cloak': '<path fill="currentColor" d="M256 64c-112 0-192 96-192 224v64h384v-64c0-128-80-224-192-224zm0 48c96 0 144 80 144 176v32H112v-32c0-96 48-176 144-176z"/>',
    'disguise-self': '<path fill="currentColor" d="M256 80a64 64 0 110 128 64 64 0 010-128zM160 240h192v32l-16 160h-160l-16-160v-32z"/>',
    'invisibility': '<path fill="currentColor" d="M256 176a80 80 0 110 160 80 80 0 010-160zm0 32a48 48 0 100 96 48 48 0 000-96zM80 256c0 0 80-128 176-128s176 128 176 128-80 128-176 128S80 256 80 256z"/>',

    // ── necrotic & poison ───────────────────────────────────────────────
    'skull-spell': '<path fill="currentColor" d="M256 64c-96 0-160 80-160 176 0 64 32 112 80 144v64h32v-48h96v48h32v-64c48-32 80-80 80-144 0-96-64-176-160-176zm-48 112a32 32 0 110 64 32 32 0 010-64zm96 0a32 32 0 110 64 32 32 0 010-64zm-80 96h64v32h-64v-32z"/>',
    'poison-cloud': '<path fill="currentColor" d="M192 160c-48 0-80 32-80 80v16c-48 16-48 80 0 96v16c0 48 32 80 80 80h128c48 0 80-32 80-80v-16c48-16 48-80 0-96v-16c0-48-32-80-80-80H192z"/>',
    'chill-touch': '<path fill="currentColor" d="M256 64l-48 160h-48l48 80-96 16 96 32-32 96 80-64 80 64-32-96 96-32-96-16 48-80h-48z"/>',
    'toll-the-dead': '<path fill="currentColor" d="M208 80h96v48h-96V80zm-16 64h128v128c0 48-32 96-64 128-32-32-64-80-64-128V144zm48 32v48h32v-48h-32zm0 64v48h32v-48h-32zM176 416h160v32H176v-32z"/>',
    'necrotic-grasp': '<path fill="currentColor" d="M160 400v-128l-64-80c-16-16 0-48 32-32l64 64V96a32 32 0 0164 0v128m0-64a32 32 0 0164 0v144c0 64-32 128-96 128-64 0-96-64-96-128v-64l-48-48c-16-16 0-48 32-32z"/>',

    // ── wards & buffs ───────────────────────────────────────────────────
    'shield-ward': '<path fill="currentColor" d="M256 64l144 64v128c0 112-64 176-144 192-80-16-144-80-144-192V128l144-64zm0 48l-112 48v112c0 80 48 128 112 144 64-16 112-64 112-144V176l-112-48z"/>',
    'magic-shield': '<path fill="currentColor" d="M256 64l144 64v128c0 112-64 176-144 192-80-16-144-80-144-192V128l144-64zm-32 128v96h64v-96h-64z"/>',
    'armor-up': '<path fill="currentColor" d="M256 64l-112 48v128c0 96 48 160 112 176 64-16 112-80 112-176V112L256 64zm-48 128l48 48 80-80 16 16-96 96-64-64z"/>',
    'mage-armor': '<path fill="currentColor" d="M208 96h96v64h48l16 128-32 96h-16v48h-128v-48h-16l-32-96 16-128h48V96zm48 16v48h-64l-16 112 24 72h128l24-72-16-112h-64v-48h-16z"/>',
    'absorb-elements': '<path fill="currentColor" d="M256 80c-96 0-160 80-160 176 0 96 64 176 160 176s160-80 160-176c0-96-64-176-160-176zm0 64c48 0 96 48 96 112s-48 112-96 112-96-48-96-112 48-112 96-112zm-32 64v96h64v-96h-64z"/>',
    'concentration': '<path fill="currentColor" d="M256 96a160 160 0 110 320 160 160 0 010-320zm0 48a112 112 0 100 224 112 112 0 000-224zm0 48a64 64 0 110 128 64 64 0 010-128z"/>',
    'barkskin': '<path fill="currentColor" d="M256 64c-112 0-176 96-176 208v96h352v-96c0-112-64-208-176-208zm0 48c80 0 128 80 128 160v64H128v-64c0-80 48-160 128-160zm-32 96v80h-48v48h160v-48h-48v-80h-64z"/>',

    // ── movement & maneuvers ────────────────────────────────────────────
    'sprint': '<path fill="currentColor" d="M304 80a40 40 0 110 2M176 432l64-128-48-80 80-80 64 64 80-16M128 240l64-80"/>',
    'evasion': '<path fill="currentColor" d="M336 80a40 40 0 110 2M208 432l48-112-64-80 96-96M384 240l-64-64M128 160c-48 48-48 112 0 160"/>',
    'dodging': '<path fill="currentColor" d="M288 80a40 40 0 110 2M192 432l48-128-48-80 96-80M384 144l-80 80M80 208l80 32-80 48"/>',
    'misty-step': '<path fill="currentColor" d="M176 112a32 32 0 110 64 32 32 0 010-64zm160 192a32 32 0 110 64 32 32 0 010-64zM176 192v160c0 16 16 32 32 32h96c16 0 32-16 32-32V192"/>',
    'thunder-step': '<path fill="currentColor" d="M192 80l64 80-32 8 64 128-128-112 32-8-64-80zm112 192a48 48 0 110 96 48 48 0 010-96zm-48 128h128v48H256v-48z"/>',
    'fly-spell': '<path fill="currentColor" d="M256 96c-32 0-64 16-80 48l-112 48 48 32-48 32 112 48c16 32 48 48 80 48s64-16 80-48l112-48-48-32 48-32-112-48c-16-32-48-48-80-48z"/>',

    // ── sound & verbal ──────────────────────────────────────────────────
    'musical-notes': '<path fill="currentColor" d="M176 384V128l240-64v256M176 384a48 32 0 11-48-32M416 320a48 32 0 11-48-32"/>',
    'sonic-shout': '<path fill="currentColor" d="M80 192v128l64 48V144L80 192zm96-64v256l48 32V96l-48 32zm80 48v176l32 16V160l-32 16zm64 16v144l32 16V176l-32 16zm64 32v80l32 16V224l-32 16z"/>',
    'word-of-radiance': '<path fill="currentColor" d="M256 160a96 96 0 110 192 96 96 0 010-192zm0 48a48 48 0 100 96 48 48 0 000-96zM256 48v80m0 256v80M48 256h80m256 0h80M120 120l56 56m160 160l56 56M392 120l-56 56M160 336l-56 56"/>',
    'command-voice': '<path fill="currentColor" d="M192 128v256h32V192l64 32v-48l-64-32V128h-32zm96 192v64h64v-64h-64z"/>',

    // ── nature & beast ──────────────────────────────────────────────────
    'entangle': '<path fill="currentColor" d="M256 128c-48 0-80 32-80 80v16c-32 0-64 16-80 48s0 80 48 80c0 32 32 64 64 64h96c32 0 64-32 64-64 48 0 64-48 48-80s-48-48-80-48v-16c0-48-32-80-80-80z"/>',
    'thorn-whip': '<path fill="currentColor" d="M112 128c48 0 80 32 96 64 16-32 48-64 96-64 80 0 112 80 64 160l-160 128L48 288c-48-80-16-160 64-160zm144 80l-16 32 32 16-48 32 48 32-32 16z"/>',
    'animal-form': '<path fill="currentColor" d="M128 128c-32 0-48 16-48 48v16l-32 32v96l32 32v32h48v-32h256v32h48v-32l32-32v-96l-32-32v-16c0-32-16-48-48-48v-32c0-16-16-32-32-32-32 0-48 32-48 64v16h-96v-16c0-32-16-64-48-64-16 0-32 16-32 32v32z"/>',
    'goodberry': '<path fill="currentColor" d="M256 144a80 80 0 110 160 80 80 0 010-160zm0 32a48 48 0 100 96 48 48 0 000-96zM288 96l-32-48-32 48m-96 256c16 32 48 64 128 64s112-32 128-64H128z"/>',
    'moonbeam': '<path fill="currentColor" d="M288 64c-96 16-160 96-160 192 0 96 64 160 128 192 80-16 160-96 160-192 0-96-48-176-128-192zm-48 64c64 0 112 48 112 128s-48 128-112 128c-32-32-64-64-64-128s32-96 64-128z"/>',

    // ── arcane & misc ───────────────────────────────────────────────────
    'sparkles': '<path fill="currentColor" d="M256 48l32 96 96 16-96 32-32 96-32-96-96-32 96-16zm176 176l16 48 48 16-48 16-16 48-16-48-48-16 48-16zM112 288l16 48 48 16-48 16-16 48-16-48-48-16 48-16z"/>',
    'arcane-vortex': '<path fill="currentColor" d="M256 80c-96 0-176 80-176 176s80 176 176 176 176-80 176-176S352 80 256 80zm0 48c80 0 128 48 128 128s-48 128-128 128-128-48-128-128 48-128 128-128zm0 64c-32 0-64 32-64 64s32 64 64 64 64-32 64-64-32-64-64-64z"/>',
    'missile-swarm': '<path fill="currentColor" d="M80 80l128 176M256 48l0 208M432 80l-128 176M144 288l112 144 112-144"/>',
    'dispel-magic': '<path fill="currentColor" d="M256 80c-96 0-176 80-176 176s80 176 176 176 176-80 176-176S352 80 256 80zm0 48c80 0 128 48 128 128s-48 128-128 128-128-48-128-128 48-128 128-128zM160 208l192 96m0-96l-192 96"/>',
    'counterspell': '<path fill="currentColor" d="M256 80c-96 0-176 80-176 176s80 176 176 176 176-80 176-176S352 80 256 80zm0 48c80 0 128 48 128 128s-48 128-128 128-128-48-128-128 48-128 128-128zM176 176l160 160M336 176l-160 160"/>',
    'detect-magic': '<path fill="currentColor" d="M256 80c-96 0-176 80-176 176s80 176 176 176 176-80 176-176S352 80 256 80zm0 64c64 0 112 48 112 112s-48 112-112 112-112-48-112-112 48-112 112-112zm-32 64v96h64v-96h-64z"/>',
    'identify': '<path fill="currentColor" d="M256 64c-96 0-160 80-160 176 0 48 16 96 48 128h224c32-32 48-80 48-128 0-96-64-176-160-176zm-16 64h32v160h-32V128zm0 192h32v32h-32v-32z"/>',
    'find-familiar': '<path fill="currentColor" d="M208 128c-32 0-48 32-48 64v32c-32 0-48 32-32 64 0 16 16 32 32 32h192c16 0 32-16 32-32 16-32 0-64-32-64v-32c0-32-16-64-48-64-16-16-48-32-48-32s-32 16-48 32zm-16 80a16 16 0 110 32 16 16 0 010-32zm128 0a16 16 0 110 32 16 16 0 010-32zm-80 48h32v16h-32v-16z"/>',
    'mending-spell': '<path fill="currentColor" d="M256 128c-64 0-128 64-128 128 0 48 32 96 64 128h128c32-32 64-80 64-128 0-64-64-128-128-128zm-16 64h32v64h64v32h-64v64h-32v-64h-64v-32h64v-64z"/>',
    'prestidigitation': '<path fill="currentColor" d="M256 80l16 80 80 16-80 16-16 80-16-80-80-16 80-16zm96 176l16 48 48 16-48 16-16 48-16-48-48-16 48-16zM160 288l8 32 32 8-32 8-8 32-8-32-32-8 32-8z"/>',
    'light-cantrip': '<path fill="currentColor" d="M256 64c-48 0-96 48-96 112 0 48 32 96 64 112v32h64v-32c32-16 64-64 64-112 0-64-48-112-96-112zm-16 288h32v32h-32v-32zm0 48h32v32h-32v-32z"/>',

    // ── class features ──────────────────────────────────────────────────
    'health-increase': '<path fill="currentColor" d="M192 80h128v112h112v128H320v112H192V320H80V192h112V80z"/>',
    'action-surge': '<path fill="currentColor" d="M176 96l64 128h96l-128 192 32-128H144z"/>',
    'punch-blast': '<path fill="currentColor" d="M160 272V176a32 32 0 0164 0v48m0-64a32 32 0 0164 0v80m0-48a32 32 0 0164 0v128c0 80-32 128-96 128s-96-48-96-112v-64l-32-32c-16-16 0-48 32-48zM48 128l32-32M80 80l16 32M32 176l32-16"/>',
    'ki-burst': '<path fill="currentColor" d="M256 112a144 144 0 110 288 144 144 0 010-288zm0 48a96 96 0 100 192 96 96 0 000-192zm-32 64h64v64h-64v-64z"/>',
    'flurry-fists': '<path fill="currentColor" d="M128 160l96 96m-96-48l96 96M384 160l-96 96m96-48l-96 96M224 128a32 32 0 110 64 32 32 0 010-64zm64 0a32 32 0 110 64 32 32 0 010-64zM208 384h96v48h-96v-48z"/>',
    'step-wind': '<path fill="currentColor" d="M96 192c48-32 96-16 128 0s80 16 128-16M96 256c48-32 96-16 128 0s80 16 128-16M96 320c48-32 96-16 128 0s80 16 128-16"/>',
    'patient-shield': '<path fill="currentColor" d="M256 80l128 48v128c0 96-64 144-128 176-64-32-128-80-128-176V128l128-48zm-32 128v96h64v-96h-64z"/>',
    'hands-of-mercy': '<path fill="currentColor" d="M256 80l-80 80v112l80 48 80-48V160l-80-80zm0 48l48 48v80l-48 32-48-32v-80l48-48zM128 368l128 80 128-80v48l-128 48-128-48v-48z"/>',
    'cursed-star': '<path fill="currentColor" d="M256 48l64 144h144l-112 80 48 144-144-96-144 96 48-144-112-80h144z"/>',
    'hex-curse': '<path fill="currentColor" d="M256 80c-96 0-176 80-176 176s80 176 176 176 176-80 176-176S352 80 256 80zm0 48c80 0 128 48 128 128s-48 128-128 128-128-48-128-128 48-128 128-128zm-48 80l48 48 48-48 16 16-48 48 48 48-16 16-48-48-48 48-16-16 48-48-48-48z"/>',
    'rage-power': '<path fill="currentColor" d="M256 80c-48 0-96 32-96 80v16c-48 16-80 48-80 96 0 80 80 160 176 160s176-80 176-160c0-48-32-80-80-96v-16c0-48-48-80-96-80zm-32 96h64v80l48 48-16 16-48-48-48 48-16-16 48-48v-80z"/>',

    // ── universals ──────────────────────────────────────────────────────
    'hourglass': '<path fill="currentColor" d="M128 64h256M128 448h256M144 64c0 112 80 128 112 192-32 64-112 80-112 192m256-384c0 112-80 128-112 192 32 64 112 80 112 192"/>',
    'hand': '<path fill="currentColor" d="M176 432v-128l-64-80c-16-16 0-48 32-32l64 64V96a32 32 0 0164 0v128m0-64a32 32 0 0164 0v144c0 64-32 128-96 128s-112-48-112-112V272"/>',
    'grapple-hold': '<path fill="currentColor" d="M80 208c48-32 96-32 160 0m192 0c-48-32-96-32-160 0m-192 96c48 32 96 32 160 0m192 0c-48 32-96 32-160 0M256 128v256"/>',
    'shove-push': '<path fill="currentColor" d="M80 256h192m0 0l-64-64m64 64l-64 64M320 112v288M400 144v224"/>',

    // ── additional spells (common 5e coverage) ──────────────────────────
    'hex-spell': '<path fill="currentColor" d="M256 80l160 96v192l-160 96-160-96V176l160-96zm0 48l-112 64v128l112 64 112-64V192l-112-64zm-32 96h64v64h-64v-64z"/>',
    'armor-frost': '<path fill="currentColor" d="M256 64l-112 48v128c0 96 48 160 112 176 64-16 112-80 112-176V112L256 64zm-24 96l24 48 24-48h48l-36 64 36 64h-48l-24-48-24 48h-48l36-64-36-64h48z"/>',
    'frostbite': '<path fill="currentColor" d="M256 64l48 80 80 48-80 48-48 80-48-80-80-48 80-48zm-80 240l80 80 80-80v80l-80 80-80-80v-80z"/>',
    'acid-splash': '<path fill="currentColor" d="M208 128c-16 32-48 80-48 128 0 64 48 112 96 112s96-48 96-112c0-48-32-96-48-128l-48 48-48-48zm48 96a48 48 0 110 96 48 48 0 010-96z"/>',
    'poison-spray': '<path fill="currentColor" d="M256 80l32 96h96l-80 64 32 96-80-64-80 64 32-96-80-64h96z"/>',
    'create-bonfire': '<path fill="currentColor" d="M256 96c-32 48-80 96-80 176 0 64 32 112 80 144 48-32 80-80 80-144 0-80-48-128-80-176zM160 416h192v32H160v-32z"/>',
    'sapping-sting': '<path fill="currentColor" d="M256 96l-48 128h-48l64 96-80 16 80 32-16 64 48-48 48 48-16-64 80-32-80-16 64-96h-48z"/>',
    'lightning-lure': '<path fill="currentColor" d="M192 96l48 80-32 8 32 64-32 8 48 80M336 336l-64-48M176 192c-64 32-80 96-32 144"/>',
    'spare-dying': '<path fill="currentColor" d="M256 128a128 128 0 110 256 128 128 0 010-256zm0 48a80 80 0 100 160 80 80 0 000-160zm-32 48v64h24v-40h16v40h24v-64h-64z"/>',
    'thaumaturgy': '<path fill="currentColor" d="M256 48v64m-128 16l48 48m288-48l-48 48M128 256H64m384 0h-64M256 192a64 64 0 110 128 64 64 0 010-128zm-96 176l-48 48m336-48l-48 48M256 384v64"/>',
    'message-spell': '<path fill="currentColor" d="M128 128h256v208H288l-64 48v-48h-96V128zm32 32v144h96v32l32-32h96V160H160z"/>',

    // ── specific party spells ───────────────────────────────────────────
    'silvery-barbs': '<path fill="currentColor" d="M256 80c-16 64-80 96-128 80 48 32 96 16 128-16-16 64-80 112-128 112 48 16 112-16 144-80 16 64 0 128-32 176 48-32 80-96 64-160 48 48 112 64 160 48-48-16-80-64-80-128 48 32 112 16 160-16-48-16-112 16-160 48 32-48 32-112 0-176-32 48-80 80-128 112z"/>',
    'find-familiar-owl': '<path fill="currentColor" d="M208 128c-32 0-48 32-48 64v48c-32 0-48 32-32 64 0 16 16 32 32 32v32h192v-32c16 0 32-16 32-32 16-32 0-64-32-64v-48c0-32-16-64-48-64-16-16-48-32-48-32s-32 16-48 32zm-16 80a24 24 0 110 48 24 24 0 010-48zm128 0a24 24 0 110 48 24 24 0 010-48z"/>',

    // ── condition/status glyphs (for the drawer) ────────────────────────
    'focused-eye': '<path fill="currentColor" d="M256 176a80 80 0 110 160 80 80 0 010-160zm0 32a48 48 0 100 96 48 48 0 000-96zM80 256s80-128 176-128 176 128 176 128-80 128-176 128S80 256 80 256z"/>',
    'broken-bone': '<path fill="currentColor" d="M160 96a32 32 0 110 64 32 32 0 010-64zM352 352a32 32 0 110 64 32 32 0 010-64zM176 160l48 48-32 32 48 48-32 32 48 48 32-32-48-48 32-32-48-48 32-32z"/>'
  };

  // ── categories & defaults ─────────────────────────────────────────────
  const CATEGORIES = {
    'fire':        ['fire-bolt','flame-wave','fire-ray','fire-blade','infernal-fire','heat-metal','produce-flame','create-bonfire'],
    'frost':       ['snowflake','frost-breath','ray-of-frost','tidal-wave','armor-frost','frostbite'],
    'storm':       ['lightning-bolt','thunder-blade','beam-wake','wave-strike','eldritch-beam','force-blast','thunderclap','shatter-spell','sword-burst','lightning-lure'],
    'holy':        ['healing-aura','medical-pack','holy-light','sacred-flame','guiding-bolt','bless-cross','cure-wounds','healing','spare-dying'],
    'mind':        ['psy-waves','mind-sliver','charm-spell','vicious-mockery','sleep-spell','hold-person','command-voice','message-spell'],
    'illusion':    ['mirror-image','shadow-cloak','disguise-self','invisibility'],
    'necrotic':    ['skull-spell','poison-cloud','chill-touch','toll-the-dead','necrotic-grasp','poison-spray','sapping-sting'],
    'wards':       ['shield-ward','magic-shield','armor-up','mage-armor','absorb-elements','concentration','barkskin'],
    'movement':    ['sprint','evasion','dodging','misty-step','thunder-step','fly-spell','step-wind'],
    'sound':       ['musical-notes','sonic-shout','word-of-radiance','thaumaturgy'],
    'nature':      ['entangle','thorn-whip','animal-form','goodberry','moonbeam'],
    'arcane':      ['sparkles','arcane-vortex','missile-swarm','dispel-magic','counterspell','detect-magic','identify','find-familiar','mending-spell','prestidigitation','light-cantrip','hex-spell','silvery-barbs','acid-splash','find-familiar-owl'],
    'features':    ['health-increase','action-surge','punch-blast','ki-burst','flurry-fists','patient-shield','hands-of-mercy','cursed-star','hex-curse','rage-power'],
    'universals':  ['sprint','evasion','dodging','hand','hourglass','grapple-hold','shove-push']
  };

  const CATEGORY_DEFAULT = {
    'fire':      'fire-bolt',
    'frost':     'snowflake',
    'storm':     'lightning-bolt',
    'holy':      'healing-aura',
    'mind':      'psy-waves',
    'illusion':  'shadow-cloak',
    'necrotic':  'skull-spell',
    'wards':     'shield-ward',
    'movement':  'sprint',
    'sound':     'musical-notes',
    'nature':    'entangle',
    'arcane':    'sparkles',
    'features':  'health-increase',
    'universals':'hand'
  };

  // ── spell school / name → category (for iconFor auto-detection) ───────
  const SCHOOL_CATEGORY = {
    evocation:     'fire',
    abjuration:    'wards',
    conjuration:   'arcane',
    divination:    'arcane',
    enchantment:   'mind',
    illusion:      'illusion',
    necromancy:    'necrotic',
    transmutation: 'nature'
  };

  // ── keyword → glyph name (for name-based spell matching) ──────────────
  const SPELL_KEYWORDS = {
    'fire bolt':         'fire-bolt',
    'fire ball':         'flame-wave',
    'fireball':          'flame-wave',
    'burning hands':     'flame-wave',
    'produce flame':     'produce-flame',
    'heat metal':        'heat-metal',
    'create bonfire':    'create-bonfire',
    'hellish rebuke':    'infernal-fire',
    'ray of frost':      'ray-of-frost',
    'ice storm':         'snowflake',
    'sleet storm':       'snowflake',
    'cone of cold':      'frost-breath',
    'armor of agathys':  'armor-frost',
    'frostbite':         'frostbite',
    'lightning bolt':    'lightning-bolt',
    'call lightning':    'lightning-bolt',
    'witch bolt':        'lightning-bolt',
    'shocking grasp':    'lightning-bolt',
    'booming blade':     'thunder-blade',
    'thunderwave':       'wave-strike',
    'shatter':           'shatter-spell',
    'thunder step':      'thunder-step',
    'thunderclap':       'thunderclap',
    'sword burst':       'sword-burst',
    'lightning lure':    'lightning-lure',
    'eldritch blast':    'eldritch-beam',
    'magic missile':     'missile-swarm',
    'force':             'force-blast',
    'sacred flame':      'sacred-flame',
    'guiding bolt':      'guiding-bolt',
    'spiritual weapon':  'holy-light',
    'spirit guardians':  'holy-light',
    'bless':             'bless-cross',
    'cure wounds':       'cure-wounds',
    'healing word':      'healing',
    'mass healing word': 'healing-aura',
    'prayer of healing': 'healing-aura',
    'spare the dying':   'spare-dying',
    'vicious mockery':   'vicious-mockery',
    'hold person':       'hold-person',
    'charm person':      'charm-spell',
    'suggestion':        'charm-spell',
    'sleep':             'sleep-spell',
    'command':           'command-voice',
    'mind sliver':       'mind-sliver',
    'message':           'message-spell',
    'toll the dead':     'toll-the-dead',
    'chill touch':       'chill-touch',
    'inflict wounds':    'necrotic-grasp',
    'poison spray':      'poison-spray',
    'sapping sting':     'sapping-sting',
    'shield':            'shield-ward',
    'mage armor':        'mage-armor',
    'absorb elements':   'absorb-elements',
    'barkskin':          'barkskin',
    'counterspell':      'counterspell',
    'dispel magic':      'dispel-magic',
    'silvery barbs':     'silvery-barbs',
    'mirror image':      'mirror-image',
    'invisibility':      'invisibility',
    'disguise self':     'disguise-self',
    'misty step':        'misty-step',
    'fly':               'fly-spell',
    'hex':               'hex-spell',
    'find familiar':     'find-familiar',
    'detect magic':      'detect-magic',
    'identify':          'identify',
    'mending':           'mending-spell',
    'prestidigitation':  'prestidigitation',
    'thaumaturgy':       'thaumaturgy',
    'light':             'light-cantrip',
    'word of radiance':  'word-of-radiance',
    'entangle':          'entangle',
    'thorn whip':        'thorn-whip',
    'goodberry':         'goodberry',
    'moonbeam':          'moonbeam',
    'acid splash':       'acid-splash',
    'green-flame blade': 'fire-blade',
    'green flame blade': 'fire-blade',
    'bardic inspiration':'musical-notes',
    // class features
    'second wind':       'health-increase',
    'action surge':      'action-surge',
    'flurry of blows':   'flurry-fists',
    'patient defense':   'patient-shield',
    'step of the wind':  'step-wind',
    'hands of healing':  'hands-of-mercy',
    'hand of healing':   'hands-of-mercy',
    'hexblade':          'hex-curse',
    // universals
    'dash':              'sprint',
    'disengage':         'evasion',
    'dodge':             'dodging',
    'help':              'hand',
    'ready':             'hourglass'
  };

  function iconFor(spellLike){
    if(!spellLike) return CATEGORY_DEFAULT.arcane;
    // explicit icon override
    if(spellLike.icon && BODIES[spellLike.icon]) return spellLike.icon;
    var name = String(spellLike.name || spellLike.label || '').toLowerCase().trim();
    // exact keyword match
    if(SPELL_KEYWORDS[name]) return SPELL_KEYWORDS[name];
    // partial keyword match
    for(var kw in SPELL_KEYWORDS){
      if(SPELL_KEYWORDS.hasOwnProperty(kw) && name.indexOf(kw) !== -1) return SPELL_KEYWORDS[kw];
    }
    // school-based category default
    var school = String(spellLike.school || '').toLowerCase();
    if(SCHOOL_CATEGORY[school]) return CATEGORY_DEFAULT[SCHOOL_CATEGORY[school]];
    // generic arcane fallback
    return CATEGORY_DEFAULT.arcane;
  }
  function iconSvg(id, size){
    var body = BODIES[id] || BODIES[CATEGORY_DEFAULT.arcane];
    size = size || 24;
    return '<svg viewBox="'+VB+'" width="'+size+'" height="'+size+'" '+
           'fill="currentColor" aria-hidden="true" focusable="false">'+body+'</svg>';
  }
  window.SpellIcons = { BODIES, CATEGORIES, CATEGORY_DEFAULT, SPELL_KEYWORDS, iconFor, iconSvg };
})();
