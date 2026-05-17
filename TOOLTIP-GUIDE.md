# NPC Tooltip System — How To Use

## Overview

When a character's name appears in any page of the site, you can turn it into
a hoverable tooltip link. Hovering the name pops up a small card showing their
full name, role, status, and a brief description — without leaving the page.

The system has two files:
- `tooltips.js` — all NPC data and the tooltip logic
- `tooltips.css` — the styling

---

## Adding a New NPC to the System

Open `tooltips.js` and find the `NPC_DATA` object near the top.
Add a new entry following this format:

```javascript
keynamehere: {
  name: 'Full Display Name',
  role: 'Title or Role Description',
  status: 'alive',   // alive | dead | unknown | hostile
  desc: 'One or two sentences describing this person.'
},
```

The **key** (e.g. `keynamehere`) must be:
- All lowercase
- No spaces or special characters
- Unique — no two NPCs can share a key

**Example — adding a new NPC called "Captain Aldric":**

```javascript
aldric: {
  name: 'Captain Aldric',
  role: 'Gate Captain — Tiersgard City Watch',
  status: 'alive',
  desc: 'A weathered veteran who has kept the peace at Tiersgard\'s eastern gate for fifteen years. Pragmatic, not easily bribed.'
},
```

---

## Linking a Name on Any Page

Once the NPC exists in `tooltips.js`, wrap their name in a span anywhere on the site:

```html
<span class="npc-link" data-npc="aldric">Captain Aldric</span>
```

- `class="npc-link"` — applies the gold underline style
- `data-npc="aldric"` — must match the key in NPC_DATA exactly

You can wrap it around bold text too:

```html
<span class="npc-link" data-npc="aldric"><strong>Captain Aldric</strong></span>
```

---

## Enabling Tooltips on a Page

Any page that uses tooltip links needs both files linked. Add these two lines:

**In the `<head>` section** (after the Google Fonts link):
```html
<link rel="stylesheet" href="tooltips.css">
```

**Just before the closing `</body>` tag:**
```html
<script src="tooltips.js"></script>
```

Pages already set up:
- ✅ `lore.html`

Pages to add when needed:
- `chronicle.html` — add when session entries mention NPCs
- `world.html` — add when location descriptions mention NPCs
- `npcs.html` — add if you cross-reference NPCs within descriptions

---

## Status Options

| Value     | Badge Color | Use for                              |
|-----------|-------------|--------------------------------------|
| `alive`   | Green       | Known to be living                   |
| `dead`    | Red         | Confirmed deceased                   |
| `unknown` | Grey        | Whereabouts or status unclear        |
| `hostile` | Orange-red  | Enemy or dangerous to the party      |

---

## Current NPCs in the System

| Key        | Name               | Status  |
|------------|--------------------|---------|
| `tyrus`    | Tyrus Ranec        | Alive   |
| `darius`   | General Darius     | Alive   |
| `reykoldt` | Lord Reykoldt      | Alive   |
| `prince`   | The Young Prince   | Unknown |
| `aluin`    | Aluin Ranec III    | Dead    |
| `eneos`    | King Eneos II      | Alive   |
| `rhadig`   | Rhadig of Koria    | Hostile |
| `solci`    | Lucius Solci       | Unknown |

Add new rows to this table as you add new NPCs.
