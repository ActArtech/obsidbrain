#!/usr/bin/env node
// Install a Fractal Index example brain into a vault (or any folder).
//
//   node examples/install-demo.mjs <research-brain|project-hub> <vaultPath> [--force]
//
// Writes the demo's files (skipping existing ones unless --force) and drops an
// empty `_index.excalidraw.md` template into every indexed folder. After
// installing, open each `_index` in Obsidian and run the Fractal Index script —
// or let the automated pipeline generate them all.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const [demo, vaultPath, ...flags] = process.argv.slice(2);
if (!demo || !vaultPath) {
  console.error("usage: node examples/install-demo.mjs <research-brain|project-hub> <vaultPath> [--force]");
  process.exit(1);
}
const force = flags.includes("--force");

const manifestPath = path.join(HERE, demo, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("unknown demo: " + demo + " (expected research-brain | project-hub)");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const root = path.join(path.resolve(vaultPath), manifest.root);
if (fs.existsSync(root) && !force) {
  console.error("refusing to overwrite existing " + root + " (use --force)");
  process.exit(1);
}

const TEMPLATE = [
  "---",
  "excalidraw-plugin: parsed",
  "tags: [excalidraw]",
  "---",
  "",
  "# Excalidraw Data",
  "## Text Elements",
  "",
  "## Drawing",
  "```json",
  '{"type":"excalidraw","version":2,"source":"fractal-index-demo","elements":[],"appState":{"grid":null,"viewBackgroundColor":"#ffffff"},"files":{}}',
  "```",
  "",
].join("\n");

let files = 0, indexes = 0;
for (const [rel, content] of Object.entries(manifest.files)) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (force || !fs.existsSync(p)) {
    fs.writeFileSync(p, content, "utf8");
    files++;
  }
}
for (const folder of manifest.indexes) {
  const p = path.join(root, folder, "_index.excalidraw.md");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (force || !fs.existsSync(p)) {
    fs.writeFileSync(p, TEMPLATE, "utf8");
    indexes++;
  }
}
console.log(`${demo}: wrote ${files} notes and ${indexes} _index templates under ${root}`);
console.log(`next: open ${path.join(manifest.root, manifest.indexes[0], "_index.excalidraw.md")} in Obsidian and run "Fractal Index" there`);
