/* Proves the seam end-to-end: a generator payload (dungeon or heightfield)
   passes through map-bridge and is consumed correctly by tactics-geometry.
   Run: node smoke-map-bridge.mjs */
import Bridge from "../map-bridge.js";
import Geo from "../tactics-geometry.js";

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? "\u2713 " : "\u2717 ") + n); };

// ── a tiny hand-made Battle Forge dungeon ───────────────────────────────
// 5x3, row-major y*W+x. A wall column at x=2 splits the room.
const F = Bridge.CELL.FLOOR, W = Bridge.CELL.WALL, V = Bridge.CELL.VOID;
const dungeon = {
  W: 5, H: 3,
  grid: [
    F, F, W, F, F,
    F, F, W, F, F,
    F, F, W, F, V,
  ],
  spawns: [{ x: 0, y: 1, side: "pc" }, { x: 4, y: 1, side: "foe", key: "gob" }],
  props: [{ kind: "brazier", x: 1, y: 0, rot: 0, scale: 1 }],
  name: "Test Vault", seed: 7, params: { themeKey: "crypt" },
};

const dmap = Bridge.dungeonToMap(dungeon);
ok("dungeon → map keeps dimensions", dmap.cols === 5 && dmap.rows === 3);
ok("bridge validates the produced map", Bridge.validate(dmap).ok);
ok("wall column carried across at x=2", Geo.isWall(dmap, 2, 0) && Geo.isWall(dmap, 2, 1) && Geo.isWall(dmap, 2, 2));
ok("VOID cell becomes impassable too", Geo.isWall(dmap, 4, 2));
ok("floor stays open", !Geo.isWall(dmap, 0, 0) && !Geo.isWall(dmap, 3, 1));
ok("spawns normalised to c/r with sides", dmap.spawns.length === 2 &&
   dmap.spawns[0].c === 0 && dmap.spawns[0].r === 1 && dmap.spawns[0].side === "pc" &&
   dmap.spawns[1].key === "gob");
ok("props normalised to c/r", dmap.props[0].kind === "brazier" && dmap.props[0].c === 1);

// the combat engine's own rules must honour the bridged walls:
const reach = Geo.movementReach(dmap, { c: 0, r: 1, speed: 30 });
ok("engine movement is blocked by the bridged wall (can't cross x=2)", !reach["3,1"] && !reach["4,1"]);
ok("engine LOS is blocked through the bridged wall", !Geo.losVerdict(dmap, { c: 0, r: 1 }, { c: 4, r: 1 }).canTarget);

// tiered heights from room depth
const tdungeon = Object.assign({}, dungeon, {
  roomId: [10,10,0,20,20, 10,10,0,20,20, 10,10,0,20,0],
  rooms: [{ id: 10, depth: 0 }, { id: 20, depth: 4 }],
});
const tmap = Bridge.dungeonToMap(tdungeon, { tiered: true, tierOf: r => Math.round((1 - r.depth / 4) * 5) });
ok("entrance room sits a full tier above the deep room",
   Geo.heightAt(tmap, 0, 0) === 25 && Geo.heightAt(tmap, 3, 0) === 0);
ok("a same-tier step inside a room stays walkable",
   Geo.stepAllowed(tmap, { climb: false }, 0, 0, 0, 1));

// ── a tiny topography heightfield ───────────────────────────────────────
// 4x1, a 2-tier shelf on the right; leftmost tile is deep water.
const field = {
  W: 4, H: 1,
  height: Float32Array.from([0, 0, 2, 2]),
  type: Uint8Array.from([Bridge.TYPE.T_WATER, Bridge.TYPE.T_GRASS, Bridge.TYPE.T_GRASS, Bridge.TYPE.T_STONE]),
  props: [],
};
const fmap = Bridge.fieldToMap(field);
ok("heightfield → feet at 5 ft per level", Geo.heightAt(fmap, 1, 0) === 0 && Geo.heightAt(fmap, 2, 0) === 10);
ok("deep water becomes a wall", Geo.isWall(fmap, 0, 0) && !Geo.isWall(fmap, 1, 0));
ok("the 10 ft shelf is a cliff (blocked) for a walker",
   !Geo.stepAllowed(fmap, { climb: false }, 1, 0, 2, 0));
ok("a climber can take the same shelf",
   Geo.stepAllowed(fmap, { climb: true }, 1, 0, 2, 0));

// malformed payload fails loud
ok("validate rejects a mismatched map", !Bridge.validate({ cols: 3, rows: 3, h: [0], wall: [] }).ok);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
