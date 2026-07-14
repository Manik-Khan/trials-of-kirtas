#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
const geo=fs.readFileSync(path.join(root,"tactics-geometry.js"),"utf8").trim();
const start=html.indexOf("/* ════════════════════════════════════════════════════════════════════\n   tactics-geometry.js");
const endMarker='})(typeof window !== "undefined" ? window : globalThis);';
const end=start<0?-1:html.indexOf(endMarker,start)+endMarker.length;
if(start<0||end<endMarker.length)throw Error("FAIL: inlined canonical geometry not found");
const inline=html.slice(start,end).trim();
if(inline!==geo)throw Error("FAIL: topography inline geometry differs from forge/tactics-geometry.js");
console.log("ok 1 - topography inline geometry is byte-identical to canonical\n\n1 geometry-sync check green");
