#!/usr/bin/env node
// build-index.mjs — rebuild Fractal Index maps DIRECTLY ON DISK (no Obsidian).
//
//   node build-index.mjs <vaultPath> [brainFolder]
//
// Component-based generation: Title/Breadcrumb/Pod/FileCard components measure
// themselves; the layout solver packs them with a zero-overlap invariant.
// Layout v3.

import fs from "node:fs";
import path from "node:path";
import { Title, Breadcrumb, Pod, FileCard } from "./lib/components.mjs";
import { compose } from "./lib/layout.mjs";

const CFG = {
  indexName: "_index.excalidraw.md",
  maxItems: 500,
  maxLinks: 60,
  layoutVersion: 3,
  maxWidth: 2300,
  gapX: 60,
  gapY: 60,
};
const REL_STYLE = {
  resonates: { w: 2.5, dash: "solid", op: 100, color: "#7c3aed" },
  peer: { w: 1.5, dash: "solid", op: 100, color: "#8b5cf6" },
  bridges: { w: 2, dash: "dashed", op: 70, color: "#2563eb" },
  nourishes: { w: 1.5, dash: "dotted", op: 70, color: "#7c6f9e" },
  feeds: { w: 1, dash: "dotted", op: 50, color: "#a78bfa" },
};

const vault = path.resolve(process.argv[2] || ".");
const onlyBrain = process.argv[3] || null;
if (!fs.existsSync(vault)) { console.error("vault not found: " + vault); process.exit(1); }

/* ── vault scan ── */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { out.push({ path: p, dir: true }); walk(p, out); }
    else out.push({ path: p, dir: false });
  }
  return out;
}
const all = walk(vault).map((e) => ({
  abs: e.path,
  rel: path.relative(vault, e.path).split(path.sep).join("/"),
  dir: e.dir,
}));
const allFiles = all.filter((e) => !e.dir);
const mdFiles = allFiles.filter((f) => f.rel.endsWith(".md"));

/* ── wikilink extraction + resolution ── */
const linksOf = new Map();
const byPath = new Map();
const byBase = new Map();
for (const f of allFiles) {
  byPath.set(f.rel, f.rel);
  byPath.set(f.rel.replace(/\.md$/, ""), f.rel);
  const base = path.basename(f.rel).replace(/\.md$/, "");
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(f.rel);
}
function resolveLink(srcRel, raw) {
  const t = raw.trim();
  if (byPath.has(t)) return byPath.get(t);
  const inFolder = path.posix.normalize(path.posix.join(path.posix.dirname(srcRel), t));
  if (byPath.has(inFolder)) return byPath.get(inFolder);
  if (byPath.has(inFolder + ".md")) return byPath.get(inFolder + ".md");
  const hits = byBase.get(t.replace(/\.md$/, ""));
  return hits && hits.length ? hits[0] : null;
}
for (const f of mdFiles) {
  const content = fs.readFileSync(f.abs, "utf8");
  const resolved = {};
  for (const m of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    const target = resolveLink(f.rel, m[1]);
    if (target && target !== f.rel) resolved[target] = (resolved[target] || 0) + 1;
  }
  if (Object.keys(resolved).length) linksOf.set(f.rel, resolved);
}

/* ── brains ── */
const indexPaths = allFiles.filter((f) => path.basename(f.rel) === CFG.indexName).map((f) => f.rel);
const brains = [];
for (const ip of indexPaths) {
  const dir = path.posix.dirname(ip);
  const parentDir = dir.includes("/") ? path.posix.dirname(dir) : "";
  if (!indexPaths.includes((parentDir ? parentDir + "/" : "") + CFG.indexName)) brains.push(dir === "." ? "" : dir);
}
const targets = onlyBrain ? brains.filter((b) => b === onlyBrain) : brains;
if (!targets.length) { console.error("no brains found"); process.exit(1); }

