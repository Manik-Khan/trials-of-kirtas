# The Trials of Kirtas — Campaign Site

A static campaign wiki for a D&D 5e game, hosted on GitHub Pages.

## Setup

1. Create a new GitHub repo (e.g. `kirtas` or `trials-of-kirtas`)
2. Upload all files from this folder into the repo root
3. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**
4. Your site will be live at `https://yourusername.github.io/kirtas`

## File Structure

```
/
├── index.html          Homepage
├── factions.html       Faction codex
├── party.html          Character sheets
├── chronicle.html      Session journal
├── npcs.html           NPC hub
├── world.html          Locations
├── lore.html           Campaign lore
└── img/
    └── factions/
        ├── wolven.png          Kings Army / The Wolven
        ├── bluejackets.png     Alliance to Restore Kirtas
        ├── numior.png          Numiorian Military
        ├── redeagles.png       The Red Eagles
        ├── rook.png            Band of the Rook
        ├── stags.png           The Stags
        ├── verdaaners.png      The Verdaaners
        └── threshers.png       The Threshers
```

## Adding Faction Heraldry Images

1. Extract the coat of arms images from the Factions PDF
2. Save each as a PNG with a transparent or white background
3. Place them in `/img/factions/` with the filenames above
4. The site will pick them up automatically — no code changes needed

If an image is missing, the faction card shows a placeholder emoji instead.

## Updating the Site

- **New session journal entry:** Add a new entry block at the top of `chronicle.html`
- **New NPC:** Add a card to `npcs.html`
- **Character sheet update:** Replace the character's section in `party.html`
- **New location:** Add to `world.html`

All updates: edit the file locally → commit → push → live within seconds.
