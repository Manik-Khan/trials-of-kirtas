/* forge-buildings.js
   Guarded building-template, stacked-floor, connector, and scene-view contract.
   Browser: window.ForgeBuildings. Node: module.exports. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ForgeBuildings = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var SCHEMA = "forge-building-set/v1";
  var VIEW_SCHEMA = "forge-camera-view/v1";
  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function round(value) { return Math.round(Number(value) * 1000) / 1000; }
  function bounds(polygon) {
    var xs = (polygon || []).map(function (point) { return Number(point[0]); });
    var ys = (polygon || []).map(function (point) { return Number(point[1]); });
    return xs.length ? { minC: Math.min.apply(null, xs), maxC: Math.max.apply(null, xs), minR: Math.min.apply(null, ys), maxR: Math.max.apply(null, ys) } : null;
  }
  function surfaceById(blueprint, id) {
    var set = blueprint && blueprint.buildingSet;
    for (var i = 0; i < (set && set.buildings || []).length; i++) {
      var found = (set.buildings[i].surfaces || []).find(function (surface) { return surface.id === id; });
      if (found) return found;
    }
    return null;
  }
  function derivePath(from, to, segments) {
    var out = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      out.push({
        c: round(from.c + (to.c - from.c) * t), r: round(from.r + (to.r - from.r) * t),
        elevationFt: round(from.elevationFt + (to.elevationFt - from.elevationFt) * t),
        surfaceId: i === 0 ? from.surfaceId : i === segments ? to.surfaceId : "surface-connector-" + from.surfaceId.replace("surface-", "") + "-" + to.surfaceId.replace("surface-", "")
      });
    }
    return out;
  }
  function connector(id, label, kind, from, to) {
    var riseFt = Number(to.elevationFt) - Number(from.elevationFt);
    var segments = kind === "stairs" ? Math.max(1, Math.ceil(Math.abs(riseFt) / 2.5)) : 1;
    return {
      id: id, label: label, kind: kind, state: "open", oneWay: false,
      from: copy(from), to: copy(to), riseFt: riseFt, segments: segments,
      path: derivePath(from, to, segments),
      authority: { authored: ["from.surfaceId", "to.surfaceId"], derived: ["riseFt", "segments", "path[].elevationFt"] }
    };
  }
  function cameraView(id, label, target, offset, options) {
    return Object.assign({
      schema: VIEW_SCHEMA, version: 1, id: id, label: label,
      target: copy(target), offset: copy(offset), buildingId: "building-river-archive",
      shellMode: "exterior", floorSurfaceId: null, dmAuthored: true
    }, copy(options || {}));
  }
  function riverArchiveRecord() {
    var lower = { id: "surface-lower-garden", label: "Lower garden", kind: "exterior", elevationFt: -10, relation: "10 ft below the courtyard", polygon: [[4, 11], [9, 11], [9, 15], [4, 15]], walkable: true };
    var courtyard = { id: "surface-courtyard", label: "Courtyard", kind: "exterior", elevationFt: 0, relation: "site datum", polygon: [[4, 7], [10, 7], [10, 14], [4, 14]], walkable: true };
    var hall = { id: "surface-hall", label: "Archive hall", kind: "interior", elevationFt: 0, relation: "same level as the courtyard", polygon: [[11, 5], [20, 5], [20, 14], [11, 14]], walkable: true };
    var gallery = {
      id: "surface-gallery", label: "Upper gallery", kind: "interior", elevationFt: 10,
      relation: "one floor above the hall", polygon: copy(hall.polygon),
      openings: [{ id: "opening-gallery-hall", label: "Open to archive hall", polygon: [[13, 7], [18, 7], [18, 12], [13, 12]] }],
      walkable: true
    };
    var roof = { id: "surface-roof", label: "Archive roof", kind: "roof", elevationFt: 20, relation: "one floor above the gallery", polygon: [[10.7, 4.7], [20.3, 4.7], [20.3, 14.3], [10.7, 14.3]], walkable: false };
    return {
      id: "building-river-archive", templateId: "river-archive", label: "The River Archive",
      footprint: copy(hall.polygon), theme: "ruined-abbey", shell: { kind: "modular-perimeter", floorHeightFt: 10, cutaway: "camera-local" },
      roof: { id: "roof-river-archive", kind: "gable", ridgeAxis: "columns", surfaceId: roof.id, removable: true },
      surfaces: [lower, courtyard, hall, gallery, roof],
      connectors: [
        connector("connector-river-stairs", "River stairs", "stairs",
          { surfaceId: lower.id, c: 7, r: 13, elevationFt: lower.elevationFt }, { surfaceId: courtyard.id, c: 7, r: 11, elevationFt: courtyard.elevationFt }),
        connector("connector-archive-door", "Archive door", "door",
          { surfaceId: courtyard.id, c: 9, r: 10, elevationFt: courtyard.elevationFt }, { surfaceId: hall.id, c: 11, r: 10, elevationFt: hall.elevationFt }),
        connector("connector-gallery-stairs", "Gallery stairs", "stairs",
          { surfaceId: hall.id, c: 17, r: 11, elevationFt: hall.elevationFt }, { surfaceId: gallery.id, c: 17, r: 7, elevationFt: gallery.elevationFt })
      ]
    };
  }
  function riverArchiveViews() {
    return [
      cameraView("view-archive-establishing", "Establishing view", { c: 13.5, r: 9.5, elevationFt: 7 }, { x: 11, y: 10, z: 13 }),
      cameraView("view-archive-entrance", "Main entrance", { c: 10, r: 10, elevationFt: 2 }, { x: -7, y: 5.5, z: 8 }),
      cameraView("view-archive-hall", "Archive hall", { c: 15.5, r: 9.5, elevationFt: 3 }, { x: 5.8, y: 5.8, z: 6.6 }, { shellMode: "interior", floorSurfaceId: "surface-hall" }),
      cameraView("view-archive-gallery", "Upper gallery", { c: 15.5, r: 9.5, elevationFt: 12 }, { x: 5.4, y: 5.2, z: 6.2 }, { shellMode: "interior", floorSurfaceId: "surface-gallery" })
    ];
  }
  function createRiverArchive(BP) {
    if (!BP || typeof BP.produceBlank !== "function") throw new Error("Forge Buildings requires the Blueprint authority.");
    var out = BP.produceBlank({ size: "medium" });
    out = BP.addRoom(out, { c: 4, r: 7 }, { c: 9, r: 13 });
    out = BP.addRoom(out, { c: 11, r: 5 }, { c: 19, r: 13 });
    out = BP.connectSpaces(out, out.spaces[0].id, out.spaces[1].id, 2);
    out.id = "river-archive-building-study"; out.name = "The River Archive"; out.topology = "enterable two-storey building";
    out.spaces[0].label = "Courtyard"; out.spaces[0].material = "cloister";
    out.spaces[1].label = "Archive Hall"; out.spaces[1].material = "nave";
    out.discoveryRegions[0].label = "Courtyard"; out.discoveryRegions[1].label = "Archive Hall";
    out.corridors[0].label = "Archive threshold";
    out.source = { kind: "fixture", label: "Building template", createdBy: "forge-buildings", fixtureKey: "river-archive", buildingTemplate: "river-archive", guarded: true };
    out.buildingSet = { schema: SCHEMA, version: 1, renderDatum: { logicalFloorFt: -10, offsetFt: 10 }, buildings: [riverArchiveRecord()] };
    out.cameraViews = riverArchiveViews();
    out.props = [
      { id: "archive-table", kind: "altar", c: 14, r: 9, rotation: 90, discoveryRegion: out.spaces[1].discoveryRegion, variant: "reading-table" },
      { id: "archive-shelf", kind: "pew", c: 13, r: 6, rotation: 0, discoveryRegion: out.spaces[1].discoveryRegion, variant: "shelf" }
    ];
    out.elevationZones = out.spaces.map(function (space) { return { id: "elevation-" + space.id, polygon: copy(space.polygon), elevationFt: space.elevationFt, material: space.material, discoveryRegion: space.discoveryRegion }; });
    out.materialZones = out.spaces.map(function (space) { return { id: "material-" + space.id, polygon: copy(space.polygon), material: space.material, discoveryRegion: space.discoveryRegion }; });
    var audit = validate(out);
    if (!audit.ok) throw new Error("River Archive template is invalid: " + audit.errors.join(" "));
    return out;
  }
  function renderDatum(blueprint) {
    var record = blueprint && blueprint.buildingSet && blueprint.buildingSet.renderDatum;
    return { logicalFloorFt: Number(record && record.logicalFloorFt) || 0, offsetFt: Math.max(0, Number(record && record.offsetFt) || 0) };
  }
  function viewById(blueprint, id) {
    return (blueprint && blueprint.cameraViews || []).find(function (view) { return view.id === id; }) || null;
  }
  function presentation(blueprint, viewId) {
    var view = viewById(blueprint, viewId) || (blueprint && blueprint.cameraViews || [])[0] || null;
    return {
      view: copy(view), shellMode: view && view.shellMode || "exterior", floorSurfaceId: view && view.floorSurfaceId || null,
      roofOpacity: view && view.shellMode === "interior" ? 0.08 : 1,
      nearWallOpacity: view && view.shellMode === "interior" ? 0.12 : 1
    };
  }
  function validate(blueprint) {
    var errors = [], set = blueprint && blueprint.buildingSet, surfaceIds = new Set(), connectorIds = new Set(), viewIds = new Set();
    if (!set || set.schema !== SCHEMA || Number(set.version) !== 1) return { ok: false, errors: ["Missing forge-building-set/v1."] };
    (set.buildings || []).forEach(function (building) {
      if (!building.id || !bounds(building.footprint)) errors.push("Every building needs an ID and footprint.");
      (building.surfaces || []).forEach(function (surface) {
        if (!surface.id || surfaceIds.has(surface.id)) errors.push("Walk surfaces need unique stable IDs.");
        surfaceIds.add(surface.id);
        if (!Number.isFinite(Number(surface.elevationFt)) || !bounds(surface.polygon)) errors.push((surface.id || "Surface") + " needs finite elevation and polygon.");
        (surface.openings || []).forEach(function (opening) {
          if (!opening.id || !bounds(opening.polygon)) errors.push((surface.id || "Surface") + " has an invalid opening.");
        });
      });
      (building.connectors || []).forEach(function (item) {
        if (!item.id || connectorIds.has(item.id)) errors.push("Connectors need unique stable IDs.");
        connectorIds.add(item.id);
        var from = (building.surfaces || []).find(function (surface) { return surface.id === item.from.surfaceId; });
        var to = (building.surfaces || []).find(function (surface) { return surface.id === item.to.surfaceId; });
        if (!from || !to) errors.push((item.id || "Connector") + " names an unknown landing surface.");
        else if (item.from.elevationFt !== from.elevationFt || item.to.elevationFt !== to.elevationFt || item.riseFt !== to.elevationFt - from.elevationFt) errors.push(item.id + " does not derive its rise from the landings.");
        if (!item.path || item.path.length !== item.segments + 1) errors.push(item.id + " has an invalid derived path.");
      });
    });
    (blueprint.cameraViews || []).forEach(function (view) {
      if (view.schema !== VIEW_SCHEMA || !view.id || viewIds.has(view.id)) errors.push("Camera views need a versioned unique ID.");
      viewIds.add(view.id);
      if (!view.target || !view.offset || !Number.isFinite(Number(view.target.elevationFt))) errors.push((view.id || "Camera view") + " needs target and offset.");
      if (view.floorSurfaceId && !surfaceIds.has(view.floorSurfaceId)) errors.push(view.id + " names an unknown floor surface.");
    });
    var datum = renderDatum(blueprint), minimum = Math.min.apply(null, Array.from(surfaceIds).map(function (id) { return surfaceById(blueprint, id).elevationFt; }));
    if (minimum + datum.offsetFt < 0) errors.push("Renderer datum leaves signed geometry below the drawing floor.");
    return { ok: errors.length === 0, errors: errors };
  }

  return Object.freeze({
    SCHEMA: SCHEMA, VIEW_SCHEMA: VIEW_SCHEMA, copy: copy, bounds: bounds, connector: connector,
    createRiverArchive: createRiverArchive, surfaceById: surfaceById, renderDatum: renderDatum,
    viewById: viewById, presentation: presentation, validate: validate
  });
});
