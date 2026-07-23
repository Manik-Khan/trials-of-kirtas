/* forge-party-selection.js
   Pure authority for the local Forge party picker. The character table is not
   the party: only active rows in the player-character folder are candidates,
   and only explicitly selected candidates enter an encounter. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgePartySelection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PLAYER_FOLDER = /^(?:campaign characters|player characters|players?)$/i;

  function activeRows(party) {
    var seen = {};
    return (Array.isArray(party) ? party : []).filter(function (row) {
      if (!row || !row.key || row.deleteMarked || seen[row.key]) return false;
      seen[row.key] = true;
      return true;
    });
  }

  function playerFolder(layout) {
    var folders = layout && Array.isArray(layout.folders) ? layout.folders : [];
    return folders.filter(function (folder) {
      return folder && PLAYER_FOLDER.test(String(folder.name || "").trim());
    })[0] || null;
  }

  function candidates(party, layout) {
    var folder = playerFolder(layout);
    if (!folder) {
      return {
        ok: false,
        folder: null,
        rows: [],
        reason: "No Campaign Characters or Player Characters folder was found."
      };
    }
    var members = layout && layout.members || {};
    return {
      ok: true,
      folder: folder,
      rows: activeRows(party).filter(function (row) {
        return members[row.key] === folder.id;
      }),
      reason: ""
    };
  }

  function selectedKeys(candidateRows, selected) {
    var allowed = {}, seen = {};
    activeRows(candidateRows).forEach(function (row) { allowed[row.key] = true; });
    return (Array.isArray(selected) ? selected : []).filter(function (key) {
      if (!allowed[key] || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  return {
    activeRows: activeRows,
    playerFolder: playerFolder,
    candidates: candidates,
    selectedKeys: selectedKeys
  };
});