/* ── link graph helpers ── */
function classifyRel(a, b, mutual) {
  if (mutual) return "resonates";
  const aPod = a.endsWith("/"), bPod = b.endsWith("/");
  if (aPod && bPod) return "bridges";
  if (aPod && !bPod) return "nourishes";
  if (!aPod && bPod) return "feeds";
  return "peer";
}
function buildEdges(prefix, files, podKeys) {
  const edges = new Map();
  const addEdge = (src, dst, w) => {
    const k = src + "=>" + dst;
    const e = edges.get(k);
    if (e) e.weight += w;
    else edges.set(k, { src, dst, weight: w });
  };
  for (const f of files) {
    const targets = linksOf.get(prefix + f) || {};
    for (const tp in targets) {
      if (!targets[tp]) continue;
      if (podKeys.some((pk) => tp === pk)) { addEdge(prefix + f, podKeys.find((pk) => tp === pk), 1); continue; }
      const inPod = podKeys.find((pk) => tp.startsWith(pk));
      if (inPod) { addEdge(prefix + f, inPod, 1); continue; }
      if (files.includes(tp.slice(prefix.length)) && tp.startsWith(prefix)) addEdge(prefix + f, tp, targets[tp]);
    }
  }
  for (const src in linksOf) {
    if (!src.startsWith(prefix)) continue;
    const rel = src.slice(prefix.length);
    const top = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : null;
    if (top && files.includes(top + "/")) continue;
    if (files.includes(rel)) continue; // own files already handled
    const inPod = top && podKeys.includes(prefix + top + "/") ? prefix + top + "/" : null;
    if (!inPod && !top) continue;
    const srcKey = inPod ?? null;
    if (!srcKey) continue;
    const targets = linksOf.get(src);
    for (const tp in targets) {
      if (!targets[tp] || tp === src) continue;
      if (podKeys.includes(tp)) { addEdge(srcKey, tp, 1); continue; }
      const tpInPod = podKeys.find((pk) => tp.startsWith(pk));
      if (tpInPod) { addEdge(srcKey, tpInPod, 1); continue; }
      if (tp.startsWith(prefix) && files.includes(tp.slice(prefix.length))) addEdge(srcKey, tp, 1);
    }
  }
  return edges;
}
function mergeMutual(edges) {
  const merged = [];
  const seen = new Set();
  for (const [k, e] of [...edges.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (seen.has(k)) continue;
    const rev = e.dst + "=>" + e.src;
    const r = edges.get(rev);
    seen.add(k);
    if (r) { seen.add(rev); merged.push({ a: e.src, b: e.dst, weight: e.weight + r.weight, mutual: true }); }
    else merged.push({ a: e.src, b: e.dst, weight: e.weight, mutual: false });
  }
  merged.sort((x, y) => y.weight - x.weight || (x.a + x.b < y.a + y.b ? -1 : 1));
  return merged.slice(0, CFG.maxLinks);
}

/* ── element factory (mirror of lib/components.mjs internals) ── */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h >>> 0;
}
const sid = (seed) => "fi" + hash(seed).toString(36) + (hash(seed + "#2") % 1679616).toString(36).padStart(4, "0");
function el(type, seed, x, y, w, h, extra = {}) {
  return {
    id: sid(seed), type, x, y, width: w, height: h, angle: 0,
    strokeColor: extra.color || "#1e1e1e", backgroundColor: extra.fill || "transparent",
    fillStyle: "solid", strokeWidth: extra.strokeWidth || 1, strokeStyle: extra.dash || "solid",
    roughness: 1, opacity: extra.op ?? 100, roundness: extra.round ?? null,
    seed: 1, version: 1, versionNonce: 1, updated: 1, isDeleted: false,
    boundElements: [], groupIds: [], frameId: null, link: extra.link ?? null, locked: false,
    ...(type === "arrow" ? { points: extra.points, startArrowhead: extra.startArrowhead ?? null, endArrowhead: extra.endArrowhead ?? "arrow" } : {}),
    ...(type === "embeddable" ? { scale: [1, 1] } : {}),
    ...(type === "text" ? { text: extra.text || "", fontSize: extra.fontSize || 20, fontFamily: 2, textAlign: "left", verticalAlign: "top", containerId: null, originalText: extra.text || "", lineHeight: 1.3, autoResize: true } : {}),
    ...(seed.startsWith("podframe|") ? { name: " " } : {}),
    ...(extra.customData ? { customData: extra.customData } : {}),
  };
}

