/* ── icon-picker.js ─────────────────────────────────────────────────────
   Shared icon-picker widget. Extracted from gear-manager's proven pattern.
   Hosts: the forge detail drawer and the sheet action editor.
   Owns NO storage — fires a callback with the glyph name; the host
   decides where the pick lands (inline `icon` vs `iconOverrides`).

   Usage:
     var picker = IconPicker.create({
       current:    'fire-bolt',          // currently selected glyph (or null)
       registries: ['spell', 'item'],    // which registries to show ('spell' first)
       onPick:     function(name) { … }, // callback with the chosen glyph name
       onClose:    function() { … }      // optional: called when the picker closes
     });
     someContainer.appendChild(picker);
     // or:
     IconPicker.toggle(hostElement, opts); // toggle inline below a host element

   The widget renders a grouped grid of all glyphs from the named registries.
   Spell groups listed first when editing a spell/feature tile, item groups
   first for weapons/items.                                                  */
(function () {
  "use strict";

  var CSS_INJECTED = false;
  var PICKER_CSS = '\
.fg-picker{background:var(--hud-bg,#0d0d14);border:1px solid var(--hud-line,#1a1a28);max-height:280px;overflow-y:auto;padding:4px}\n\
.fg-picker-group{padding:4px 8px}\n\
.fg-picker-label{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;\
color:var(--hud-dim2,#444);margin:6px 0 4px;font-family:"Barlow Condensed",system-ui}\n\
.fg-picker-grid{display:flex;flex-wrap:wrap;gap:4px}\n\
.fg-picker-cell{width:36px;height:36px;display:flex;align-items:center;justify-content:center;\
border:1px solid var(--hud-line,#1a1a28);background:var(--hud-bg2,#111018);cursor:pointer;transition:.12s}\n\
.fg-picker-cell:hover{border-color:var(--hud-dim,#555)}\n\
.fg-picker-cell.sel{outline:2px solid var(--hud-gold,#b8952a)}\n\
.fg-picker-cell svg{fill:var(--hud-fg,#f0ece4)}\n\
';

  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement("style");
    style.id = "fg-picker-css";
    style.textContent = PICKER_CSS;
    document.head.appendChild(style);
  }

  /* Resolve which registries to use and in what order. */
  function getRegistries(order) {
    var regs = [];
    (order || ["spell", "item"]).forEach(function (r) {
      if (r === "spell" && window.SpellIcons) regs.push({ key: "spell", reg: window.SpellIcons });
      if (r === "item" && window.ItemIcons) regs.push({ key: "item", reg: window.ItemIcons });
    });
    // Ensure both are present even if not explicitly listed
    if (window.SpellIcons && !regs.some(function (r) { return r.key === "spell"; }))
      regs.push({ key: "spell", reg: window.SpellIcons });
    if (window.ItemIcons && !regs.some(function (r) { return r.key === "item"; }))
      regs.push({ key: "item", reg: window.ItemIcons });
    return regs;
  }

  /* Build the picker DOM element. */
  function create(opts) {
    injectCSS();
    opts = opts || {};
    var current = opts.current || null;
    var onPick = opts.onPick || function () {};
    var regs = getRegistries(opts.registries);

    var container = document.createElement("div");
    container.className = "fg-picker";

    regs.forEach(function (r) {
      var cats = r.reg.CATEGORIES || {};
      Object.keys(cats).forEach(function (catKey) {
        var names = cats[catKey] || [];
        if (!names.length) return;

        var group = document.createElement("div");
        group.className = "fg-picker-group";
        var label = document.createElement("div");
        label.className = "fg-picker-label";
        label.textContent = catKey.replace(/_/g, " ");
        group.appendChild(label);

        var grid = document.createElement("div");
        grid.className = "fg-picker-grid";
        names.forEach(function (name) {
          var cell = document.createElement("div");
          cell.className = "fg-picker-cell" + (name === current ? " sel" : "");
          cell.title = name;
          cell.innerHTML = r.reg.iconSvg(name, 24);
          cell.addEventListener("click", function (e) {
            e.stopPropagation();
            // Deselect previous
            container.querySelectorAll(".fg-picker-cell.sel").forEach(function (c) { c.classList.remove("sel"); });
            cell.classList.add("sel");
            current = name;
            onPick(name);
          });
          grid.appendChild(cell);
        });
        group.appendChild(grid);
        container.appendChild(group);
      });
    });

    return container;
  }

  /* Toggle picker inline below a host element. */
  var _activePicker = null;
  function toggle(hostEl, opts) {
    injectCSS();
    // Close existing
    if (_activePicker) {
      _activePicker.remove();
      _activePicker = null;
      if (opts && opts.onClose) opts.onClose();
      return;
    }
    var picker = create(opts);
    _activePicker = picker;
    // Insert after the host
    if (hostEl.nextSibling) hostEl.parentNode.insertBefore(picker, hostEl.nextSibling);
    else hostEl.parentNode.appendChild(picker);
    // Close on outside click
    var closer = function (e) {
      if (!picker.contains(e.target) && e.target !== hostEl) {
        picker.remove();
        _activePicker = null;
        document.removeEventListener("click", closer);
        if (opts && opts.onClose) opts.onClose();
      }
    };
    // Defer so the current click doesn't immediately close
    setTimeout(function () { document.addEventListener("click", closer); }, 0);
  }

  /* Close any open picker. */
  function close() {
    if (_activePicker) { _activePicker.remove(); _activePicker = null; }
  }

  window.IconPicker = { create: create, toggle: toggle, close: close };
})();
