(function () {
  "use strict";

  var BP = window.ForgeBlueprintProof;
  var Importer = window.ForgeImageImporterProof;
  var ui = {};
  [
    "imageFile", "sourceReceipt", "gridPanel", "gridEvidence", "griddedControls", "ungriddedControls",
    "gridCellPx", "gridOriginX", "gridOriginY", "targetColumns", "drawGridCell", "redetectGrid", "analyzeImage",
    "paintPanel", "materialBrushes", "clearBrush", "stageTitle", "canvasShell", "emptyState",
    "canvasStack", "sourceCanvas", "overlayCanvas", "stageStatus", "sceneProfile", "sceneDetail",
    "metricGrid", "metricCells", "metricWalkable", "metricCorrected", "materialSummary",
    "cellDetail", "findingList", "enterBuild", "fatal"
  ].forEach(function (id) { ui[id] = document.getElementById(id); });

  var sourceContext = ui.sourceCanvas.getContext("2d", { willReadFrequently: true });
  var overlayContext = ui.overlayCanvas.getContext("2d");
  var state = {
    file: null,
    image: null,
    originalWidth: 0,
    originalHeight: 0,
    analysisWidth: 0,
    analysisHeight: 0,
    scale: 1,
    imageData: null,
    gridMode: "auto",
    detectedGrid: null,
    analysis: null,
    layer: "source",
    brush: null,
    selected: null,
    painting: false,
    calibrating: false,
    calibrationDrag: null
  };

  function setStatus(message) {
    ui.stageStatus.textContent = message;
  }
  function setEnabled(element, enabled) {
    element.classList.toggle("disabled", !enabled);
  }
  function nicePercent(value) {
    return Math.round((Number(value) || 0) * 100) + "%";
  }
  function safeName(name) {
    return String(name || "Interpreted artwork").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  }
  function sourceGridFromInputs() {
    var scale = state.scale || 1;
    var cellPx = Math.max(4, Number(ui.gridCellPx.value) || 100) * scale;
    var originX = Math.max(0, Number(ui.gridOriginX.value) || 0) * scale;
    var originY = Math.max(0, Number(ui.gridOriginY.value) || 0) * scale;
    return {
      found: true,
      cellPx: cellPx,
      originX: originX,
      originY: originY,
      cols: Math.max(1, Math.floor((state.analysisWidth - originX) / cellPx)),
      rows: Math.max(1, Math.floor((state.analysisHeight - originY) / cellPx)),
      confidence: state.detectedGrid && state.detectedGrid.found ? state.detectedGrid.confidence : 0.72,
      evidence: state.detectedGrid && state.detectedGrid.evidence || { manuallyCalibrated: true }
    };
  }
  function resetEvidence() {
    ui.sceneProfile.textContent = "No scene proposed";
    ui.sceneDetail.textContent = "The importer will report what it inferred and what remains uncertain.";
    ui.metricGrid.textContent = "—";
    ui.metricCells.textContent = "—";
    ui.metricWalkable.textContent = "—";
    ui.metricCorrected.textContent = "—";
    ui.materialSummary.replaceChildren();
    var materialEmpty = document.createElement("p");
    materialEmpty.textContent = "No pixel classifications yet.";
    ui.materialSummary.appendChild(materialEmpty);
    ui.findingList.replaceChildren();
    var findingEmpty = document.createElement("p");
    findingEmpty.textContent = "Interpretation findings will remain editable here.";
    ui.findingList.appendChild(findingEmpty);
    renderCellDetail();
  }
  function activeGrid() {
    if (state.gridMode === "ungridded" || (state.gridMode === "auto" && !state.detectedGrid.found)) {
      return Importer.gridFromColumns(state.analysisWidth, state.analysisHeight, Number(ui.targetColumns.value));
    }
    return sourceGridFromInputs();
  }
  function syncGridPanels() {
    var useUngrid = state.gridMode === "ungridded" || (state.gridMode === "auto" && state.detectedGrid && !state.detectedGrid.found);
    ui.griddedControls.hidden = useUngrid;
    ui.ungriddedControls.hidden = !useUngrid;
    document.querySelectorAll("[data-grid-mode]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.gridMode === state.gridMode);
    });
    renderOverlay();
  }
  function reportGrid() {
    var grid = state.detectedGrid;
    if (!grid) {
      ui.gridEvidence.textContent = "Choose artwork to inspect repeated line evidence.";
      return;
    }
    if (grid.found) {
      var originalCell = grid.cellPx / state.scale;
      ui.gridEvidence.textContent = grid.evidence && grid.evidence.manualCell
        ? "One source square set the grid to " + originalCell.toFixed(1)
          + " pixels with its drawn corner as the alignment authority."
        : "Repeated line period found at about " + originalCell.toFixed(1)
          + " source pixels · " + nicePercent(grid.confidence) + " evidence confidence. Confirm or correct it.";
      ui.gridCellPx.value = originalCell.toFixed(1);
      ui.gridOriginX.value = (grid.originX / state.scale).toFixed(1);
      ui.gridOriginY.value = (grid.originY / state.scale).toFixed(1);
    } else {
      ui.gridEvidence.textContent = "No stable repeated grid was found. Choose the intended map width; the image itself will remain unchanged.";
    }
    syncGridPanels();
  }
  function inspectGrid() {
    if (!state.imageData) return;
    setStatus("Inspecting repeated vertical and horizontal line evidence…");
    state.detectedGrid = Importer.detectGrid(
      state.imageData.data, state.analysisWidth, state.analysisHeight
    );
    reportGrid();
    setStatus(state.detectedGrid.found
      ? "A repeated square period was found. Confirm the scale, then interpret."
      : "No repeated grid was claimed. Choose an ungridded map width, then interpret.");
  }
  function drawSource(image) {
    var maxDimension = 1200;
    state.scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    state.originalWidth = image.naturalWidth;
    state.originalHeight = image.naturalHeight;
    state.analysisWidth = Math.max(1, Math.round(image.naturalWidth * state.scale));
    state.analysisHeight = Math.max(1, Math.round(image.naturalHeight * state.scale));
    [ui.sourceCanvas, ui.overlayCanvas].forEach(function (canvas) {
      canvas.width = state.analysisWidth;
      canvas.height = state.analysisHeight;
    });
    sourceContext.clearRect(0, 0, state.analysisWidth, state.analysisHeight);
    sourceContext.drawImage(image, 0, 0, state.analysisWidth, state.analysisHeight);
    state.imageData = sourceContext.getImageData(0, 0, state.analysisWidth, state.analysisHeight);
    ui.emptyState.hidden = true;
    ui.canvasStack.hidden = false;
    ui.stageTitle.textContent = safeName(state.file.name);
  }
  function loadFile(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setStatus("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        state.file = file;
        state.image = image;
        state.analysis = null;
        state.selected = null;
        resetEvidence();
        drawSource(image);
        setEnabled(ui.gridPanel, true);
        setEnabled(ui.paintPanel, false);
        ui.enterBuild.disabled = true;
        ui.sourceReceipt.replaceChildren();
        var title = document.createElement("strong");
        var detail = document.createElement("span");
        title.textContent = file.name;
        detail.textContent = image.naturalWidth + " × " + image.naturalHeight + " · local browser source";
        ui.sourceReceipt.append(title, detail);
        inspectGrid();
      };
      image.onerror = function () { setStatus("The selected image could not be decoded."); };
      image.src = reader.result;
    };
    reader.onerror = function () { setStatus("The selected image could not be read."); };
    reader.readAsDataURL(file);
  }
  function renderGridLines(context, grid) {
    if (!grid) return;
    context.save();
    context.strokeStyle = "rgba(247,222,145,.72)";
    context.lineWidth = Math.max(1, Math.min(state.analysisWidth, state.analysisHeight) / 700);
    context.beginPath();
    for (var c = 0; c <= grid.cols; c++) {
      var x = grid.originX + c * grid.cellPx;
      context.moveTo(x, grid.originY);
      context.lineTo(x, grid.originY + grid.rows * grid.cellPx);
    }
    for (var r = 0; r <= grid.rows; r++) {
      var y = grid.originY + r * grid.cellPx;
      context.moveTo(grid.originX, y);
      context.lineTo(grid.originX + grid.cols * grid.cellPx, y);
    }
    context.stroke();
    context.restore();
  }
  function confidenceColor(value) {
    var confidence = Number(value) || 0;
    if (confidence >= 0.78) return "rgba(81,164,115,.58)";
    if (confidence >= 0.6) return "rgba(218,174,79,.58)";
    return "rgba(184,87,76,.62)";
  }
  function renderOverlay() {
    overlayContext.clearRect(0, 0, state.analysisWidth, state.analysisHeight);
    var grid = state.analysis ? state.analysis.grid
      : state.imageData ? activeGrid() : null;
    if (state.analysis) {
      state.analysis.cells.forEach(function (cell) {
        var x = grid.originX + cell.c * grid.cellPx;
        var y = grid.originY + cell.r * grid.cellPx;
        if (state.layer === "materials") {
          overlayContext.fillStyle = Importer.MATERIALS[cell.material].color + "a8";
          overlayContext.fillRect(x, y, grid.cellPx + 0.5, grid.cellPx + 0.5);
        } else if (state.layer === "walkability") {
          overlayContext.fillStyle = cell.walkable ? "rgba(77,158,104,.34)" : "rgba(144,50,45,.72)";
          overlayContext.fillRect(x, y, grid.cellPx + 0.5, grid.cellPx + 0.5);
        } else if (state.layer === "confidence") {
          overlayContext.fillStyle = confidenceColor(Math.min(cell.materialConfidence, cell.featureConfidence));
          overlayContext.fillRect(x, y, grid.cellPx + 0.5, grid.cellPx + 0.5);
        }
        if (cell.corrected) {
          overlayContext.fillStyle = "rgba(255,231,154,.88)";
          overlayContext.beginPath();
          overlayContext.arc(x + grid.cellPx * .8, y + grid.cellPx * .2, Math.max(2, grid.cellPx * .08), 0, Math.PI * 2);
          overlayContext.fill();
        }
      });
    }
    renderGridLines(overlayContext, grid);
    if (state.calibrationDrag) {
      var drag = state.calibrationDrag;
      var left = Math.min(drag.startX, drag.endX), top = Math.min(drag.startY, drag.endY);
      var width = Math.abs(drag.endX - drag.startX), height = Math.abs(drag.endY - drag.startY);
      overlayContext.save();
      overlayContext.fillStyle = "rgba(212,180,95,.18)";
      overlayContext.strokeStyle = "#fff0a8";
      overlayContext.lineWidth = Math.max(2, Math.min(state.analysisWidth, state.analysisHeight) / 360);
      overlayContext.setLineDash([8, 5]);
      overlayContext.fillRect(left, top, width, height);
      overlayContext.strokeRect(left, top, width, height);
      overlayContext.restore();
    }
    if (state.selected && grid) {
      overlayContext.save();
      overlayContext.strokeStyle = "#fff0a8";
      overlayContext.lineWidth = Math.max(2, grid.cellPx * .09);
      overlayContext.strokeRect(
        grid.originX + state.selected.c * grid.cellPx,
        grid.originY + state.selected.r * grid.cellPx,
        grid.cellPx, grid.cellPx
      );
      overlayContext.restore();
    }
  }
  function buildMaterialBrushes() {
    Object.keys(Importer.MATERIALS).forEach(function (key) {
      var material = Importer.MATERIALS[key];
      var button = document.createElement("button");
      button.type = "button";
      button.dataset.material = key;
      var swatch = document.createElement("i");
      var text = document.createTextNode(material.label);
      swatch.style.background = material.color;
      button.append(swatch, text);
      button.addEventListener("click", function () {
        state.brush = { material: key };
        document.querySelectorAll("[data-material],[data-walkable]").forEach(function (item) {
          item.classList.toggle("active", item === button);
        });
        setStatus("Painting " + material.label + ". Drag across squares; source pixels remain untouched.");
      });
      ui.materialBrushes.appendChild(button);
    });
  }
  function renderCellDetail() {
    ui.cellDetail.replaceChildren();
    if (!state.analysis || !state.selected) {
      var empty = document.createElement("p");
      empty.textContent = "Click the overlay to inspect a square.";
      ui.cellDetail.appendChild(empty);
      return;
    }
    var cell = state.analysis.cells[state.selected.r * state.analysis.grid.cols + state.selected.c];
    var title = document.createElement("strong");
    var detail = document.createElement("span");
    title.textContent = "Square " + (cell.c + 1) + ", " + (cell.r + 1) + " · " + Importer.MATERIALS[cell.material].label;
    detail.textContent = cell.feature + " · " + (cell.walkable ? "walkable" : "blocked")
      + " · material " + nicePercent(cell.materialConfidence)
      + " · feature " + nicePercent(cell.featureConfidence)
      + (cell.corrected ? " · DM corrected" : "");
    ui.cellDetail.append(title, detail);
  }
  function renderEvidence() {
    if (!state.analysis) return;
    var summary = state.analysis.summary, total = Math.max(1, summary.cells);
    ui.sceneProfile.textContent = summary.scene;
    ui.sceneDetail.textContent = "A local proposal from color, texture, repeated lines, and connected pixel regions. It is evidence to edit—not semantic certainty.";
    ui.metricGrid.textContent = state.analysis.grid.cols + " × " + state.analysis.grid.rows;
    ui.metricCells.textContent = String(summary.cells);
    ui.metricWalkable.textContent = summary.walkable + " / " + summary.cells;
    ui.metricCorrected.textContent = String(summary.corrected);
    ui.materialSummary.replaceChildren();
    Object.keys(Importer.MATERIALS).forEach(function (key) {
      var count = summary.materials[key] || 0;
      if (!count) return;
      var row = document.createElement("div");
      row.className = "material-row";
      var swatch = document.createElement("i");
      var label = document.createElement("span");
      var value = document.createElement("b");
      swatch.style.background = Importer.MATERIALS[key].color;
      label.textContent = Importer.MATERIALS[key].label;
      value.textContent = Math.round(count / total * 100) + "%";
      row.append(swatch, label, value);
      ui.materialSummary.appendChild(row);
    });
    renderCellDetail();
    renderFindings();
  }
  function renderFindings() {
    ui.findingList.replaceChildren();
    var analysis = state.analysis;
    var components = Importer.connectedComponents(analysis);
    [
      {
        label: analysis.grid.manuallyCalibrated
          ? "DM-drawn source square"
          : analysis.grid.detected ? "Repeated grid evidence" : "DM-selected ungridded scale",
        detail: analysis.grid.cols + " × " + analysis.grid.rows + " squares · " + nicePercent(analysis.grid.confidence)
      },
      {
        label: "Material interpretation",
        detail: nicePercent(analysis.summary.meanConfidence) + " mean pixel confidence · repaint any square"
      },
      {
        label: "Walkability proposal",
        detail: analysis.summary.blocked + " blocked · " + analysis.summary.walkable + " open · toggle any square"
      },
      {
        label: "Playable components",
        detail: components.length === 1 ? "One connected field" : components.length + " separate components · inspect water, roofs, and dense cover"
      }
    ].forEach(function (finding) {
      var row = document.createElement("div");
      row.className = "finding";
      var title = document.createElement("strong");
      var detail = document.createElement("span");
      title.textContent = finding.label;
      detail.textContent = finding.detail;
      row.append(title, detail);
      ui.findingList.appendChild(row);
    });
  }
  function interpret() {
    if (!state.imageData) return;
    var grid = activeGrid();
    if (grid.cols * grid.rows > 6500) {
      setStatus("That scale creates more than 6,500 squares. Increase the cell size or reduce the map width.");
      return;
    }
    setStatus("Sampling each square for palette, texture, line density, water, vegetation, and dense-cover evidence…");
    state.analysis = Importer.analyze(
      state.imageData.data, state.analysisWidth, state.analysisHeight, grid
    );
    state.selected = null;
    state.layer = "materials";
    document.querySelectorAll("[data-layer]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.layer === state.layer);
    });
    setEnabled(ui.paintPanel, true);
    ui.enterBuild.disabled = !state.analysis.summary.walkable;
    renderOverlay();
    renderEvidence();
    setStatus("Interpretation ready. Compare layers, inspect uncertain squares, and paint corrections before Build.");
  }
  function canvasPoint(event) {
    var rect = ui.overlayCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * ui.overlayCanvas.width / rect.width,
      y: (event.clientY - rect.top) * ui.overlayCanvas.height / rect.height
    };
  }
  function canvasCell(event) {
    if (!state.analysis) return null;
    var point = canvasPoint(event), x = point.x, y = point.y;
    var grid = state.analysis.grid;
    var c = Math.floor((x - grid.originX) / grid.cellPx);
    var r = Math.floor((y - grid.originY) / grid.cellPx);
    return c >= 0 && r >= 0 && c < grid.cols && r < grid.rows ? { c: c, r: r } : null;
  }
  function applyPointer(event) {
    var cell = canvasCell(event);
    if (!cell) return;
    state.selected = cell;
    if (state.brush) Importer.paintCell(state.analysis, cell.c, cell.r, state.brush);
    renderOverlay();
    renderEvidence();
  }
  function invalidateInterpretationForGrid() {
    state.analysis = null;
    state.selected = null;
    state.brush = null;
    state.painting = false;
    setEnabled(ui.paintPanel, false);
    ui.enterBuild.disabled = true;
    resetEvidence();
    document.querySelectorAll("[data-material],[data-walkable]").forEach(function (button) {
      button.classList.remove("active");
    });
  }
  function setCalibrationArmed(armed) {
    state.calibrating = !!armed;
    if (!state.calibrating) state.calibrationDrag = null;
    ui.drawGridCell.classList.toggle("active", state.calibrating);
    ui.drawGridCell.setAttribute("aria-pressed", String(state.calibrating));
    ui.canvasStack.classList.toggle("calibrating", state.calibrating);
    renderOverlay();
  }
  function finishCalibration(event) {
    if (!state.calibrationDrag) return;
    var point = canvasPoint(event), drag = state.calibrationDrag;
    var grid = Importer.gridFromDrawnBox(
      state.analysisWidth, state.analysisHeight,
      drag.startX, drag.startY, point.x, point.y, 1
    );
    if (!grid) {
      state.calibrationDrag = null;
      renderOverlay();
      setStatus("That was too small to establish a square. Drag from one printed corner to the opposite corner.");
      return;
    }
    state.gridMode = "gridded";
    state.detectedGrid = grid;
    invalidateInterpretationForGrid();
    setCalibrationArmed(false);
    reportGrid();
    setStatus("Manual grid applied from one source square. Inspect the repeated overlay, then interpret.");
  }
  function storeUnderlay(key) {
    var dataUrl = ui.sourceCanvas.toDataURL("image/jpeg", 0.78);
    try {
      sessionStorage.setItem(key, dataUrl);
      return "session";
    } catch (error) {
      try {
        localStorage.setItem(key, dataUrl);
        return "local";
      } catch (fallbackError) {
        return null;
      }
    }
  }
  function enterBuild() {
    if (!state.analysis || !state.file) return;
    var base = safeName(state.file.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var blueprint = Importer.toBlueprint(state.analysis, {
      id: "interpreted-" + (base || "artwork"),
      name: safeName(state.file.name),
      sourceName: state.file.name,
      sourceRights: "User-provided licensed artwork · local proof only"
    });
    var underlayKey = "forge-import-underlay:" + blueprint.id + ":" + Date.now();
    var storage = storeUnderlay(underlayKey);
    blueprint.source.underlayKey = storage ? underlayKey : null;
    blueprint.source.underlayStorage = storage;
    blueprint.source.originalPixels = {
      width: state.originalWidth,
      height: state.originalHeight
    };
    var handoff = BP.createHandoff(blueprint, { armed: false, tool: "select" });
    setStatus(storage
      ? "Exact Blueprint and a private local underlay receipt are entering Build."
      : "Blueprint is entering Build; browser storage refused the private underlay preview.");
    window.location.href = "mock-forge-blueprint-diorama.html#handoff=" + BP.encodeHandoff(handoff);
  }

  ui.imageFile.addEventListener("change", function () { loadFile(ui.imageFile.files[0]); });
  document.querySelectorAll("[data-grid-mode]").forEach(function (button) {
    button.addEventListener("click", function () {
      setCalibrationArmed(false);
      state.gridMode = button.dataset.gridMode;
      syncGridPanels();
    });
  });
  document.querySelectorAll("[data-layer]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.layer = button.dataset.layer;
      document.querySelectorAll("[data-layer]").forEach(function (item) { item.classList.toggle("active", item === button); });
      renderOverlay();
    });
  });
  document.querySelectorAll("[data-walkable]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.brush = { walkable: button.dataset.walkable === "true" };
      document.querySelectorAll("[data-material],[data-walkable]").forEach(function (item) {
        item.classList.toggle("active", item === button);
      });
      setStatus(state.brush.walkable ? "Painting walkable squares." : "Painting blocked squares.");
    });
  });
  [ui.gridCellPx, ui.gridOriginX, ui.gridOriginY, ui.targetColumns].forEach(function (input) {
    input.addEventListener("change", function () {
      setCalibrationArmed(false);
      invalidateInterpretationForGrid();
      renderOverlay();
    });
  });
  ui.drawGridCell.addEventListener("click", function () {
    state.gridMode = "gridded";
    syncGridPanels();
    setCalibrationArmed(!state.calibrating);
    setStatus(state.calibrating
      ? "Drag one complete printed square on the artwork—from one grid corner to its opposite corner."
      : "Manual grid drawing cancelled.");
  });
  ui.redetectGrid.addEventListener("click", inspectGrid);
  ui.analyzeImage.addEventListener("click", interpret);
  ui.clearBrush.addEventListener("click", function () {
    state.brush = null;
    document.querySelectorAll("[data-material],[data-walkable]").forEach(function (button) { button.classList.remove("active"); });
    setStatus("Inspect mode. Click a square to read its evidence.");
  });
  ui.overlayCanvas.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    if (state.calibrating) {
      event.preventDefault();
      var point = canvasPoint(event);
      state.calibrationDrag = {
        startX: point.x, startY: point.y,
        endX: point.x, endY: point.y
      };
      ui.overlayCanvas.setPointerCapture && ui.overlayCanvas.setPointerCapture(event.pointerId);
      renderOverlay();
      return;
    }
    state.painting = true;
    ui.overlayCanvas.setPointerCapture && ui.overlayCanvas.setPointerCapture(event.pointerId);
    applyPointer(event);
  });
  ui.overlayCanvas.addEventListener("pointermove", function (event) {
    if (state.calibrating && state.calibrationDrag) {
      var point = canvasPoint(event);
      state.calibrationDrag.endX = point.x;
      state.calibrationDrag.endY = point.y;
      renderOverlay();
      return;
    }
    if (state.painting && state.brush) applyPointer(event);
  });
  ui.overlayCanvas.addEventListener("pointerup", function (event) {
    if (state.calibrating) {
      finishCalibration(event);
      return;
    }
    state.painting = false;
  });
  ui.overlayCanvas.addEventListener("pointercancel", function () {
    state.painting = false;
    state.calibrationDrag = null;
    renderOverlay();
  });
  ui.enterBuild.addEventListener("click", enterBuild);

  window.__imageImporterProofState = function () {
    return {
      file: state.file && state.file.name,
      original: [state.originalWidth, state.originalHeight],
      gridMode: state.gridMode,
      detectedGrid: state.detectedGrid,
      scene: state.analysis && state.analysis.summary.scene,
      materials: state.analysis && state.analysis.summary.materials,
      walkable: state.analysis && state.analysis.summary.walkable,
      blocked: state.analysis && state.analysis.summary.blocked,
      corrected: state.analysis && state.analysis.summary.corrected,
      layer: state.layer,
      calibrating: state.calibrating
    };
  };

  try {
    if (!BP || BP.SCHEMA !== "forge-blueprint/v1") throw new Error("The Blueprint proof authority did not load.");
    if (!Importer || !Importer.detectGrid) throw new Error("The local image interpreter authority did not load.");
    buildMaterialBrushes();
  } catch (error) {
    console.error(error);
    ui.fatal.textContent = "The artwork interpreter could not start: " + error.message;
    ui.fatal.classList.add("on");
  }
})();
