(function () {
  "use strict";

  var BP = window.ForgeBlueprintProof;
  var ui = {};
  [
    "stageKicker", "stageTitle", "mapCanvas", "previewKind", "previewName", "mapLegend", "stageToast",
    "candidateDeck", "templateDeck", "receiptProducer", "receiptTopology", "receiptStructure", "receiptField",
    "guideTitle", "guideCopy", "generationBrief", "generateDirections", "refineRequest", "refineDirections",
    "lockDirection", "layoutSeed", "roomDensity", "roomDensityValue", "verticality", "selectionEyebrow",
    "selectionTitle", "selectionDetail", "approveBlueprint", "templateTag", "templateName", "templateDescription",
    "useTemplate", "useSampleMap", "importCellPx", "importOriginX", "importOriginY", "interpretMap",
    "findingList", "acceptClearFindings", "createImportedBlueprint", "startBlank", "gridToggle", "handoff",
    "closeHandoff", "keepRefining", "enterBuild", "handoffSourceIcon", "handoffSource", "proofBoundary", "fatal"
  ].forEach(function (id) { ui[id] = document.getElementById(id); });

  var METHOD_COPY = {
    generate: {
      kicker: "Generated directions",
      title: "Three ways this idea could play.",
      guide: "Describe the experience.",
      copy: "A few strong choices are enough. The Forge offers different structures, not cosmetic rerolls."
    },
    template: {
      kicker: "Structural recipes",
      title: "Begin with a proven idea, then make it yours.",
      guide: "Choose the behavior first.",
      copy: "Templates preserve useful spatial intent without locking rooms, materials, or routes."
    },
    import: {
      kicker: "Assisted interpretation",
      title: "Keep the map you love. Make its structure editable.",
      guide: "Review what the Forge sees.",
      copy: "Grid, floors, walls, openings, and elevation remain visible proposals until you accept them."
    },
    blank: {
      kicker: "Direct authorship",
      title: "A clean grid with the full Forge behind it.",
      guide: "Begin with as little as you want.",
      copy: "Blank still includes the Blueprint contract, grid, undo history, and every Build tool."
    }
  };
  var TOPOLOGY_COPY = {
    processional: ["Linear procession", "Gate → nave → raised destination"],
    vault: ["Loop & hub", "Multiple routes return to a central decision"],
    warren: ["Branching exploration", "Asymmetric forks and hidden destinations"],
    "single open room": ["Open room", "A direct foothold for manual building"]
  };
  var TEMPLATE_COPY = {
    processional: ["Ruined Abbey · linear", "Processional Abbey", "A legible arrival, nave, and destination. Excellent for staged discovery and ceremonial encounters."],
    vault: ["Subterranean vault · loop", "Loop & Hub Vault", "A central decision point with alternate routes, return paths, and strong flanking potential."],
    warren: ["Ancient undercroft · branching", "Branching Warren", "An asymmetric exploration structure with forks, optional chambers, and pressure from incomplete information."]
  };
  var state = {
    method: "generate",
    layer: "blueprint",
    grid: true,
    seed: 1847,
    shape: "surprise",
    size: "medium",
    candidates: [],
    candidateIndex: 0,
    lockedBlueprint: null,
    blueprint: null,
    template: "processional",
    importInterpreted: false,
    blankStart: "room",
    toastTimer: null
  };

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function topologyKey(blueprint) {
    if (!blueprint) return "processional";
    if (/loop|hub/i.test(blueprint.topology)) return "vault";
    if (/branch|tree/i.test(blueprint.topology)) return "warren";
    if (/single|open room/i.test(blueprint.topology)) return "single open room";
    return "processional";
  }
  function sourceLabel(blueprint) {
    var kind = blueprint && blueprint.source && blueprint.source.kind;
    return BP.PRODUCER_LABELS[kind] || "Blueprint producer";
  }
  function compileStatus(blueprint) {
    var field = BP.compile(blueprint, {});
    var valid = BP.validateMap(field);
    var connected = BP.connectivity(field);
    return { field: field, valid: valid.ok, connected: connected.ok };
  }
  function showToast(message) {
    ui.stageToast.textContent = message;
    ui.stageToast.classList.add("on");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { ui.stageToast.classList.remove("on"); }, 1800);
  }
  function setJourney(step) {
    var order = ["source", "directions", "blueprint", "build"];
    var target = order.indexOf(step);
    document.querySelectorAll("[data-journey]").forEach(function (button) {
      var at = order.indexOf(button.dataset.journey);
      button.classList.toggle("active", at === target);
      button.classList.toggle("done", at < target);
    });
  }
  function setChoice(group, value) {
    document.querySelectorAll('[data-choice-group="' + group + '"] button').forEach(function (button) {
      button.classList.toggle("active", button.dataset.value === value);
    });
    if (group === "shape") state.shape = value;
    if (group === "size") state.size = value;
  }
  function makeCandidates() {
    var keys = ["processional", "vault", "warren"];
    var chosen = state.shape === "surprise" ? keys : [state.shape].concat(keys.filter(function (key) { return key !== state.shape; }));
    var next = chosen.slice(0, 3).map(function (topology, index) {
      return BP.produceSeeded({ seed: state.seed + index, topology: topology });
    });
    if (state.lockedBlueprint) next[0] = copy(state.lockedBlueprint);
    state.candidates = next;
    state.candidateIndex = 0;
    state.blueprint = state.candidates[0];
    renderCandidateDeck();
    renderBlueprint();
    setJourney("directions");
  }
  function renderCandidateDeck() {
    ui.candidateDeck.innerHTML = "";
    state.candidates.forEach(function (blueprint, index) {
      var key = topologyKey(blueprint);
      var copyText = TOPOLOGY_COPY[key] || [blueprint.topology, "Editable Blueprint"];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "candidate-card" + (index === state.candidateIndex ? " active" : "");
      button.dataset.candidate = String(index);
      button.innerHTML = '<canvas width="240" height="112"></canvas><span><b>' + copyText[0]
        + (state.lockedBlueprint && index === 0 ? '<em class="kept">Kept</em>' : "")
        + '</b><small>' + copyText[1] + "</small></span>";
      button.addEventListener("click", function () {
        state.candidateIndex = index;
        state.blueprint = state.candidates[index];
        renderCandidateDeck();
        renderBlueprint();
      });
      ui.candidateDeck.appendChild(button);
      drawBlueprint(button.querySelector("canvas"), blueprint, { thumbnail: true });
    });
  }
  function drawTemplates() {
    document.querySelectorAll("[data-template] canvas").forEach(function (canvas) {
      drawBlueprint(canvas, BP.FIXTURES[canvas.closest("[data-template]").dataset.template], { thumbnail: true });
    });
  }
  function materialColor(material) {
    return {
      nave: "#8a826c", cloister: "#68775f", crypt: "#5d5c5a", timber: "#6e553e", water: "#3f6e73"
    }[material] || "#777568";
  }
  function drawSourceArtwork(ctx, width, height) {
    ctx.fillStyle = "#c8b991"; ctx.fillRect(0, 0, width, height);
    var wash = ctx.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, "rgba(83,97,67,.38)"); wash.addColorStop(.55, "rgba(181,148,94,.12)"); wash.addColorStop(1, "rgba(61,72,58,.45)");
    ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(62,51,37,.32)"; ctx.lineWidth = 2;
    for (var i = -height; i < width; i += 18) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke(); }
  }
  function drawBlueprint(canvas, blueprint, options) {
    if (!canvas || !blueprint) return;
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(160, Math.round(options && options.thumbnail ? canvas.width : rect.width || 640));
    var height = Math.max(90, Math.round(options && options.thumbnail ? canvas.height : rect.height || 420));
    var dpr = options && options.thumbnail ? 1 : Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (state.method === "import" && state.layer === "source") drawSourceArtwork(ctx, width, height);
    else { ctx.fillStyle = "#0c1210"; ctx.fillRect(0, 0, width, height); }

    var field = BP.compile(blueprint, {});
    var pad = options && options.thumbnail ? 7 : 24;
    var cell = Math.min((width - pad * 2) / field.cols, (height - pad * 2) / field.rows);
    var ox = (width - field.cols * cell) / 2, oy = (height - field.rows * cell) / 2;
    for (var r = 0; r < field.rows; r++) for (var c = 0; c < field.cols; c++) {
      var index = BP.idx(field.cols, c, r);
      if (field.wall[index]) continue;
      var region = field.meta.regions[index] || {};
      ctx.fillStyle = state.method === "import" && state.layer === "source"
        ? "rgba(221,205,163,.22)" : materialColor(region.material);
      ctx.fillRect(ox + c * cell, oy + r * cell, cell + .4, cell + .4);
      if (state.grid && !(options && options.thumbnail)) {
        ctx.strokeStyle = state.method === "import" && state.layer === "source" ? "rgba(82,64,42,.3)" : "rgba(12,18,16,.5)";
        ctx.lineWidth = 1; ctx.strokeRect(ox + c * cell, oy + r * cell, cell, cell);
      }
    }
    var regions = BP.cellRegions(blueprint);
    ctx.strokeStyle = state.method === "import" ? "rgba(221,182,92,.92)" : "#bda66d";
    ctx.lineWidth = Math.max(1, cell * .12);
    for (var rr = 0; rr < field.rows; rr++) for (var cc = 0; cc < field.cols; cc++) {
      var at = BP.idx(field.cols, cc, rr);
      if (!regions[at]) continue;
      [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]].forEach(function (edge) {
        var nc = cc + edge[1], nr = rr + edge[2];
        var neighbor = nc >= 0 && nr >= 0 && nc < field.cols && nr < field.rows ? regions[BP.idx(field.cols, nc, nr)] : null;
        if (neighbor) return;
        ctx.beginPath();
        if (edge[0] === "N") { ctx.moveTo(ox + cc * cell, oy + rr * cell); ctx.lineTo(ox + (cc + 1) * cell, oy + rr * cell); }
        if (edge[0] === "E") { ctx.moveTo(ox + (cc + 1) * cell, oy + rr * cell); ctx.lineTo(ox + (cc + 1) * cell, oy + (rr + 1) * cell); }
        if (edge[0] === "S") { ctx.moveTo(ox + cc * cell, oy + (rr + 1) * cell); ctx.lineTo(ox + (cc + 1) * cell, oy + (rr + 1) * cell); }
        if (edge[0] === "W") { ctx.moveTo(ox + cc * cell, oy + rr * cell); ctx.lineTo(ox + cc * cell, oy + (rr + 1) * cell); }
        ctx.stroke();
      });
    }
    (blueprint.props || []).forEach(function (prop) {
      ctx.fillStyle = prop.kind === "pool" ? "#4d7d83" : prop.kind === "brazier" ? "#d18a4e" : "#3c423e";
      ctx.beginPath(); ctx.arc(ox + (prop.c + .5) * cell, oy + (prop.r + .5) * cell, Math.max(2, cell * .22), 0, Math.PI * 2); ctx.fill();
    });
    if (state.method === "import" && state.importInterpreted && !(options && options.thumbnail)) {
      ctx.setLineDash([6, 5]); ctx.strokeStyle = "#c96f5c"; ctx.lineWidth = 2;
      ctx.strokeRect(ox + 18 * cell, oy + 5 * cell, 4 * cell, 3 * cell); ctx.setLineDash([]);
    }
  }
  function renderReceipt() {
    var status = compileStatus(state.blueprint);
    var topology = topologyKey(state.blueprint);
    var topologyText = TOPOLOGY_COPY[topology] || [state.blueprint.topology];
    ui.receiptProducer.textContent = sourceLabel(state.blueprint);
    ui.receiptTopology.textContent = topologyText[0];
    ui.receiptStructure.textContent = state.blueprint.spaces.length + " rooms · " + state.blueprint.corridors.length + " passages";
    ui.receiptField.textContent = status.valid && status.connected ? "Connected · valid" : "Needs review";
    ui.selectionTitle.textContent = state.blueprint.name.replace(/ · Seed \d+$/, "");
    ui.selectionDetail.textContent = status.valid && status.connected ? "Everything remains editable." : "Review the highlighted findings first.";
    ui.approveBlueprint.disabled = !(status.valid && status.connected) || (state.method === "import" && !allImportAccepted());
  }
  function renderBlueprint() {
    var kind = state.blueprint && state.blueprint.source && state.blueprint.source.kind;
    ui.previewKind.textContent = BP.PRODUCER_LABELS[kind] || "Blueprint";
    ui.previewName.textContent = state.blueprint.name.replace(/ · Seed \d+$/, "");
    drawBlueprint(ui.mapCanvas, state.blueprint, {});
    renderReceipt();
    document.querySelectorAll("[data-layer]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.layer === state.layer);
    });
    ui.gridToggle.classList.toggle("active", state.grid);
    ui.gridToggle.setAttribute("aria-pressed", String(state.grid));
  }
  function setMethod(method) {
    if (!METHOD_COPY[method]) return;
    state.method = method;
    document.querySelectorAll("[data-method]").forEach(function (button) { button.classList.toggle("active", button.dataset.method === method); });
    document.querySelectorAll("[data-method-panel]").forEach(function (panel) {
      var active = panel.dataset.methodPanel === method; panel.hidden = !active; panel.classList.toggle("active", active);
    });
    var copyText = METHOD_COPY[method];
    ui.stageKicker.textContent = copyText.kicker; ui.stageTitle.textContent = copyText.title;
    ui.guideTitle.textContent = copyText.guide; ui.guideCopy.textContent = copyText.copy;
    ui.candidateDeck.hidden = method !== "generate";
    ui.templateDeck.hidden = method !== "template";
    state.layer = method === "import" ? "source" : "blueprint";
    if (method === "generate") state.blueprint = state.candidates[state.candidateIndex];
    if (method === "template") state.blueprint = BP.withSource(BP.FIXTURES[state.template], "fixture", { fixtureKey: state.template, deterministic: true });
    if (method === "import") state.blueprint = BP.produceImportedSample();
    if (method === "blank") state.blueprint = BP.produceBlank();
    ui.selectionEyebrow.textContent = method === "generate" ? "Selected direction" : method === "template" ? "Selected template" : method === "import" ? "Interpreted proposal" : "Blank starting point";
    setJourney("source");
    if (method === "import") renderImportFindings();
    renderBlueprint();
  }
  function selectTemplate(key) {
    state.template = key;
    var copyText = TEMPLATE_COPY[key];
    document.querySelectorAll("[data-template]").forEach(function (button) { button.classList.toggle("active", button.dataset.template === key); });
    ui.templateTag.textContent = copyText[0]; ui.templateName.textContent = copyText[1]; ui.templateDescription.textContent = copyText[2];
    state.blueprint = BP.withSource(BP.FIXTURES[key], "fixture", { fixtureKey: key, deterministic: true });
    renderBlueprint();
  }
  function importFindings() {
    return state.blueprint && state.blueprint.source && state.blueprint.source.review || [];
  }
  function allImportAccepted() { return importFindings().length > 0 && importFindings().every(function (finding) { return finding.accepted; }); }
  function renderImportFindings() {
    ui.findingList.innerHTML = "";
    importFindings().forEach(function (finding) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "finding" + (finding.accepted ? " accepted" : "") + (finding.confidence < .75 ? " uncertain" : "");
      button.dataset.finding = finding.id;
      button.innerHTML = "<b>" + (finding.accepted ? "✓" : finding.confidence < .75 ? "?" : "◇") + "</b><span><strong>"
        + finding.label + "</strong><small>" + (finding.confidence >= .85 ? "Clear interpretation" : finding.confidence >= .7 ? "Check opening placement" : "DM decision requested")
        + "</small></span><em>" + Math.round(finding.confidence * 100) + "%</em>";
      button.addEventListener("click", function () {
        state.blueprint = BP.acceptImportFinding(state.blueprint, finding.id);
        renderImportFindings(); renderBlueprint();
      });
      ui.findingList.appendChild(button);
    });
    ui.createImportedBlueprint.disabled = !allImportAccepted();
  }
  function interpretImport() {
    state.importInterpreted = true;
    document.querySelectorAll(".import-steps li").forEach(function (item, index) {
      item.classList.toggle("done", index < 3); item.classList.toggle("active", index === 3);
    });
    renderImportFindings(); renderBlueprint(); setJourney("directions");
    showToast("Interpretation overlaid. Nothing has been accepted silently.");
  }
  function openHandoff() {
    if (ui.approveBlueprint.disabled) return;
    setJourney("blueprint");
    var labels = { generate: ["✦", "Generate"], template: ["▦", "Template"], import: ["◫", "Imported image"], blank: ["□", "Blank map"] };
    ui.handoffSourceIcon.textContent = labels[state.method][0]; ui.handoffSource.textContent = labels[state.method][1];
    ui.handoff.hidden = false;
  }

  document.querySelectorAll("[data-method]").forEach(function (button) {
    button.addEventListener("click", function () { setMethod(button.dataset.method); });
  });
  document.querySelectorAll("[data-choice-group] button").forEach(function (button) {
    button.addEventListener("click", function () {
      var group = button.closest("[data-choice-group]").dataset.choiceGroup;
      document.querySelectorAll('[data-choice-group="' + group + '"] button').forEach(function (item) { item.classList.toggle("active", item === button); });
      if (group === "shape") state.shape = button.dataset.value;
      if (group === "size") state.size = button.dataset.value;
    });
  });
  document.querySelectorAll("[data-layer]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (state.method !== "import" && button.dataset.layer === "source") { showToast("Source comparison is available for imported artwork."); return; }
      state.layer = button.dataset.layer; renderBlueprint();
    });
  });
  document.querySelectorAll("[data-template]").forEach(function (button) {
    button.addEventListener("click", function () { selectTemplate(button.dataset.template); });
  });
  document.querySelectorAll("[data-blank-start]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.blankStart = button.dataset.blankStart;
      document.querySelectorAll("[data-blank-start]").forEach(function (item) { item.classList.toggle("active", item === button); });
      ui.selectionDetail.textContent = state.blankStart === "empty" ? "The first action will be drawing a room." : "One room is ready to reshape.";
    });
  });
  ui.generateDirections.addEventListener("click", function () {
    state.seed = Math.abs(parseInt(ui.layoutSeed.value, 10) || 1847);
    makeCandidates(); showToast("Three structural directions created.");
  });
  ui.refineDirections.addEventListener("click", function () {
    state.seed += 17; ui.layoutSeed.value = String(state.seed); makeCandidates();
    showToast(ui.refineRequest.value.trim() ? "Refined around: " + ui.refineRequest.value.trim() : "Three fresh directions created.");
  });
  ui.lockDirection.addEventListener("click", function () {
    state.lockedBlueprint = state.lockedBlueprint ? null : copy(state.blueprint);
    ui.lockDirection.classList.toggle("active", !!state.lockedBlueprint);
    ui.lockDirection.setAttribute("aria-pressed", String(!!state.lockedBlueprint));
    ui.lockDirection.querySelector("b").textContent = state.lockedBlueprint ? "◆" : "◇";
    ui.lockDirection.querySelector("strong").textContent = state.lockedBlueprint ? "Layout kept" : "Keep this layout";
    renderCandidateDeck();
  });
  ui.roomDensity.addEventListener("input", function () { ui.roomDensityValue.textContent = ui.roomDensity.value; });
  ui.useTemplate.addEventListener("click", function () { setJourney("directions"); showToast("Template copied into an editable Blueprint."); });
  ui.useSampleMap.addEventListener("click", function () { state.blueprint = BP.produceImportedSample(); state.importInterpreted = false; renderImportFindings(); renderBlueprint(); });
  ui.interpretMap.addEventListener("click", interpretImport);
  ui.acceptClearFindings.addEventListener("click", function () {
    importFindings().filter(function (finding) { return finding.confidence >= .75; }).forEach(function (finding) {
      state.blueprint = BP.acceptImportFinding(state.blueprint, finding.id);
    });
    renderImportFindings(); renderBlueprint(); showToast("Clear findings accepted. Uncertain choices remain visible.");
  });
  ui.createImportedBlueprint.addEventListener("click", function () { setJourney("blueprint"); showToast("Interpretation compiled to forge-blueprint/v1."); });
  [ui.importCellPx, ui.importOriginX, ui.importOriginY].forEach(function (input) {
    input.addEventListener("change", function () {
      var calibration = BP.normalizeGridCalibration({
        cellPx: Number(ui.importCellPx.value), originX: Number(ui.importOriginX.value), originY: Number(ui.importOriginY.value),
        nativeW: 784, nativeH: 560
      });
      showToast("Grid calibrated · " + calibration.cols + " × " + calibration.rows + " visible squares");
      renderBlueprint();
    });
  });
  ui.startBlank.addEventListener("click", function () {
    state.blueprint = BP.produceBlank(); setJourney("blueprint");
    showToast("Open room ready to reshape.");
    renderBlueprint();
  });
  ui.gridToggle.addEventListener("click", function () { state.grid = !state.grid; renderBlueprint(); });
  ui.approveBlueprint.addEventListener("click", openHandoff);
  ui.closeHandoff.addEventListener("click", function () { ui.handoff.hidden = true; });
  ui.keepRefining.addEventListener("click", function () { ui.handoff.hidden = true; setJourney("directions"); });
  ui.enterBuild.addEventListener("click", function () {
    setJourney("build");
    ui.proofBoundary.textContent = "Handoff proven: Build receives the same Blueprint. Production integration remains outside this mock.";
    ui.enterBuild.textContent = "Build handoff confirmed ✓";
    ui.enterBuild.disabled = true;
  });
  window.addEventListener("resize", function () { renderBlueprint(); });

  try {
    if (!BP || BP.SCHEMA !== "forge-blueprint/v1") throw new Error("The Blueprint proof authority did not load.");
    makeCandidates();
    drawTemplates();
    setChoice("shape", "surprise");
    setChoice("size", "medium");
    setMethod("generate");
  } catch (error) {
    console.error(error);
    ui.fatal.textContent = "The creation-flow proof could not start: " + error.message;
    ui.fatal.classList.add("on");
  }
})();