/* ── build one folder's index from components + solver ── */
function buildFolderIndex(folderRel) {
  const abs = path.join(vault, folderRel);
  const prefix = folderRel ? folderRel + "/" : "";
  const children = fs.existsSync(abs)
    ? fs.readdirSync(abs, { withFileTypes: true }).filter((e) => !e.name.startsWith("."))
    : [];
  const subfolders = children.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const files = children.filter((e) => e.isFile() && e.name !== CFG.indexName).map((e) => e.name).sort();
  const filesCapped = files.slice(0, CFG.maxItems);
  const subfoldersCapped = subfolders.slice(0, Math.max(0, CFG.maxItems - filesCapped.length));
  const podKeys = subfoldersCapped.map((n) => prefix + n + "/");

  /* components */
  const isRoot = !folderRel;
  const title = Title({ text: "🧠 " + (isRoot ? "Vault" : path.basename(folderRel)), size: 36 });
  const sections = [{ name: "header", components: [title], gapBefore: 40, gapY: 8 }];
  if (!isRoot) {
    const parentDir = path.posix.dirname(folderRel);
    const parentIndexPath = parentDir + "/" + CFG.indexName;
    if (indexPaths.includes(parentIndexPath)) {
      sections.push({
        name: "breadcrumb",
        components: [Breadcrumb({ text: "↑ " + path.posix.basename(parentDir) + "/", link: parentIndexPath })],
        gapBefore: 16, gapY: 4,
      });
    }
  }
  sections.push({
    name: "pods",
    components: subfoldersCapped.map((name) => Pod({
      name,
      childCount: fs.readdirSync(path.join(abs, name)).length,
      embedPath: indexPaths.includes(prefix + name + "/" + CFG.indexName) ? prefix + name + "/" + CFG.indexName : null,
    })),
    gapBefore: 60,
  });
  sections.push({
    name: "files",
    components: filesCapped.map((name) => FileCard({
      icon: /\.md$/.test(name) ? "📝" : /\.(png|jpg|jpeg|gif|svg|webp|avif)$/.test(name) ? "🖼️" : /\.pdf$/.test(name) ? "📕" : "📄",
      name: name.replace(/\.md$/, ""),
      link: prefix + name,
    })),
    gapBefore: 80,
  });

  /* solve layout (throws on any overlap) */
  const { placedBySection, elementChunks, height } = compose(sections, { maxWidth: CFG.maxWidth, gapX: CFG.gapX, gapY: CFG.gapY });

  const elements = [];
  const KIND_BY_SEED = {
    podframe: ["frame", ""], podmotif: ["pod-motif", "motif"], podlabel: ["pod-label", "label"],
    podembed: ["embed", "embed"], podhint: ["hint", "hint"], chip: ["dive-hint", "dive"],
  };
  for (const chunk of elementChunks) {
    for (const spec of chunk.els) {
      const e = spec.make(spec.seed);
      // derive semantic identity from the component seed:
      //   podframe|<folder-name>  -> pod|<prefix><name>|frame   (etc.)
      //   cardbox|<file-name>     -> file|<prefix><name>         (etc.)
      const podM = spec.seed.match(/^(podframe|podmotif|podlabel|podembed|podhint|chip)\|(.*)$/);
      const cardM = spec.seed.match(/^(cardbox|cardtext)\|(.*)$/);
      if (podM) {
        const suffix = KIND_BY_SEED[podM[1]][1];
        e.customData = {
          fractalIndex: true,
          key: "pod|" + prefix + podM[2] + (suffix ? "|" + suffix : ""),
          basename: podM[2], kind: KIND_BY_SEED[podM[1]][0], slot: 0,
        };
      } else if (cardM) {
        e.customData = {
          fractalIndex: true,
          key: "file|" + prefix + cardM[2],
          basename: cardM[2], kind: cardM[1] === "cardbox" ? "file-box" : "file", slot: 0,
        };
      } else if (spec.seed.startsWith("title|") || spec.seed.startsWith("bc|")) {
        e.customData = {
          fractalIndex: true,
          key: (spec.seed.startsWith("title|") ? "title|" : "bc|") + folderRel,
          basename: path.basename(folderRel), kind: spec.seed.startsWith("title|") ? "title" : "breadcrumb", slot: 0,
        };
      }
      elements.push(e);
    }
  }

  /* spine + orthogonal stubs down to first-row pods */
  const podPlacements = placedBySection.filter((p) => p.section === "pods");
  if (podPlacements.length) {
    const spineY = podPlacements[0].y - 44;
    const lastX = Math.max(...podPlacements.map((p) => p.x + p.w / 2));
    elements.push(el("arrow", "spine|" + folderRel, 0, spineY, lastX, 0, {
      points: [[0, 0], [lastX, 0]], color: "#c4c4c4", dash: "dashed", elbowed: true,
      customData: { fractalIndex: true, key: "spine|" + folderRel, basename: path.basename(folderRel), kind: "spine", slot: 0 },
    }));
    for (const p of podPlacements) {
      if (p.y > podPlacements[0].y) continue; // later rows: no stub
      const cx = p.x + p.w / 2;
      elements.push(el("arrow", "stub|" + p.item.label, cx, spineY, 0, p.y - 4 - spineY, {
        points: [[0, 0], [0, p.y - 4 - spineY]], color: "#c4c4c4", dash: "dashed", elbowed: true,
        startArrowhead: null, endArrowhead: "arrow",
        customData: { fractalIndex: true, key: "stub|" + p.item.label, basename: p.item.label, kind: "arrow", slot: 0 },
      }));
    }
  }

  /* ── link arrows between placed components ── */
  const podByKey = new Map();
  const cardByKey = new Map();
  for (const p of placedBySection) {
    const label = p.item.label || p.item.name || "";
    if (p.section === "pods") podByKey.set(prefix + label + "/", { x: p.x, y: p.y, w: p.w, h: p.h });
    if (p.section === "files") cardByKey.set(prefix + label + ".md", { x: p.x, y: p.y, w: p.w, h: p.h });
  }
  const edges = buildEdges(prefix, filesCapped.map((f) => f), podKeys);
  const drawn = mergeMutual(edges);
  const anchor = (r, toward) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const dx = toward.x + toward.w / 2 - cx, dy = toward.y + toward.h / 2 - cy;
    if (!dx && !dy) return [cx, cy];
    const s = Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
    return [cx + dx * s, cy + dy * s];
  };
  const bySrc = new Map();
  for (const e of drawn) { if (!bySrc.has(e.a)) bySrc.set(e.a, []); bySrc.get(e.a).push(e); }
  const srcIndex = new Map();
  for (const [, list] of bySrc) list.forEach((e, i) => srcIndex.set(e, i));

  for (const e of drawn) {
    const ra = podByKey.get(e.a) || cardByKey.get(e.a);
    const rb = podByKey.get(e.b) || cardByKey.get(e.b);
    if (!ra || !rb) continue;
    const p1 = anchor(ra, rb), p2 = anchor(rb, ra);
    const rel = classifyRel(e.a, e.b, e.mutual);
    const style = REL_STYLE[rel];
    const siblings = bySrc.get(e.a) || [];
    let ox = 0, oy = 0;
    if (siblings.length > 1) {
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy) || 1;
      const off = ((srcIndex.get(e) || 0) - (siblings.length - 1) / 2) * 14;
      ox = (-dy / len) * off; oy = (dx / len) * off;
    }
    const key = "link|" + e.a + "=>" + e.b;
    elements.push(el("arrow", key, p1[0] + ox, p1[1] + oy, Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1]), {
      points: [[0, 0], [p2[0] - p1[0], p2[1] - p1[1]]],
      color: style.color, strokeWidth: style.w, dash: style.dash, op: style.op,
      round: { type: 1 }, startArrowhead: e.mutual ? "arrow" : null, endArrowhead: "arrow",
      customData: { fractalIndex: true, key, basename: path.basename(e.a), kind: "link", slot: 0, rel },
    }));
  }

  return { elements, height };
}

