(function () {
  "use strict";

  var Importer = window.ForgeImageImporterProof;
  var Structure = window.ForgeImageStructureReviewProof;
  var ui = {};
  [
    "imageFile", "sourceReceipt", "scalePanel", "autoGrid", "drawGridCell", "noGrid", "gridNote",
    "griddedControls", "ungriddedControls", "gridCellPx", "gridOriginX", "gridOriginY", "targetColumns",
    "proposeRegions", "selectionPanel", "magicTolerance", "magicToleranceValue", "colorAssist", "armedKit",
    "pendingSwatch", "pendingMeaning", "undoDraw", "redoDraw",
    "verifyGrid", "gridCoverage", "zoomOut", "zoomFit", "zoomIn", "zoomValue", "toggleGrid",
    "typePalette", "closeTypePalette", "typePaletteKinds", "typePaletteVariants",
    "artTitle", "viewGrid", "artView", "previewView",
    "emptyState", "canvasStack", "sourceCanvas", "overlayCanvas", "previewCanvas", "status",
    "sceneName", "metricGrid", "metricRegions", "metricSurfaces", "metricConnectors", "typeSummary",
    "authoredCount", "authoredList",
    "inspector", "regionName", "regionReceipt", "regionType", "regionLabel", "regionBase", "regionTop",
    "regionWalkable", "regionAccess", "regionSupport", "regionAppearance", "applyRegion", "regionToSelection", "heightReceipt",
    "movementNote", "surfaceReceipt", "reviewJson", "fatal"
  ].forEach(function (id) { ui[id] = document.getElementById(id); });

  var sourceContext = ui.sourceCanvas.getContext("2d", { willReadFrequently: true });
  var overlayContext = ui.overlayCanvas.getContext("2d");
  var previewContext = ui.previewCanvas.getContext("2d");
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
    review: null,
    selectionTool: "pointer",
    semanticType: "building",
    semanticAppearance: "timber-house",
    selection: null,
    magicFence: null,
    editingRegionId: null,
    selectedId: null,
    editAddRegionId: null,
    calibrating: false,
    verifyingGrid: false,
    gridAnchor: null,
    gridVisible: true,
    gridVerified: false,
    drag: null,
    lassoPoints: null,
    panDrag: null,
    zoom: 1,
    undoStack: [],
    redoStack: [],
    view: "artwork"
  };

  function setStatus(message) {
    ui.status.textContent = message;
  }
  function setEnabled(element, enabled) {
    element.classList.toggle("disabled", !enabled);
  }
  function safeName(name) {
    return String(name || "Structure review").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  }
  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }
  function appearanceFor(type, appearanceId) {
    return Structure.appearanceFor(type, appearanceId);
  }
  function fillAppearanceOptions(select, type, selectedId) {
    select.replaceChildren();
    if (type === "ground") {
      var ground = document.createElement("option");
      ground.value = "ground"; ground.textContent = "Base ground / erase"; select.appendChild(ground);
      select.disabled = true;
      return "ground";
    }
    select.disabled = false;
    (Structure.APPEARANCES[type] || []).forEach(function (appearance) {
      var option = document.createElement("option");
      option.value = appearance.id; option.textContent = appearance.label; select.appendChild(option);
    });
    var selected = appearanceFor(type, selectedId).id;
    select.value = selected;
    return selected;
  }
  function syncPendingAppearance() {
    state.semanticAppearance = state.semanticType === "ground" ? "ground" : appearanceFor(state.semanticType, state.semanticAppearance).id;
    var appearance = state.semanticType === "ground"
      ? { label: "Base ground / erase", color: "#857958" }
      : appearanceFor(state.semanticType, state.semanticAppearance);
    ui.pendingSwatch.style.background = appearance.color;
    ui.pendingMeaning.textContent = (state.semanticType === "ground" ? "Ground / erase" : Structure.TYPES[state.semanticType].label)
      + " · " + appearance.label;
  }
  function sourceGridFromInputs() {
    var scale = state.scale || 1;
    var cellPx = Math.max(4, Number(ui.gridCellPx.value) || 70) * scale;
    var phaseX = (Number(ui.gridOriginX.value) || 0) * scale;
    var phaseY = (Number(ui.gridOriginY.value) || 0) * scale;
    return Structure.gridCoveringArtwork(state.analysisWidth, state.analysisHeight, cellPx, phaseX, phaseY,
      Object.assign({}, state.detectedGrid && state.detectedGrid.evidence || { manualInputs: true }, {
        farPointChecked: state.gridVerified
      }));
  }
  function activeGrid() {
    if (!state.imageData) return null;
    if (state.gridMode === "ungridded") {
      return Importer.gridFromColumns(state.analysisWidth, state.analysisHeight, Number(ui.targetColumns.value));
    }
    return sourceGridFromInputs();
  }
  function clearReview() {
    state.analysis = null;
    state.review = null;
    state.selection = null;
    state.magicFence = null;
    state.editingRegionId = null;
    state.editAddRegionId = null;
    state.selectedId = null;
    setEnabled(ui.selectionPanel, false);
    setEnabled(ui.inspector, false);
    state.undoStack = []; state.redoStack = [];
    updateHistoryControls();
    renderAll();
  }
  function gridCoverageText(grid) {
    if (!grid) return "No grid coverage.";
    var left = Math.max(0, -grid.originX), top = Math.max(0, -grid.originY);
    var right = Math.max(0, grid.originX + grid.cols * grid.cellPx - state.analysisWidth);
    var bottom = Math.max(0, grid.originY + grid.rows * grid.cellPx - state.analysisHeight);
    var partials = [left, right, top, bottom].filter(function (value) { return value > 0.25; }).length;
    return grid.cols + " × " + grid.rows + " cells across the full artwork"
      + (partials ? " · " + partials + " partial edge" + (partials === 1 ? "" : "s") : " · exact edge coverage");
  }
  function updateGridReceipt() {
    var grid = activeGrid();
    ui.gridCoverage.textContent = gridCoverageText(grid);
    ui.toggleGrid.textContent = state.gridVisible ? "# Grid on" : "# Grid off";
    ui.toggleGrid.classList.toggle("active", state.gridVisible);
  }
  function syncGridControls() {
    ui.griddedControls.hidden = state.gridMode === "ungridded";
    ui.ungriddedControls.hidden = state.gridMode !== "ungridded";
    ui.autoGrid.classList.toggle("active", state.gridMode === "auto" && !state.calibrating);
    ui.drawGridCell.classList.toggle("active", state.calibrating || state.gridMode === "gridded");
    ui.drawGridCell.setAttribute("aria-pressed", String(state.calibrating));
    ui.noGrid.classList.toggle("active", state.gridMode === "ungridded");
    ui.canvasStack.classList.toggle("calibrating", state.calibrating);
    ui.canvasStack.classList.toggle("inspecting", !state.calibrating && state.selectionTool === "pointer");
    ui.canvasStack.classList.toggle("magic-selecting", !state.calibrating && state.selectionTool === "magic");
    ui.canvasStack.classList.toggle("lasso-selecting", !state.calibrating && state.selectionTool === "lasso");
    ui.canvasStack.classList.toggle("erasing", !state.calibrating && state.selectionTool === "eraser");
    ui.canvasStack.classList.toggle("panning", !state.calibrating && state.selectionTool === "pan");
    ui.verifyGrid.hidden = !(state.gridMode === "gridded" && state.gridAnchor && !state.gridVerified);
    updateGridReceipt();
    renderOverlay();
  }
  function reportDetectedGrid(grid) {
    if (!grid || !grid.found) {
      ui.gridNote.textContent = "No stable repeated grid was found. Choose No grid or draw one printed square.";
      return;
    }
    var originalCell = grid.cellPx / state.scale;
    ui.gridCellPx.value = originalCell.toFixed(1);
    ui.gridOriginX.value = (grid.originX / state.scale).toFixed(1);
    ui.gridOriginY.value = (grid.originY / state.scale).toFixed(1);
    var manual = grid.evidence && grid.evidence.manualCell;
    ui.gridNote.className = "grid-note " + (manual ? "good" : "warn");
    ui.gridNote.textContent = manual
      ? "Locally calibrated: " + originalCell.toFixed(1) + " source pixels. Check a distant intersection to catch accumulated drift."
      : "Auto—unverified: " + originalCell.toFixed(1) + " source pixels. Do not trace against this overlay until it matches the printed grid.";
    updateGridReceipt();
  }
  function inspectGrid() {
    if (!state.imageData) return;
    state.gridMode = "auto";
    state.calibrating = false;
    state.verifyingGrid = false;
    state.gridAnchor = null;
    state.gridVerified = false;
    state.detectedGrid = Importer.detectGrid(state.imageData.data, state.analysisWidth, state.analysisHeight);
    reportDetectedGrid(state.detectedGrid);
    clearReview();
    syncGridControls();
    setStatus(state.detectedGrid.found
      ? "Auto proposed a repeated period. Draw one real square whenever the overlay drifts."
      : "Auto declined to claim a grid. Draw one real square or choose an ungridded width.");
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
    ui.artTitle.textContent = safeName(state.file.name);
    fitArtwork();
  }
  function fitArtwork() {
    if (!state.analysisWidth) return;
    var available = Math.max(240, ui.artView.clientWidth - 32);
    state.zoom = Math.min(1, available / state.analysisWidth);
    applyZoom();
    ui.artView.scrollLeft = 0; ui.artView.scrollTop = 0;
  }
  function applyZoom() {
    if (!state.analysisWidth) return;
    state.zoom = clamp(state.zoom, 0.2, 5);
    ui.canvasStack.style.width = Math.round(state.analysisWidth * state.zoom) + "px";
    ui.zoomValue.textContent = Math.round(state.zoom * 100) + "%";
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
        state.detectedGrid = null;
        state.gridMode = "auto";
        state.calibrating = false;
        state.verifyingGrid = false;
        state.gridAnchor = null;
        state.gridVerified = false;
        state.gridVisible = false;
        drawSource(image);
        clearReview();
        setEnabled(ui.scalePanel, true);
        ui.sourceReceipt.replaceChildren();
        var title = document.createElement("strong"), detail = document.createElement("span");
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
  function renderGrid(context, grid) {
    if (!grid) return;
    context.save();
    context.strokeStyle = "rgba(247,222,145,.58)";
    context.lineWidth = Math.max(1, Math.min(state.analysisWidth, state.analysisHeight) / 760);
    context.beginPath();
    for (var c = 0; c <= grid.cols; c++) {
      var x = grid.originX + c * grid.cellPx;
      context.moveTo(x, 0);
      context.lineTo(x, state.analysisHeight);
    }
    for (var r = 0; r <= grid.rows; r++) {
      var y = grid.originY + r * grid.cellPx;
      context.moveTo(0, y);
      context.lineTo(state.analysisWidth, y);
    }
    context.stroke();
    context.restore();
  }
  function traceFootprint(context, footprint) {
    if (!footprint) return;
    if (footprint.kind === "polygon" && footprint.points && footprint.points.length > 2) {
      context.beginPath();
      context.moveTo(footprint.points[0][0], footprint.points[0][1]);
      footprint.points.slice(1).forEach(function (point) { context.lineTo(point[0], point[1]); });
      context.closePath(); context.stroke();
      return;
    }
    if (footprint.kind === "composite") {
      footprint.parts.forEach(function (part) { traceFootprint(context, part.footprint); });
    }
    if (footprint.kind === "magic-within") traceFootprint(context, footprint.fence);
  }
  function overlayLabel(context, cells, grid, label, color) {
    if (!cells || !cells.length) return;
    var total = cells.reduce(function (sum, cell) { return { c: sum.c + cell[0], r: sum.r + cell[1] }; }, { c: 0, r: 0 });
    var c = total.c / cells.length, r = total.r / cells.length;
    var x = grid.originX + (c + 0.5) * grid.cellPx, y = grid.originY + (r + 0.5) * grid.cellPx;
    var fontSize = Math.max(8, Math.min(18, grid.cellPx * 0.48));
    context.font = "700 " + fontSize + "px ui-sans-serif";
    var text = String(label || "REGION").toUpperCase(), width = context.measureText(text).width + 10;
    context.fillStyle = "rgba(9,13,11,.82)"; context.fillRect(x - width / 2, y - fontSize, width, fontSize + 6);
    context.fillStyle = color; context.textAlign = "center"; context.fillText(text, x, y + 2);
  }
  function renderOverlay() {
    overlayContext.clearRect(0, 0, state.analysisWidth, state.analysisHeight);
    var grid = state.review && state.review.grid || activeGrid();
    if (state.review) {
      state.review.regions.forEach(function (region) {
        var color = appearanceFor(region.type, region.appearance).color;
        overlayContext.save();
        overlayContext.fillStyle = color + (region.source === "dm-authored" ? "c8" : "58");
        region.cells.forEach(function (cell) {
          overlayContext.fillRect(
            grid.originX + cell[0] * grid.cellPx,
            grid.originY + cell[1] * grid.cellPx,
            grid.cellPx + 0.4, grid.cellPx + 0.4
          );
        });
        if (region.id === state.selectedId) {
          overlayContext.strokeStyle = "#fff0a8";
          overlayContext.lineWidth = Math.max(2, grid.cellPx * 0.08);
          region.cells.forEach(function (cell) {
            overlayContext.strokeRect(
              grid.originX + cell[0] * grid.cellPx,
              grid.originY + cell[1] * grid.cellPx,
              grid.cellPx, grid.cellPx
            );
          });
        }
        if (region.source === "dm-authored" && region.cells.length >= 2) {
          overlayLabel(overlayContext, region.cells, grid, Structure.TYPES[region.type].label, "#fff3bd");
        }
        overlayContext.restore();
      });
    }
    if (state.selection && state.selection.cells.length) {
      var pendingAppearance = state.semanticType === "ground"
        ? { color: "#857958", label: "Ground / erase" }
        : appearanceFor(state.semanticType, state.semanticAppearance);
      overlayContext.save();
      overlayContext.fillStyle = pendingAppearance.color + "b8";
      overlayContext.strokeStyle = "#fff3bd";
      overlayContext.lineWidth = Math.max(1.5, grid.cellPx * 0.06);
      state.selection.cells.forEach(function (cell) {
        overlayContext.fillRect(grid.originX + cell[0] * grid.cellPx, grid.originY + cell[1] * grid.cellPx, grid.cellPx, grid.cellPx);
      });
      traceFootprint(overlayContext, state.selection.footprint);
      overlayLabel(overlayContext, state.selection.cells, grid,
        (state.editingRegionId ? "EDIT " : "NEW ") + (state.semanticType === "ground" ? "GROUND" : Structure.TYPES[state.semanticType].label),
        "#fff3bd");
      overlayContext.restore();
    }
    if (state.gridVisible && !state.calibrating) renderGrid(overlayContext, grid);
    if (state.lassoPoints && state.lassoPoints.length) {
      overlayContext.save(); overlayContext.beginPath();
      overlayContext.moveTo(state.lassoPoints[0][0], state.lassoPoints[0][1]);
      state.lassoPoints.slice(1).forEach(function (point) { overlayContext.lineTo(point[0], point[1]); });
      overlayContext.strokeStyle = "#fff0a8"; overlayContext.lineWidth = Math.max(2, (grid && grid.cellPx || 18) * 0.08);
      overlayContext.setLineDash([8, 5]); overlayContext.stroke(); overlayContext.restore();
    }
    if (state.drag && state.calibrating) {
      var left = Math.min(state.drag.startX, state.drag.endX);
      var top = Math.min(state.drag.startY, state.drag.endY);
      var width = Math.abs(state.drag.endX - state.drag.startX);
      var height = Math.abs(state.drag.endY - state.drag.startY);
      overlayContext.save();
      overlayContext.fillStyle = "rgba(212,180,95,.16)";
      overlayContext.strokeStyle = "#fff0a8";
      overlayContext.lineWidth = Math.max(2, Math.min(state.analysisWidth, state.analysisHeight) / 360);
      overlayContext.setLineDash([8, 5]);
      overlayContext.fillRect(left, top, width, height);
      overlayContext.strokeRect(left, top, width, height);
      overlayContext.restore();
    }
  }
  function propose() {
    if (!state.imageData) return;
    var grid = activeGrid();
    if (!grid || grid.cols * grid.rows > 6500) {
      setStatus("That grid creates too many squares. Increase cell size or reduce the ungridded width.");
      return;
    }
    setStatus("Finding broad water, vegetation, and constructed-area evidence…");
    state.analysis = Importer.analyze(state.imageData.data, state.analysisWidth, state.analysisHeight, grid);
    state.review = Structure.proposeRegions(state.analysis, { minimumCells: 3 });
    state.selectedId = state.review.regions[0] && state.review.regions[0].id || null;
    state.selection = null;
    setEnabled(ui.selectionPanel, true);
    setEnabled(ui.inspector, !!state.selectedId);
    state.selectionTool = "pointer";
    document.querySelectorAll("[data-draw-tool]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.drawTool === "pointer");
    });
    syncPendingAppearance();
    renderAll();
    setStatus(state.gridMode === "auto"
      ? "Broad areas proposed on Auto scale. If the printed grid drifts, draw one real square before trusting coverage."
      : "Broad hints proposed. Choose Lasso, right-click for a kind, and draw one object per gesture.");
  }
  function canvasPoint(event) {
    var rect = ui.overlayCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * ui.overlayCanvas.width / rect.width,
      y: (event.clientY - rect.top) * ui.overlayCanvas.height / rect.height
    };
  }
  function cellAtPoint(point) {
    var grid = state.review && state.review.grid || activeGrid();
    if (!grid) return null;
    var c = Math.floor((point.x - grid.originX) / grid.cellPx);
    var r = Math.floor((point.y - grid.originY) / grid.cellPx);
    return c >= 0 && r >= 0 && c < grid.cols && r < grid.rows ? { c: c, r: r } : null;
  }
  function finishCalibration(point) {
    var calibrationDrag = state.drag;
    var grid = Importer.gridFromDrawnBox(
      state.analysisWidth, state.analysisHeight,
      calibrationDrag.startX, calibrationDrag.startY, point.x, point.y, 1
    );
    state.drag = null;
    if (!grid) {
      renderOverlay();
      setStatus("That drag was too small. Draw from one printed grid corner to its opposite corner.");
      return;
    }
    state.detectedGrid = grid;
    state.gridMode = "gridded";
    state.calibrating = false;
    state.verifyingGrid = false;
    state.gridVerified = false;
    state.gridAnchor = {
      x: Math.min(calibrationDrag.startX, point.x),
      y: Math.min(calibrationDrag.startY, point.y)
    };
    state.gridVisible = true;
    reportDetectedGrid(grid);
    clearReview();
    syncGridControls();
    setStatus("One printed square owns local scale and phase. Zoom out and check a distant intersection before tracing.");
  }
  function finishGridVerification(point) {
    var refined = Structure.refineGridFromPoint(state.analysisWidth, state.analysisHeight, activeGrid(), state.gridAnchor, point);
    state.verifyingGrid = false;
    if (!refined) {
      syncGridControls();
      setStatus("That check was too close to the first square. Choose a printed intersection near the far edge.");
      return;
    }
    state.gridVerified = true;
    state.detectedGrid = refined;
    ui.gridCellPx.value = (refined.cellPx / state.scale).toFixed(2);
    ui.gridOriginX.value = (refined.phaseX / state.scale).toFixed(2);
    ui.gridOriginY.value = (refined.phaseY / state.scale).toFixed(2);
    ui.gridNote.className = "grid-note good";
    ui.gridNote.textContent = "Far-edge checked: " + (refined.cellPx / state.scale).toFixed(2) + " source pixels per cell. The projection covers the full artwork.";
    clearReview(); syncGridControls();
    setStatus("Grid checked across the artwork. Show or hide it at any time, then find broad areas.");
  }
  function updateHistoryControls() {
    ui.undoDraw.disabled = !state.undoStack.length;
    ui.redoDraw.disabled = !state.redoStack.length;
  }
  function pushUndo() {
    if (!state.review) return;
    state.undoStack.push(JSON.parse(JSON.stringify(state.review)));
    if (state.undoStack.length > 40) state.undoStack.shift();
    state.redoStack = [];
    updateHistoryControls();
  }
  function restoreHistory(from, to, label) {
    if (!from.length || !state.review) return;
    to.push(JSON.parse(JSON.stringify(state.review)));
    state.review = from.pop();
    state.selectedId = null; state.editAddRegionId = null; state.selection = null; state.magicFence = null;
    updateHistoryControls(); renderAll(); setStatus(label + ". Every structure remains individually authored.");
  }
  function magicSelect(point) {
    var grid = state.review && state.review.grid || activeGrid();
    if (!grid || !state.imageData) return;
    if (!state.selection || !state.selection.cells.length) {
      setStatus("Color assist needs a boundary. Draw a loose lasso around one feature first; it will never search the whole map.");
      return;
    }
    var fenceSelection = state.magicFence || state.selection;
    var allowedMask = Structure.maskFromCells(grid, fenceSelection.cells, state.analysisWidth, state.analysisHeight);
    var seedIndex = clamp(Math.floor(point.y), 0, state.analysisHeight - 1) * state.analysisWidth
      + clamp(Math.floor(point.x), 0, state.analysisWidth - 1);
    if (!allowedMask[seedIndex]) {
      setStatus("Click inside the current lasso. Color assist cannot add pixels beyond that boundary.");
      return;
    }
    setStatus("Refining connected local color inside the current lasso…");
    var tolerance = Number(ui.magicTolerance.value) || 18;
    var mask = Structure.magicMask(
      state.imageData.data, state.analysisWidth, state.analysisHeight,
      point.x, point.y, tolerance, { allowedMask: allowedMask }
    );
    var cells = Structure.cellsFromMask(grid, mask, state.analysisWidth, state.analysisHeight, 0.18);
    if (!cells.length) {
      setStatus("No tactical square contained enough of that color inside the lasso. Raise tolerance or keep the lasso as drawn.");
      return;
    }
    var fence = fenceSelection.footprint;
    var refined = Structure.selectionFromCells(cells, {
      kind: "magic-within", seed: [point.x, point.y], tolerance: tolerance,
      fence: fence, imageSize: [state.analysisWidth, state.analysisHeight]
    });
    pushUndo();
    var result = Structure.authorSelection(state.review, refined, state.semanticType, {
      replaceRegionId: state.editingRegionId,
      appearance: state.semanticAppearance
    });
    state.review = result.review; state.selectedId = result.regionId;
    state.selection = null; state.magicFence = null; state.editingRegionId = null; state.selectionTool = "pointer";
    syncDrawToolButtons(); renderAll();
    setStatus(cells.length + " squares retained inside the saved boundary. No artwork outside it was searched.");
  }
  function finishLasso() {
    var points = state.lassoPoints || [], grid = state.review && state.review.grid || activeGrid();
    state.lassoPoints = null;
    if (!grid || points.length < 3) { renderOverlay(); setStatus("The lasso needs a closed freehand boundary."); return; }
    var cells = Structure.cellsFromPolygon(grid, points, 0.18);
    if (!cells.length) { renderOverlay(); setStatus("That lasso did not cover a complete tactical cell. Zoom in or draw a slightly larger boundary."); return; }
    var selection = Structure.selectionFromCells(cells, {
      kind: "polygon", points: points, imageSize: [state.analysisWidth, state.analysisHeight]
    });
    pushUndo();
    if (state.selectionTool === "eraser") {
      var erased = Structure.eraseSelection(state.review, selection, state.selectedId);
      state.review = erased.review;
      if (state.selectedId && !selectedRegion()) state.selectedId = null;
      renderAll();
      setStatus(erased.affected
        ? "Eraser changed " + erased.affected + " structure" + (erased.affected === 1 ? "" : "s") + ". Undo is available."
        : "The eraser crossed no authored footprint; nothing changed.");
      return;
    }
    var editing = state.editAddRegionId && state.review.regions.find(function (region) { return region.id === state.editAddRegionId; });
    if (editing) {
      selection = Structure.combineSelection(Structure.selectionFromCells(editing.cells, editing.footprint), selection, "add");
    }
    var result = Structure.authorSelection(state.review, selection, state.semanticType, {
      replaceRegionId: editing && editing.id || null,
      appearance: state.semanticAppearance
    });
    state.review = result.review; state.selectedId = result.regionId; state.editAddRegionId = null;
    renderAll();
    setStatus(appearanceFor(state.semanticType, state.semanticAppearance).label
      + (editing ? " footprint extended." : " saved immediately as its own structure.")
      + " Keep drawing or right-click to change what the lasso creates.");
  }
  function useRegionAsSelection() {
    var region = selectedRegion();
    if (!region) return;
    state.editAddRegionId = region.id;
    state.semanticType = region.type;
    state.semanticAppearance = region.appearance || appearanceFor(region.type).id;
    state.selectionTool = "lasso"; syncPendingAppearance(); syncDrawToolButtons(); renderOverlay();
    setStatus("Draw one additional lasso for " + region.label + ". It will extend only this saved object.");
  }
  function selectedRegion() {
    return state.review && state.review.regions.find(function (region) { return region.id === state.selectedId; });
  }
  function syncDrawToolButtons() {
    document.querySelectorAll("[data-draw-tool]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.drawTool === state.selectionTool);
    });
    syncGridControls();
  }
  function renderTypePalette() {
    ui.typePaletteKinds.replaceChildren(); ui.typePaletteVariants.replaceChildren();
    Object.keys(Structure.TYPES).forEach(function (type) {
      var button = document.createElement("button");
      button.type = "button"; button.textContent = Structure.TYPES[type].label;
      button.classList.toggle("active", type === state.semanticType);
      button.addEventListener("click", function () {
        state.semanticType = type; state.semanticAppearance = appearanceFor(type).id;
        syncPendingAppearance(); renderTypePalette();
      });
      ui.typePaletteKinds.appendChild(button);
    });
    (Structure.APPEARANCES[state.semanticType] || []).forEach(function (appearance) {
      var button = document.createElement("button"), swatch = document.createElement("i"), label = document.createElement("span");
      button.type = "button"; button.classList.toggle("active", appearance.id === state.semanticAppearance);
      swatch.style.background = appearance.color; label.textContent = appearance.label; button.append(swatch, label);
      button.addEventListener("click", function () {
        state.semanticAppearance = appearance.id; syncPendingAppearance(); closeTypePalette();
        setStatus(appearance.label + " armed. Every completed lasso becomes one separate " + Structure.TYPES[state.semanticType].label.toLowerCase() + ".");
      });
      ui.typePaletteVariants.appendChild(button);
    });
  }
  function openTypePalette(clientX, clientY) {
    renderTypePalette(); ui.typePalette.hidden = false;
    var width = 330, height = 330;
    ui.typePalette.style.left = clamp(clientX, 8, window.innerWidth - width - 8) + "px";
    ui.typePalette.style.top = clamp(clientY, 8, window.innerHeight - height - 8) + "px";
  }
  function closeTypePalette() { ui.typePalette.hidden = true; }
  function renderInspector() {
    var region = selectedRegion();
    setEnabled(ui.inspector, !!region);
    if (!region) {
      ui.regionName.textContent = "Nothing selected";
      ui.regionReceipt.textContent = "Inspect a proposed region or create one from a selection.";
      ui.heightReceipt.textContent = "Select a raised region to inspect its vertical span.";
      ui.movementNote.textContent = "Movement evidence appears after selecting an elevated region.";
      return;
    }
    ui.regionName.textContent = region.label;
    var regionAppearance = appearanceFor(region.type, region.appearance);
    ui.regionReceipt.textContent = region.cells.length + " squares · "
      + (region.source === "dm-authored" ? "DM authored" : Math.round(region.confidence * 100) + "% local proposal")
      + " · " + regionAppearance.label;
    ui.regionType.value = region.type;
    fillAppearanceOptions(ui.regionAppearance, region.type, region.appearance);
    ui.regionLabel.value = region.label;
    ui.regionBase.value = region.baseFt;
    ui.regionTop.value = region.topFt;
    ui.regionWalkable.checked = !!region.roofWalkable;
    ui.regionAccess.value = region.access || "none";
    ui.regionSupport.value = region.supportMode || Structure.TYPES[region.type].supportMode;
    var rise = Math.max(0, region.topFt - region.baseFt);
    ui.heightReceipt.textContent = "Base " + region.baseFt + " ft → top " + region.topFt + " ft · "
      + rise + " ft span · " + (region.supportMode || "unspecified") + " support";
    if ((region.type === "roof" || region.type === "bridge") && region.supportMode === "none") {
      ui.heightReceipt.textContent += " · intentionally unsupported / special";
    }
    if (!rise) ui.movementNote.textContent = "This region remains on the base surface.";
    else if (region.access === "climb") {
      ui.movementNote.textContent = rise + " ft climb · ordinary movement budget "
        + Structure.climbCost(rise, false) + " ft · with a climbing speed " + Structure.climbCost(rise, true) + " ft.";
    } else if (region.access === "none") {
      ui.movementNote.textContent = "Raised " + rise + " ft with no ordinary connector. Jump, flight, teleport, or a later authored access route is required.";
    } else {
      ui.movementNote.textContent = rise + " ft rise connected by " + region.access + ". Final path length belongs to the authored connector.";
    }
  }
  function renderSummary() {
    if (!state.review) {
      ui.sceneName.textContent = "No structure review";
      ui.metricGrid.textContent = "—"; ui.metricRegions.textContent = "—";
      ui.metricSurfaces.textContent = "—"; ui.metricConnectors.textContent = "—";
      ui.typeSummary.innerHTML = "<p>Local proposals will be grouped here.</p>";
      ui.authoredCount.textContent = "0";
      ui.authoredList.innerHTML = "<p>No DM-authored structures yet.</p>";
      ui.surfaceReceipt.innerHTML = "<p>No surfaces or volumes compiled.</p>";
      ui.reviewJson.textContent = "{}";
      return;
    }
    var summary = Structure.summarize(state.review);
    var compiled = Structure.compileReview(state.review);
    ui.sceneName.textContent = state.review.scene;
    ui.metricGrid.textContent = state.review.grid.cols + " × " + state.review.grid.rows;
    ui.metricRegions.textContent = String(state.review.regions.length);
    ui.metricSurfaces.textContent = String(summary.surfaces);
    ui.metricConnectors.textContent = String(summary.connectors);
    ui.typeSummary.replaceChildren();
    Object.keys(summary.counts).forEach(function (type) {
      var row = document.createElement("div");
      row.className = "type-row";
      var swatch = document.createElement("i"), label = document.createElement("span"), value = document.createElement("b");
      swatch.style.background = Structure.TYPES[type].color;
      label.textContent = Structure.TYPES[type].label;
      value.textContent = summary.counts[type];
      row.append(swatch, label, value); ui.typeSummary.appendChild(row);
    });
    var authored = state.review.regions.filter(function (region) { return region.source === "dm-authored"; });
    ui.authoredCount.textContent = String(authored.length);
    ui.authoredList.replaceChildren();
    if (!authored.length) ui.authoredList.innerHTML = "<p>No DM-authored structures yet.</p>";
    authored.forEach(function (region) {
      var appearance = appearanceFor(region.type, region.appearance);
      var button = document.createElement("button"), swatch = document.createElement("i");
      var copy = document.createElement("span"), title = document.createElement("strong"), detail = document.createElement("small");
      var height = document.createElement("em");
      button.type = "button"; button.className = "authored-region" + (region.id === state.selectedId ? " active" : "");
      swatch.style.background = appearance.color; title.textContent = region.label;
      detail.textContent = Structure.TYPES[region.type].label + " · " + appearance.label;
      height.textContent = region.topFt + " ft"; copy.append(title, detail); button.append(swatch, copy, height);
      button.addEventListener("click", function () {
        state.selectedId = region.id; renderAll();
        setStatus(region.label + " selected. Its meaning, appearance, height, support, and footprint are editable.");
      });
      ui.authoredList.appendChild(button);
    });
    ui.surfaceReceipt.replaceChildren();
    [
      ["Walk surfaces", compiled.surfaces.length + " · ground, water, roofs, and decks remain separate"],
      ["Volumes", compiled.volumes.length + " · buildings and obstacles carry bottom/top feet"],
      ["Connectors", compiled.connectors.length + " · stairs, ramps, ladders, or climb access"],
      ["Underpasses", compiled.surfaces.filter(function (surface) { return surface.supportsUnderpass; }).length
        + " proposed · renderer study only"]
    ].forEach(function (item) {
      var row = document.createElement("div"), title = document.createElement("strong"), detail = document.createElement("span");
      title.textContent = item[0]; detail.textContent = item[1]; row.append(title, detail); ui.surfaceReceipt.appendChild(row);
    });
    ui.reviewJson.textContent = JSON.stringify({ review: state.review, proposal: compiled }, null, 2);
  }
  function colorForMaterial(material) {
    return Importer.MATERIALS[material] && Importer.MATERIALS[material].color || "#857958";
  }
  function shade(hex, factor) {
    var value = hex.replace("#", "");
    var red = parseInt(value.slice(0, 2), 16), green = parseInt(value.slice(2, 4), 16), blue = parseInt(value.slice(4, 6), 16);
    return "rgb(" + Math.round(red * factor) + "," + Math.round(green * factor) + "," + Math.round(blue * factor) + ")";
  }
  function renderPreview() {
    var ctx = previewContext, canvas = ui.previewCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var background = ctx.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, "#24322c"); background.addColorStop(1, "#080c0a");
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!state.review || !state.analysis) {
      ctx.fillStyle = "#9f9d91"; ctx.font = "18px Georgia"; ctx.textAlign = "center";
      ctx.fillText("Structure heights appear after local proposals.", canvas.width / 2, canvas.height / 2);
      return;
    }
    var cols = state.review.grid.cols, rows = state.review.grid.rows;
    var tileW = Math.min(18, 880 * 2 / Math.max(1, cols + rows));
    var tileH = tileW * 0.45, elevationScale = tileH * 0.72;
    var originX = canvas.width / 2 - (cols - rows) * tileW / 4;
    var originY = 62;
    function project(c, r, elevationFt) {
      return {
        x: originX + (c - r) * tileW / 2,
        y: originY + (c + r) * tileH / 2 - elevationFt * elevationScale
      };
    }
    function diamond(c, r, elevationFt, fill, stroke) {
      var p = project(c, r, elevationFt);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + tileW / 2, p.y + tileH / 2);
      ctx.lineTo(p.x, p.y + tileH);
      ctx.lineTo(p.x - tileW / 2, p.y + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.65; ctx.stroke(); }
    }
    function prism(c, r, bottomFt, topFt, color, selected) {
      var top = project(c, r, topFt), bottom = project(c, r, bottomFt);
      ctx.beginPath();
      ctx.moveTo(top.x - tileW / 2, top.y + tileH / 2);
      ctx.lineTo(top.x, top.y + tileH);
      ctx.lineTo(bottom.x, bottom.y + tileH);
      ctx.lineTo(bottom.x - tileW / 2, bottom.y + tileH / 2);
      ctx.closePath(); ctx.fillStyle = shade(color, 0.54); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(top.x + tileW / 2, top.y + tileH / 2);
      ctx.lineTo(top.x, top.y + tileH);
      ctx.lineTo(bottom.x, bottom.y + tileH);
      ctx.lineTo(bottom.x + tileW / 2, bottom.y + tileH / 2);
      ctx.closePath(); ctx.fillStyle = shade(color, 0.68); ctx.fill();
      diamond(c, r, topFt, color, selected ? "#fff0a8" : "rgba(238,231,214,.16)");
    }
    function joinedPrism(region, bottomFt, topFt, color, selected) {
      var occupied = new Set(region.cells.map(function (cell) { return cell[0] + "," + cell[1]; }));
      var cells = region.cells.slice().sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
      cells.forEach(function (cell) {
        var c = cell[0], r = cell[1], top = project(c, r, topFt), bottom = project(c, r, bottomFt);
        if (!occupied.has((c + 1) + "," + r)) {
          ctx.beginPath();
          ctx.moveTo(top.x + tileW / 2, top.y + tileH / 2); ctx.lineTo(top.x, top.y + tileH);
          ctx.lineTo(bottom.x, bottom.y + tileH); ctx.lineTo(bottom.x + tileW / 2, bottom.y + tileH / 2);
          ctx.closePath(); ctx.fillStyle = shade(color, 0.62); ctx.fill();
        }
        if (!occupied.has(c + "," + (r + 1))) {
          ctx.beginPath();
          ctx.moveTo(top.x - tileW / 2, top.y + tileH / 2); ctx.lineTo(top.x, top.y + tileH);
          ctx.lineTo(bottom.x, bottom.y + tileH); ctx.lineTo(bottom.x - tileW / 2, bottom.y + tileH / 2);
          ctx.closePath(); ctx.fillStyle = shade(color, 0.5); ctx.fill();
        }
      });
      cells.forEach(function (cell) {
        diamond(cell[0], cell[1], topFt, color, selected ? "#fff0a8" : null);
      });
    }
    function supportPosts(region, color) {
      var cells = region.cells.slice().sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
      var stride = Math.max(1, Math.ceil(cells.length / 6));
      cells.forEach(function (cell, index) {
        if (index % stride) return;
        var deck = project(cell[0], cell[1], region.topFt - 0.8), ground = project(cell[0], cell[1], region.baseFt);
        ctx.strokeStyle = shade(color, 0.52); ctx.lineWidth = Math.max(1.5, tileW * 0.14);
        ctx.beginPath(); ctx.moveTo(deck.x, deck.y + tileH / 2); ctx.lineTo(ground.x, ground.y + tileH / 2); ctx.stroke();
      });
    }
    function pitchedCrown(region, color) {
      var average = averageCell(region), peak = project(average.c, average.r, region.topFt + 3);
      var leftCell = region.cells.reduce(function (best, cell) { return cell[0] - cell[1] < best[0] - best[1] ? cell : best; });
      var rightCell = region.cells.reduce(function (best, cell) { return cell[0] - cell[1] > best[0] - best[1] ? cell : best; });
      var left = project(leftCell[0], leftCell[1], region.topFt), right = project(rightCell[0], rightCell[1], region.topFt);
      ctx.beginPath(); ctx.moveTo(left.x - tileW / 2, left.y + tileH / 2); ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(right.x + tileW / 2, right.y + tileH / 2); ctx.strokeStyle = shade(color, 1.16);
      ctx.lineWidth = Math.max(1.2, tileW * 0.12); ctx.stroke();
    }
    function heightLabel(region, emphasized) {
      var average = averageCell(region), point = project(average.c, average.r, region.topFt + 1.5);
      var label = region.topFt + " ft · " + appearanceFor(region.type, region.appearance).label;
      ctx.font = emphasized ? "bold 12px ui-sans-serif" : "10px ui-sans-serif";
      var width = ctx.measureText(label).width + 12;
      ctx.fillStyle = emphasized ? "rgba(255,240,168,.96)" : "rgba(12,17,15,.84)";
      ctx.fillRect(point.x - width / 2, point.y - 17, width, 15);
      ctx.fillStyle = emphasized ? "#171d1a" : "#eee7d6"; ctx.textAlign = "center";
      ctx.fillText(label, point.x, point.y - 6);
    }
    function heightRuler(maxFt) {
      var x = 34, groundY = canvas.height - 42, topY = Math.max(24, groundY - maxFt * elevationScale);
      ctx.strokeStyle = "rgba(255,240,168,.62)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, topY); ctx.stroke();
      ctx.font = "10px ui-sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#eee7d6";
      for (var feet = 0; feet <= maxFt; feet += 5) {
        var y = groundY - feet * elevationScale;
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.stroke();
        ctx.fillText(feet + " ft", x + 8, y + 3);
      }
    }
    var baseCells = state.analysis.cells.slice().sort(function (a, b) { return a.c + a.r - b.c - b.r; });
    baseCells.forEach(function (cell) {
      diamond(cell.c, cell.r, 0, shade(colorForMaterial(cell.material), 0.58), "rgba(238,231,214,.08)");
    });
    var orderedRegions = state.review.regions.slice().sort(function (a, b) {
      var ac = averageCell(a), bc = averageCell(b);
      return ac.c + ac.r - bc.c - bc.r;
    });
    orderedRegions.forEach(function (region) {
      var appearance = appearanceFor(region.type, region.appearance), color = appearance.color;
      var cells = region.cells.slice().sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
      var selected = region.id === state.selectedId;
      if (region.type === "water") {
        cells.forEach(function (cell) {
          diamond(cell[0], cell[1], region.baseFt - 0.5, color, selected ? "#fff0a8" : "rgba(220,244,247,.22)");
        });
      } else if (region.type === "tree") {
        cells.forEach(function (cell) {
          var p = project(cell[0], cell[1], region.baseFt);
          var top = project(cell[0], cell[1], region.topFt);
          ctx.strokeStyle = "#5d4932"; ctx.lineWidth = Math.max(1, tileW * 0.12);
          ctx.beginPath(); ctx.moveTo(p.x, p.y + tileH / 2); ctx.lineTo(top.x, top.y + tileH / 2); ctx.stroke();
          ctx.fillStyle = color; ctx.beginPath();
          if (appearance.form === "conifer") {
            ctx.moveTo(top.x, top.y - tileH * 0.7); ctx.lineTo(top.x + tileW * 0.42, top.y + tileH * 0.8);
            ctx.lineTo(top.x - tileW * 0.42, top.y + tileH * 0.8); ctx.closePath();
          } else ctx.arc(top.x, top.y + tileH / 2, tileW * (appearance.form === "mangrove" ? 0.48 : 0.38), 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (region.type === "tent") {
        joinedPrism(region, Math.max(region.baseFt, region.topFt - 1.2), region.topFt, color, selected);
        supportPosts(region, color);
        pitchedCrown(region, color);
      } else if (region.type === "stairs") {
        cells.forEach(function (cell, index) {
          var t = cells.length <= 1 ? 1 : index / (cells.length - 1);
          prism(cell[0], cell[1], region.baseFt, region.baseFt + (region.topFt - region.baseFt) * t, color, selected);
        });
      } else if (region.type === "bridge" || region.type === "roof") {
        if (region.supportMode === "solid") joinedPrism(region, region.baseFt, region.topFt, color, selected);
        else {
          joinedPrism(region, region.topFt - 0.8, region.topFt, color, selected);
          if (region.supportMode === "posts" || region.supportMode === "arches") supportPosts(region, color);
        }
        if (appearance.form === "pitched") pitchedCrown(region, color);
      } else if (region.type === "building" && appearance.form === "pavilion") {
        joinedPrism(region, Math.max(region.baseFt, region.topFt - 1), region.topFt, color, selected);
        supportPosts(region, color); pitchedCrown(region, color);
      } else {
        joinedPrism(region, region.baseFt, region.topFt, color, selected);
        if (appearance.form === "pitched") pitchedCrown(region, color);
      }
    });
    var maxFt = Math.max(20, orderedRegions.reduce(function (max, region) { return Math.max(max, region.topFt); }, 0));
    heightRuler(Math.ceil(maxFt / 5) * 5);
    var labelRegions = orderedRegions.slice().sort(function (a, b) { return b.cells.length - a.cells.length; }).slice(0, 12);
    var selected = selectedRegion();
    if (selected && labelRegions.indexOf(selected) < 0) labelRegions.push(selected);
    labelRegions.forEach(function (region) {
      if (region.topFt > region.baseFt) heightLabel(region, region.id === state.selectedId);
    });
  }
  function averageCell(region) {
    var total = region.cells.reduce(function (sum, cell) { return { c: sum.c + cell[0], r: sum.r + cell[1] }; }, { c: 0, r: 0 });
    return { c: total.c / region.cells.length, r: total.r / region.cells.length };
  }
  function renderAll() {
    renderOverlay();
    renderPreview();
    renderInspector();
    renderSummary();
    syncPendingAppearance();
    updateHistoryControls();
    updateGridReceipt();
  }
  function applySelectedRegion() {
    var region = selectedRegion();
    if (!region) return;
    pushUndo();
    state.review = Structure.updateRegion(state.review, region.id, {
      type: ui.regionType.value,
      appearance: ui.regionAppearance.value,
      label: ui.regionLabel.value,
      baseFt: Number(ui.regionBase.value),
      topFt: Number(ui.regionTop.value),
      roofWalkable: ui.regionWalkable.checked,
      access: ui.regionAccess.value,
      supportMode: ui.regionSupport.value
    });
    renderAll();
    setStatus("Region meaning, appearance, height, walk surface, and access receipt updated.");
  }
  function setView(view) {
    state.view = view;
    ui.viewGrid.className = "view-grid " + (view === "artwork" ? "artwork-only" : view === "preview" ? "preview-only" : "split");
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.view === view);
    });
    renderPreview();
  }

  ui.imageFile.addEventListener("change", function () { loadFile(ui.imageFile.files[0]); });
  ui.autoGrid.addEventListener("click", inspectGrid);
  ui.drawGridCell.addEventListener("click", function () {
    state.gridMode = "gridded";
    state.calibrating = !state.calibrating;
    state.verifyingGrid = false;
    state.drag = null;
    if (state.calibrating) state.gridVisible = false;
    syncGridControls();
    setStatus(state.calibrating
      ? "The generated overlay is hidden. Zoom in, then drag exactly one printed square from corner to opposite corner."
      : "Grid drawing cancelled.");
  });
  ui.verifyGrid.addEventListener("click", function () {
    state.verifyingGrid = true; state.calibrating = false; state.gridVisible = true; state.drag = null;
    syncGridControls(); setStatus("Click a matching printed-grid intersection near the far edge. This exposes accumulated size drift.");
  });
  ui.noGrid.addEventListener("click", function () {
    state.gridMode = "ungridded";
    state.calibrating = false;
    state.verifyingGrid = false;
    state.gridVisible = false;
    state.drag = null;
    clearReview();
    syncGridControls();
    ui.gridNote.className = "grid-note good";
    ui.gridNote.textContent = "No printed grid. The chosen map width becomes the tactical scale; the overlay can remain hidden.";
    setStatus("Choose the intended map width, then propose regions.");
  });
  [ui.gridCellPx, ui.gridOriginX, ui.gridOriginY, ui.targetColumns].forEach(function (input) {
    input.addEventListener("change", function () { state.gridVerified = false; clearReview(); renderOverlay(); });
  });
  ui.proposeRegions.addEventListener("click", propose);
  document.querySelectorAll("[data-draw-tool]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.selectionTool = button.dataset.drawTool; state.editAddRegionId = null;
      syncDrawToolButtons();
      setStatus(state.selectionTool === "pointer" ? "Pointer active. Select one structure to edit its properties."
        : state.selectionTool === "lasso" ? "Lasso active. Right-click for type and variant; release each drawing to save it."
          : state.selectionTool === "eraser" ? (state.selectedId ? "Eraser targets the selected structure only." : "Eraser will trim every authored footprint it crosses.")
            : "Pan active. Drag the artwork without changing structures.");
    });
  });
  ui.magicTolerance.addEventListener("input", function () { ui.magicToleranceValue.textContent = ui.magicTolerance.value; });
  ui.colorAssist.addEventListener("click", function () {
    var region = selectedRegion();
    if (!region) { setStatus("Select one saved structure before using Color assist."); return; }
    state.selection = Structure.selectionFromCells(region.cells, region.footprint || { kind: "cells" });
    state.magicFence = Structure.selectionFromCells(state.selection.cells, state.selection.footprint);
    state.editingRegionId = region.id; state.semanticType = region.type; state.semanticAppearance = region.appearance;
    state.selectionTool = "magic"; syncPendingAppearance(); syncDrawToolButtons();
    setStatus("Color assist is fenced to " + region.label + ". Click its material; no outside artwork can be selected.");
  });
  ui.armedKit.addEventListener("click", function (event) { openTypePalette(event.clientX, event.clientY); });
  ui.closeTypePalette.addEventListener("click", closeTypePalette);
  ui.undoDraw.addEventListener("click", function () { restoreHistory(state.undoStack, state.redoStack, "Last authoring gesture undone"); });
  ui.redoDraw.addEventListener("click", function () { restoreHistory(state.redoStack, state.undoStack, "Authoring gesture restored"); });
  ui.toggleGrid.addEventListener("click", function () { state.gridVisible = !state.gridVisible; updateGridReceipt(); renderOverlay(); });
  ui.zoomIn.addEventListener("click", function () { state.zoom *= 1.25; applyZoom(); });
  ui.zoomOut.addEventListener("click", function () { state.zoom /= 1.25; applyZoom(); });
  ui.zoomFit.addEventListener("click", fitArtwork);
  ui.regionToSelection.addEventListener("click", useRegionAsSelection);
  ui.regionType.addEventListener("change", function () {
    ui.regionSupport.value = Structure.TYPES[ui.regionType.value].supportMode;
    fillAppearanceOptions(ui.regionAppearance, ui.regionType.value, null);
  });
  document.querySelectorAll("[data-height-step]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = clamp((Number(ui.regionTop.value) || 0) + Number(button.dataset.heightStep), Number(ui.regionBase.value) || 0, 120);
      ui.regionTop.value = next; applySelectedRegion();
    });
  });
  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () { setView(button.dataset.view); });
  });
  ui.applyRegion.addEventListener("click", applySelectedRegion);
  ui.overlayCanvas.addEventListener("contextmenu", function (event) {
    if (state.selectionTool !== "lasso" || !state.review) return;
    event.preventDefault(); openTypePalette(event.clientX, event.clientY);
  });
  ui.overlayCanvas.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    var point = canvasPoint(event);
    ui.overlayCanvas.setPointerCapture && ui.overlayCanvas.setPointerCapture(event.pointerId);
    if (state.selectionTool === "pan") {
      state.panDrag = { x: event.clientX, y: event.clientY, left: ui.artView.scrollLeft, top: ui.artView.scrollTop };
      ui.canvasStack.classList.add("dragging"); return;
    }
    if (state.calibrating || state.verifyingGrid || state.selectionTool === "pointer" || state.selectionTool === "magic") {
      state.drag = { startX: point.x, startY: point.y, endX: point.x, endY: point.y };
    } else if (state.selectionTool === "lasso" || state.selectionTool === "eraser") state.lassoPoints = [[point.x, point.y]];
    renderOverlay();
  });
  ui.overlayCanvas.addEventListener("pointermove", function (event) {
    if (state.panDrag) {
      ui.artView.scrollLeft = state.panDrag.left - (event.clientX - state.panDrag.x);
      ui.artView.scrollTop = state.panDrag.top - (event.clientY - state.panDrag.y);
      return;
    }
    var point = canvasPoint(event);
    if (state.drag) { state.drag.endX = point.x; state.drag.endY = point.y; }
    if (state.lassoPoints) {
      var last = state.lassoPoints[state.lassoPoints.length - 1];
      if (Math.hypot(point.x - last[0], point.y - last[1]) > 3) state.lassoPoints.push([point.x, point.y]);
    }
    renderOverlay();
  });
  ui.overlayCanvas.addEventListener("pointerup", function (event) {
    var point = canvasPoint(event);
    if (state.panDrag) { state.panDrag = null; ui.canvasStack.classList.remove("dragging"); return; }
    if (state.calibrating) {
      if (!state.drag) return;
      finishCalibration(point);
      return;
    }
    if (state.verifyingGrid) { finishGridVerification(point); return; }
    if (state.selectionTool === "pointer") {
      var cell = cellAtPoint(point);
      state.drag = null;
      var region = cell && state.review && Structure.regionAt(state.review, cell.c, cell.r);
      state.selectedId = region && region.id || null;
      renderAll();
      setStatus(region ? "Region selected. Height, support, and footprint are editable on the right." : "Only the base ground surface is present here.");
      return;
    }
    state.drag = null;
    if (state.selectionTool === "magic") magicSelect(point);
    else if ((state.selectionTool === "lasso" || state.selectionTool === "eraser") && state.lassoPoints) { state.lassoPoints.push([point.x, point.y]); finishLasso(); }
  });
  ui.overlayCanvas.addEventListener("pointercancel", function () { state.drag = null; state.lassoPoints = null; state.panDrag = null; ui.canvasStack.classList.remove("dragging"); renderOverlay(); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { closeTypePalette(); state.calibrating = false; state.verifyingGrid = false; state.drag = null; syncGridControls(); }
  });

  Object.keys(Structure.TYPES).forEach(function (type) {
    var option = document.createElement("option");
    option.value = type; option.textContent = Structure.TYPES[type].label;
    ui.regionType.appendChild(option);
  });
  syncPendingAppearance();

  try {
    if (!Importer || !Importer.analyze || !Importer.gridFromDrawnBox) throw new Error("The local pixel interpreter did not load.");
    if (!Structure || !Structure.proposeRegions) throw new Error("The structure-review authority did not load.");
    renderAll();
  } catch (error) {
    console.error(error);
    ui.fatal.textContent = "Structure Review could not start: " + error.message;
    ui.fatal.classList.add("on");
  }
})();
