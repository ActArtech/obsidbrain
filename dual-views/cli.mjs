#!/usr/bin/env node
// dual-views CLI — one hierarchy in, two projections out.
//
//   node cli.mjs --source sample/workitems.json --out test/out
//   node cli.mjs --source gh:owner/repo --out views [--limit 100]
//
// Outputs (in --out):
//   treemap.html              functionality-progress projection (Plotly)
//   story-map.excalidraw.md   JTBD/flow projection (Obsidian-Excalidraw)
//   story-map.svg             visual preview of the story map
//   timeline.excalidraw.md    Gantt-style progress timeline (Obsidian-Excalidraw)
//   workmap/                  fractal drill-down drawings
//
// If story-map.excalidraw.md already exists in --out, its slots are adopted so
// node positions survive regeneration.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { buildModel, treemapRows } from "./lib/hierarchy.mjs";
import { renderTreemapHTML } from "./lib/treemap-html.mjs";
import { buildStoryMap, toExcalidrawMD, toSVG, parseStoryMapElements } from "./lib/storymap-excalidraw.mjs";
import { buildTimeline, timelineToMD } from "./lib/timeline.mjs";
import { generateFractalViews } from "./lib/fractal-view.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { source: null, outDir: "out", limit: 100, title: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") out.source = argv[++i];
    else if (a === "--out") out.outDir = argv[++i];
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--title") out.title = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error("unknown argument: " + a);
  }
  if (!out.help && !out.source) throw new Error("--source is required (json:<file> | gh:<owner/repo> | <file.json>)");
  return out;
}

async function loadItems(source, limit) {
  if (source.startsWith("gh:")) {
    const { fetchGitHubWorkItems } = await import("./lib/github-source.mjs");
    return fetchGitHubWorkItems(source.slice(3), { limit });
  }
  const file = source.startsWith("json:") ? source.slice(5) : source;
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`cannot read source file '${file}' — ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`source file '${file}' is not valid JSON — ${e.message}`);
  }
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error(`source file '${file}' must contain an array or an { items: [...] } object`);
  return items;
}

export async function generate({ source, outDir, limit = 100, title }) {
  const items = await loadItems(source, limit);
  const model = buildModel(items);
  const rows = treemapRows(model);

  fs.mkdirSync(outDir, { recursive: true });

  // treemap projection
  const html = renderTreemapHTML(model, rows, {
    title: title || "Functionality Progress",
    storyMapHref: "story-map.excalidraw.md",
  });
  fs.writeFileSync(path.join(outDir, "treemap.html"), html, "utf8");

  // story-map projection, adopting slots from a previous run
  const prevPath = path.join(outDir, "story-map.excalidraw.md");
  const previous = fs.existsSync(prevPath) ? parseStoryMapElements(fs.readFileSync(prevPath, "utf8")) : [];
  const story = buildStoryMap(model, previous);
  fs.writeFileSync(prevPath, toExcalidrawMD(story.elements, { title: title || "Story Map" }), "utf8");
  fs.writeFileSync(path.join(outDir, "story-map.svg"), toSVG(story.elements), "utf8");

  // timeline projection (Gantt-style progress bars, adoption-aware)
  const tlPrevPath = path.join(outDir, "timeline.excalidraw.md");
  const tlPrev = fs.existsSync(tlPrevPath) ? parseStoryMapElements(fs.readFileSync(tlPrevPath, "utf8")) : [];
  const timeline = buildTimeline(model, tlPrev);
  fs.writeFileSync(tlPrevPath, timelineToMD(timeline.elements), "utf8");

  // fractal work map: per-outcome / per-capability Obsidian drill-down drawings
  const fractal = generateFractalViews(model, outDir);

  return {
    outcomes: model.outcomes.length,
    capabilities: model.capabilities.length,
    services: model.services.length,
    tasks: model.tasks.length,
    done: model.root.rollup.done,
    total: model.root.rollup.total,
    files: [
      "treemap.html",
      "story-map.excalidraw.md",
      "story-map.svg",
      "timeline.excalidraw.md",
      ...fractal.files.map((f) => path.join("workmap", f)),
    ].map((f) => path.join(outDir, f)),
    workmapFiles: fractal.files.length,
  };
}

// CLI entry (skip when imported as a module for tests)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(url.fileURLToPath(import.meta.url))) {
  (async () => {
    const args = parseArgs(process.argv);
    if (args.help) {
      console.log("node cli.mjs --source <json:file.json|gh:owner/repo> --out <dir> [--limit N] [--title T]");
      process.exit(0);
    }
    const r = await generate(args);
    console.log(
      `dual-views: ${r.outcomes} outcomes · ${r.capabilities} capabilities · ${r.services} services · ${r.tasks} tasks (${r.done}/${r.total} done)`
    );
    for (const f of r.files) console.log("  → " + f);
  })().catch((e) => {
    console.error("dual-views error:", e.message);
    process.exit(1);
  });
}