/* ── serialize ── */
function toMD(elements) {
  const full = elements.map((e) => ({
    id: e.id, type: e.type,
    x: Math.round(e.x * 100) / 100, y: Math.round(e.y * 100) / 100,
    width: Math.round(e.width * 100) / 100, height: Math.round(e.height * 100) / 100,
    angle: 0, strokeColor: e.strokeColor, backgroundColor: e.backgroundColor || "transparent",
    fillStyle: e.fillStyle || "solid", strokeWidth: e.strokeWidth || 1,
    strokeStyle: e.strokeStyle || "solid", roughness: e.roughness ?? 1, opacity: e.opacity ?? 100,
    roundness: e.roundness ?? null, seed: e.seed ?? 1, version: e.version ?? 1, versionNonce: 1,
    updated: 1, isDeleted: false, boundElements: e.boundElements || [], groupIds: [],
    frameId: null, link: e.link || null, locked: false,
    ...(e.type === "text" ? {
      text: e.text, fontSize: e.fontSize, fontFamily: e.fontFamily || 2,
      textAlign: e.textAlign || "left", verticalAlign: "top", containerId: null,
      originalText: e.text, lineHeight: 1.3, autoResize: true,
    } : {}),
    ...(e.type === "arrow" ? { points: e.points, startArrowhead: e.startArrowhead ?? null, endArrowhead: e.endArrowhead ?? "arrow" } : {}),
    ...(e.type === "embeddable" ? { scale: e.scale || [1, 1] } : {}),
    ...(e.customData ? { customData: e.customData } : {}),
  }));
  const textSection = full.filter((e) => e.type === "text").map((t) => `${t.text.split("\n").join(" ")} ^${t.id}`).join("\n");
  const scene = { type: "excalidraw", version: 2, source: "fractal-index build-index v3", elements: full, appState: { grid: null, viewBackgroundColor: "#ffffff" }, files: {} };
  return ["---", "excalidraw-plugin: parsed", "tags: [excalidraw]", "---", "",
    "# Excalidraw Data", "## Text Elements", textSection, "",
    "## Drawing", "```json", JSON.stringify(scene, null, 2), "```", ""].join("\n");
}

/* ── rebuild: top-down so embeds/breadcrumbs reference existing files ── */
let generated = 0;
for (const brain of targets) {
  const prefix = brain ? brain + "/" : "";
  const folders = [brain, ...all.filter((e) => e.dir && (brain ? e.rel.startsWith(prefix) : true)).map((e) => e.rel)]
    .filter((f, i, a) => a.indexOf(f) === i)
    .sort((a, b) => a.split("/").length - b.split("/").length);
  for (const folder of folders) {
    const { elements, height } = buildFolderIndex(folder);
    fs.writeFileSync(path.join(vault, folder, CFG.indexName), toMD(elements), "utf8");
    generated++;
    console.log("  ✓", (folder || "(vault root)") + "/" + CFG.indexName, "—", elements.length, "elements,", Math.round(height), "px tall");
  }
}
console.log(`\nrebuilt ${generated} index drawings (layout v${CFG.layoutVersion}: component-based, zero-overlap solver)`);
