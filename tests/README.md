# Tests

Run tests from the repository root so harnesses that intentionally read live
HTML and JavaScript by working-directory path continue to resolve correctly.

## Root-application smoke tests

`tests/smoke/` contains the 81 standalone smoke harnesses formerly stored at
the repository root. They cover the character sheet, gear, Soul Shards,
appearance, rail, Chronicle, journal capture, and related application systems.

Run the smoke relevant to the files changed:

```sh
node tests/smoke/smoke-sheet-mount.mjs
```

Some harnesses require `jsdom`, network access, or historical fixture paths;
their file headers call out those requirements.

## Forge smoke tests

Forge tests remain beside their subsystem under `forge/tests/`:

```sh
node forge/tests/smoke-los-cover.js
```

See `forge/README.md` and the repository `AGENTS.md` for the complete Forge
validation contract.
