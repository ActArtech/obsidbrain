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
export function installDemo(demo, vaultPath, { force = false } = {}) {
  if (!demo || !vaultPath) throw new Error("usage: node examples/install-demo.mjs <research-brain|project-hub|knowledge-garden> <vaultPath> [--force]");
  const manifestPath = path.join(HERE, demo, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("unknown demo: " + demo);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const root = path.join(path.resolve(vaultPath), manifest.root);
  if (fs.existsSync(root) && !force) throw new Error("refusing to overwrite existing " + root + " (use --force)");

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
  return { demo, files, indexes, root, firstIndex: path.join(manifest.root, manifest.indexes[0], "_index.excalidraw.md") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  try {
    const [demo, vaultPath, ...flags] = process.argv.slice(2);
    const result = installDemo(demo, vaultPath, { force: flags.includes("--force") });
    console.log(`${demo}: wrote ${result.files} notes and ${result.indexes} _index templates under ${result.root}`);
    console.log(`next: open ${result.firstIndex} in Obsidian and run "Fractal Index" there`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
