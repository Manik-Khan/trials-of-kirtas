#!/usr/bin/env node
"use strict";

const path = require("path");
const Party = require(path.resolve(__dirname, "..", "forge-party-selection.js"));
let pass = 0;
function ok(name, value) {
  if (!value) throw new Error("FAIL: " + name);
  pass++;
  console.log("ok", pass, "-", name);
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const rows = [
  { key: "caim", name: "Caim" },
  { key: "old-chonk", name: "Chonkalius", deleteMarked: true },
  { key: "chonk", name: "Chonkalius" },
  { key: "test", name: "Test Character" },
  { key: "caim", name: "Duplicate Caim row" }
];
const layout = {
  folders: [
    { id: "players", name: "Campaign Characters" },
    { id: "tests", name: "Tests" }
  ],
  members: { caim: "players", "old-chonk": "players", chonk: "players", test: "tests" }
};

ok("party-selection module is dual-exported", globalThis.ForgePartySelection === Party);
ok("canonical Campaign Characters folder is recognized", Party.playerFolder(layout).id === "players");
const result = Party.candidates(rows, layout);
ok("only active player-folder rows are candidates",
  same(result.rows.map(row => row.key), ["caim", "chonk"]));
ok("delete-marked duplicate never reaches candidates",
  !result.rows.some(row => row.key === "old-chonk"));
ok("characters outside the player folder never reach candidates",
  !result.rows.some(row => row.key === "test"));
ok("duplicate keys collapse before rendering", result.rows.filter(row => row.key === "caim").length === 1);
ok("only explicit eligible selections survive",
  same(Party.selectedKeys(result.rows, ["test", "chonk", "chonk", "caim"]), ["chonk", "caim"]));
ok("no selection yields no encounter party", same(Party.selectedKeys(result.rows, []), []));
const missing = Party.candidates(rows, { folders: [], members: {} });
ok("missing player folder fails closed instead of showing every row",
  !missing.ok && missing.rows.length === 0 && /folder/i.test(missing.reason));
ok("friendly Player Characters folder alias is recognized",
  Party.playerFolder({ folders: [{ id: "pc", name: "Player Characters" }] }).id === "pc");

console.log("\n" + pass + " party-selection checks green");
