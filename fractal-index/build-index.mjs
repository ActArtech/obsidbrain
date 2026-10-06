#!/usr/bin/env node
// build-index.mjs — rebuild Fractal Index maps DIRECTLY ON DISK (no Obsidian needed).
//
//   node build-index.mjs <vaultPath>              # rebuild every brain in the vault
//   node build-index.mjs <vaultPath> Garden       # rebuild one brain
//
// Fresh generation with the current layout engine (balanced grid v2,
// relationship-aware curved arrows). The interactive ea-script remains the
// tool for adoption/position-preserving regeneration; this tool is the
// clean-slate rebuild.

import fs from "node:fs";
import path from "node:path";

const CFG = {
  indexName: "_index.excalidraw.md",
  maxItems: 500,
  maxLinks: 60,
  layoutVersion: 2,
  fileCard: { w: 230, h: 64, cols: 5, gx: 36, gy: 26, fontSize: 20 },
  pod: { w: 380, h: 300, gapY: 60, gapX: 60, fontSize: 26 },
  embed: { marginX: 20, topOffset: 96, bottomMargin: 16 },
  colors: { folderStroke: "#8b5cf6", arrow: "#c4c4c4", link: "#a78bfa", muted: "#8a8a8a", text: "#1e1e1e" },
  gridY0: 160,
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
const linksOf = new Map(); // rel md path → resolved target rel paths
const byPath = new Map(); // "a/b" and "a/b.md" → rel
const byBase = new Map(); // basename (no ext) → [rel]
for (const f of allFiles) {
  const rel = f.rel;
  byPath.set(rel, rel);
  const noExt = rel.replace(/\.md$/, "");
  byPath.set(noExt, rel);
  const base = path.basename(rel).replace(/\.md$/, "");
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(rel);
}
function resolveLink(srcRel, raw) {
  const t = raw.trim();
  if (byPath.has(t)) return byPath.get(t);
  const dir = path.posix.dirname(srcRel);
  const inFolder = path.posix.normalize(path.posix.join(dir, t));
  if (byPath.has(inFolder)) return byPath.get(inFolder);
  if (byPath.has(inFolder + ".md")) return byPath.get(inFolder + ".md");
  const hits = byBase.get(t.replace(/\.md$/, ""));
  if (hits && hits.length) return hits[0];
  return null;
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

/* ── find brains: roots = folders with _index whose parent has none ── */
const indexPaths = allFiles.filter((f) => path.basename(f.rel) === CFG.indexName).map((f) => f.rel);
const brains = [];
for (const ip of indexPaths) {
  const dir = path.posix.dirname(ip);
  const parentDir = dir.includes("/") ? path.posix.dirname(dir) : "";
  if (!indexPaths.includes((parentDir ? parentDir + "/" : "") + CFG.indexName)) {
    brains.push(dir === "." ? "" : dir);
  }
}
const targets = onlyBrain ? brains.filter((b) => b === onlyBrain) : brains;
if (!targets.length) { console.error("no brains found" + (onlyBrain ? " matching " + onlyBrain : "")); process.exit(1); }

/* ── deterministic id ── */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h >>> 0;
}
const sid = (seed) => "fi" + hash(seed).toString(36) + (hash(seed + "#2") % 1679616).toString(36).padStart(4, "0");
const wl = (p) => "[[" + String(p).replace(/([\[\]|])/g, "\\$1") + "]]";

/* ── element factory (full schema, plugin-compatible) ── */
function el(type, seed, x, y, w, h, extra = {}) {
  return {
    id: sid(seed), type, x, y, width: w, height: h, angle: 0,
    strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
    strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100,
    roundness: null, seed: 1, version: 1, versionNonce: 1,
    updated: 1, isDeleted: false, boundElements: [], groupIds: [],
    frameId: null, link: null, locked: false, ...extra,
  };
}
function textEl(seed, x, y, str, { size = 20, color = "#1e1e1e", align = "left", link = null } = {}) {
  const lines = String(str).split("\n");
  const w = Math.ceil(Math.max(...lines.map((l) => l.length), 1) * size * 0.58);
  const h = Math.ceil(lines.length * size * 1.3);
  const e = el("text", "t|" + seed, x, y, w, h, {
    text: String(str), fontSize: size, fontFamily: 2, textAlign: align,
    verticalAlign: "top", containerId: null, originalText: String(str), lineHeight: 1.3, autoResize: true, link,
  });
  return e;
}

function buildFolderIndex(folderRel) {
  const abs = path.join(vault, folderRel);
  const prefix = folderRel ? folderRel + "/" : "";
  const elements = [];
  const add = (e, key, kind, slot) => {
    e.customData = { fractalIndex: true, key, basename: path.basename(key.replace(/^[a-z]+\|/, "").replace(/\|.*$/, "") || folderRel), kind, slot };
    elements.push(e);
    return e;
  };

  const children = fs.existsSync(abs)
    ? fs.readdirSync(abs, { withFileTypes: true }).filter((e) => !e.name.startsWith("."))
    : [];
  const subfolders = children.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const files = children.filter((e) => e.isFile() && e.name !== CFG.indexName).map((e) => e.name).sort();
  const filesCapped = files.slice(0, CFG.maxItems);
  const subfoldersCapped = subfolders.slice(0, Math.max(0, CFG.maxItems - filesCapped.length));

  /* slots (balanced grid) */
  const podCols = Math.max(1, Math.min(subfoldersCapped.length, Math.ceil(Math.sqrt(subfoldersCapped.length * 1.5))));
  const podRows = Math.ceil(subfoldersCapped.length / podCols);
  const podsBottom = CFG.gridY0 + podRows * (CFG.pod.h + CFG.pod.gapY) - CFG.pod.gapY;
  const fileCols = Math.max(CFG.fileCard.cols, podCols);
  const podPos = (s) => ({ x: (s % podCols) * (CFG.pod.w + CFG.pod.gapX), y: CFG.gridY0 + Math.floor(s / podCols) * (CFG.pod.h + CFG.pod.gapY) });
  const filePos = (s) => ({ x: 40 + (s % fileCols) * (CFG.fileCard.w + CFG.fileCard.gx), y: podsBottom + 80 + Math.floor(s / fileCols) * (CFG.fileCard.h + CFG.fileCard.gy) });

  /* title */
  const isRoot = !folderRel;
  const title = textEl("title|" + folderRel, 0, 0, "🧠 " + (isRoot ? "Vault" : path.basename(folderRel)), { size: 36 });
  title.customData = { fractalIndex: true, key: "title|" + folderRel, basename: path.basename(folderRel), kind: "title", slot: 0, layoutVersion: CFG.layoutVersion };
  elements.push(title);

  /* breadcrumb */
  const parentIndexPath = isRoot ? null : path.posix.dirname(folderRel) + "/" + CFG.indexName;
  if (!isRoot && indexPaths.includes(parentIndexPath.replace(/^\.\//, ""))) {
    const bc = textEl("bc|" + folderRel, 0, 62, "↑ " + (path.posix.dirname(folderRel) === "." ? "vault" : path.posix.basename(path.posix.dirname(folderRel))) + "/", { size: 18, color: "#8a8a8a", link: wl(parentIndexPath) });
    bc.customData = { fractalIndex: true, key: "bc|" + folderRel, basename: "..", kind: "breadcrumb", slot: 0 };
    elements.push(bc);
  }

  /* pods */
  subfoldersCapped.forEach((name, slot) => {
    const key = "pod|" + prefix + name;
    const { x, y } = podPos(slot);
    const subIndexPath = prefix + name + "/" + CFG.indexName;
    const hasIndex = indexPaths.includes(subIndexPath);
    add(el("frame", key + "|frame", x, y, CFG.pod.w, CFG.pod.h, { name: " ", strokeColor: "#8b5cf6", strokeWidth: 2 }), key + "|frame", name, slot);
    const motif = add(el("rectangle", key + "|motif", x + 8, y + 8, CFG.pod.w - 16, CFG.pod.h - 16, { strokeColor: "#8b5cf6", strokeStyle: "dashed", strokeWidth: 1 }), key + "|motif", name, slot);
    motif.strokeStyle = "dashed";
    const label = add(textEl(key + "|label", x + 16, y + 14, "📁 " + name + "  (" + fs.readdirSync(path.join(abs, name)).length + ")", { size: CFG.pod.fontSize, color: "#8b5cf6", link: hasIndex ? wl(subIndexPath) : null }), key + "|label", name, slot);
    if (hasIndex) {
      add(el("embeddable", key + "|embed", x + CFG.embed.marginX, y + CFG.embed.topOffset, CFG.pod.w - 2 * CFG.embed.marginX, CFG.pod.h - CFG.embed.topOffset - CFG.embed.bottomMargin,
        { strokeColor: "#8b5cf6", link: wl(subIndexPath), scale: [1, 1] }), key + "|embed", name, slot);
    } else {
      add(textEl(key + "|hint", x + CFG.embed.marginX, y + CFG.embed.topOffset, "(no _index yet — run Fractal Index inside\nthis subfolder to grow the fractal)", { size: 16, color: "#8a8a8a" }), key + "|hint", name, slot);
    }
    add(textEl(key + "|dive", x + CFG.pod.w - 150, y - 24, "⤢ click pod to dive", { size: 14, color: "#a78bfa", align: "right" }), key + "|dive", name, slot);
  });

  /* file cards */
  const iconFor = (name) =>
    /\.md$/.test(name) ? "📝" : /\.(png|jpg|jpeg|gif|svg|webp|avif)$/.test(name) ? "🖼️" : /\.pdf$/.test(name) ? "📕" : "📄";
  filesCapped.forEach((name, slot) => {
    const key = "file|" + prefix + name;
    const { x, y } = filePos(slot);
    const card = add(textEl(key, x, y, iconFor(name) + " " + path.basename(name).replace(/\.md$/, ""), {
      size: CFG.fileCard.fontSize, link: wl(prefix + name),
    }), key, name, slot);
    // card box
    const box = el("rectangle", key + "|box", x - 10, y - 10, card.width + 20, card.height + 20, { strokeColor: "#1e1e1e", strokeWidth: 1 });
    box.customData = { fractalIndex: true, key, basename: name, kind: "file-box", slot };
    elements.splice(elements.length - 1, 0, box);
  });

  /* spine + stubs (first row) */
  if (subfoldersCapped.length) {
    const spineY = CFG.gridY0 - 40;
    const centers = subfoldersCapped.map((name, slot) => podPos(slot).x + CFG.pod.w / 2);
    const spine = el("arrow", "spine|" + folderRel, 0, spineY, Math.max(...centers), 0, {
      points: [[0, 0], [Math.max(...centers), 0]], strokeColor: "#c4c4c4", strokeStyle: "dashed", elbowed: true,
    });
    spine.customData = { fractalIndex: true, key: "spine|" + folderRel, basename: path.basename(folderRel), kind: "spine", slot: 0 };
    elements.push(spine);
    subfoldersCapped.forEach((name, slot) => {
      const { x } = podPos(slot);
      const { y } = podPos(slot);
      if (y > CFG.gridY0) return; // later rows: no stub
      const cx = x + CFG.pod.w / 2;
      const a = el("arrow", "pod|" + prefix + name + "|arrow", cx, spineY, 0, y - 4 - spineY, {
        points: [[0, 0], [0, y - 4 - spineY]], strokeColor: "#c4c4c4", strokeStyle: "dashed", elbowed: true,
        startArrowhead: null, endArrowhead: "arrow",
      });
      a.customData = { fractalIndex: true, key: "pod|" + prefix + name + "|arrow", basename: name, kind: "arrow", slot };
      elements.push(a);
    });
  }

  /* ── ExcaliBrain dimension: link arrows from resolved wikilinks ── */
  const cardRect = new Map();
  for (const f of filesCapped) {
    const key = "file|" + prefix + f;
    const card = elements.find((e) => e.customData?.key === key && e.type === "text");
    if (card) cardRect.set(prefix + f, { x: card.x - 10, y: card.y - 10, w: card.width + 20, h: card.height + 20 });
  }
  for (const name of subfoldersCapped) {
    const { x, y } = podPos(subfoldersCapped.indexOf(name));
    cardRect.set(prefix + name + "/", { x, y, w: CFG.pod.w, h: CFG.pod.h });
  }
  const podKeys = subfoldersCapped.map((n) => prefix + n + "/");
  const edges = new Map();
  const addEdge = (src, dst, w) => {
    const k = src + "=>" + dst;
    const e = edges.get(k);
    if (e) e.weight += w;
    else edges.set(k, { src, dst, weight: w });
  };
  for (const f of filesCapped) {
    const targets = linksOf.get(prefix + f) || {};
    for (const tp in targets) {
      if (cardRect.has(tp)) addEdge(prefix + f, tp, targets[tp]);
      for (const pk of podKeys) {
        if (tp === pk || tp.startsWith(pk)) addEdge(prefix + f, pk, 1);
      }
    }
  }
  for (const src in linksOf) {
    for (const pk of podKeys) {
      if (src.startsWith(pk.slice(0, -1) + "/")) {
        const targets = linksOf.get(src);
        for (const tp in targets) {
          if (!targets[tp]) continue;
          if (cardRect.has(tp) && !tp.endsWith("/")) addEdge(pk, tp, 1);
          else for (const pk2 of podKeys) {
            if (pk2 !== pk && (tp === pk2 || tp.startsWith(pk2))) addEdge(pk, pk2, 1);
          }
        }
      }
    }
  }
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
  const drawn = merged.slice(0, CFG.maxLinks);
  const classifyRel = (a, b, mutual) => {
    if (mutual) return "resonates";
    const aPod = a.endsWith("/"), bPod = b.endsWith("/");
    if (aPod && bPod) return "bridges";
    if (aPod && !bPod) return "nourishes";
    if (!aPod && bPod) return "feeds";
    return "peer";
  };
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
    const ra = cardRect.get(e.a), rb = cardRect.get(e.b);
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
    const a = el("arrow", key, p1[0] + ox, p1[1] + oy,
      Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1]), {
      points: [[0, 0], [p2[0] - p1[0], p2[1] - p1[1]]],
      strokeColor: style.color, strokeWidth: style.w, strokeStyle: style.dash,
      opacity: style.op, roundness: { type: 1 },
      startArrowhead: e.mutual ? "arrow" : null, endArrowhead: "arrow",
    });
    a.customData = { fractalIndex: true, key, basename: path.basename(e.a), kind: "link", slot: 0, rel };
    elements.push(a);
  }

  return elements;
}

