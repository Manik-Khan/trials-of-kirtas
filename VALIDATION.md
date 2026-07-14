# Validation — Phase 1.5h.1 renderer boot hotfix

- Root cause reproduced by source-order inspection: the initial `rebuild()` ran
  before `DISCOVERY_RENDER` received its object value.
- Registry initialization moved ahead of all terrain construction.
- Late duplicate assignment removed.
- Production module and all executable inline scripts parse.
- Updated Phase 1.5h contract smoke includes an initialization-order regression.
- Full cumulative Phase 1.5h bundle battery rerun against the corrected file.
- SHA-256 manifest verifies without a self-entry.
- No commit or push performed.