/* ── serialize to .excalidraw.md ── */
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
    ...(e.type === "frame" && e.name !== undefined ? { name: e.name } : {}),
    ...(e.customData ? { customData: e.customData } : {}),
  }));
  const textSection = full.filter((e) => e.type === "text").map((t) => `${t.text.split("\n").join(" ")} ^${t.id}`).join("\n");
  const scene = { type: "excalidraw", version: 2, source: "fractal-index build-index", elements: full, appState: { grid: null, viewBackgroundColor: "#ffffff" }, files: {} };
  return ["---", "excalidraw-plugin: parsed", "tags: [excalidraw]", "---", "",
    "# Excalidraw Data", "## Text Elements", textSection, "",
    "## Drawing", "```json", JSON.stringify(scene, null, 2), "```", ""].join("\n");
}

/* ── rebuild targets: top-down so breadcrumbs/embeds reference existing files ── */
let generated = 0;
for (const brain of targets) {
  const prefix = brain ? brain + "/" : "";
  const folders = [brain, ...all.filter((e) => e.dir && (brain ? e.rel.startsWith(prefix) : true)).map((e) => e.rel)]
    .filter((f, i, a) => a.indexOf(f) === i)
    .sort((a, b) => a.split("/").length - b.split("/").length);
  for (const folder of folders) {
    const els = buildFolderIndex(folder);
    const out = path.join(vault, folder, CFG.indexName);
    fs.writeFileSync(out, toMD(els), "utf8");
    generated++;
    console.log("  ✓", (folder || "(vault root)") + "/" + CFG.indexName, "—", els.length, "elements");
  }
}
console.log(`\nrebuilt ${generated} index drawings (layout v${CFG.layoutVersion}, balanced grid, relationship arrows)`);
