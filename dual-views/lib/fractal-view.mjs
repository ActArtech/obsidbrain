// Projection 3: fractal work map — Obsidian-native drill-down drawings.
//
// Generates a small tree of Excalidraw files (same writer as the story map,
// no Obsidian needed to generate, works from CI):
//
//   workmap/Work Map.excalidraw.md          outcome pods + live embeds ↓
//   workmap/<outcome-key>.excalidraw.md     capability cards + live embeds ↓
//   workmap/<capability-key>.excalidraw.md  task cards grouped by service,
//                                           linked to their issues
//
// Fractal behavior in Obsidian: every pod EMBEDS the next level's drawing
// (zoom in / engage to go deeper, breadcrumb link at every level to go up).
// Same guarantees as the other projections: deterministic generation, slot
// memory adopted from previous files so regeneration never moves anything,
// shared key space, status colors from the single model.

import fs from "node:fs";
import path from "node:path";
import { STATUS_COLORS } from "./hierarchy.mjs";
import { toExcalidrawMD as writeMD, parseStoryMapElements } from "./storymap-excalidraw.mjs";

const L = {
  titleFont: 32,
  podW: 560,
  podH: 340,
  podGap: 60,
  embedTop: 100,
  embedH: 210,
  cardW: 260,
  cardH: 64,
  cardCols: 3,
  cardGX: 30,
  cardGY: 24,
  sectionPitch: 260,
};

export function generateFractalViews(model, outDir, { dirName = "workmap" } = {}) {
  const wmDir = path.join(outDir, dirName);
  fs.mkdirSync(wmDir, { recursive: true });
  const prev = (name) => {
    const p = path.join(wmDir, name + ".excalidraw.md");
    return fs.existsSync(p) ? parseStoryMapElements(fs.readFileSync(p, "utf8")) : [];
  };
  const files = [];

  /* ── leaf level: one drawing per capability, task cards grouped by service ── */
  for (const c of model.capabilities) {
    const name = safeName(c.key);
    const els = buildCapabilityDrawing(model, c, prev(name));
    fs.writeFileSync(path.join(wmDir, name + ".excalidraw.md"), writeMD(els), "utf8");
    files.push(name + ".excalidraw.md");
  }

  /* ── middle level: one drawing per outcome, capability cards with embeds ── */
  for (const o of model.outcomes) {
    const name = safeName(o.key);
    const els = buildOutcomeDrawing(model, o, prev(name));
    fs.writeFileSync(path.join(wmDir, name + ".excalidraw.md"), writeMD(els), "utf8");
    files.push(name + ".excalidraw.md");
  }

  /* ── root: Work Map with outcome pods + embeds ── */
  const rootName = "Work Map";
  const rootEls = buildRootDrawing(model, prev(rootName));
  fs.writeFileSync(path.join(wmDir, rootName + ".excalidraw.md"), writeMD(rootEls), "utf8");
  files.push(rootName + ".excalidraw.md");

  return { dir: wmDir, files };
}

/* ══════════════ shared element factory (same conventions as story map) ════ */
function factory(previousElements) {
  const prevByKey = new Map();
  const prevPos = new Map(); // rawKey → {x, y}: MANUAL MOVES are adopted as truth
  const hiWater = {};
  for (const el of previousElements) {
    const cd = el.customData;
    if (!cd || cd.workmap !== true || !cd.rawKey) continue;
    if (!prevByKey.has(cd.rawKey)) prevByKey.set(cd.rawKey, cd);
    if (cd.space in hiWater && typeof cd.slot === "number") hiWater[cd.space] = Math.max(hiWater[cd.space], cd.slot);
    // anchors: pods → frame rectangle; tasks → card text (offset-adjusted)
    if ((cd.space === "pod" || cd.space === "card") && el.type === "rectangle" && !prevPos.has(cd.rawKey)) {
      prevPos.set(cd.rawKey, { x: el.x, y: el.y });
    }
    if (cd.space === "task" && el.type === "text" && !prevPos.has(cd.rawKey)) {
      prevPos.set(cd.rawKey, { x: el.x - 12, y: el.y - 10 });
    }
  }
  const adoptSlot = (rawKey, space) => {
    const p = prevByKey.get(rawKey);
    if (p && p.space === space && typeof p.slot === "number") return p.slot;
    if (!(space in hiWater)) hiWater[space] = -1;
    return ++hiWater[space];
  };
  const reserve = (space, upto) => {
    hiWater[space] = Math.max(hiWater[space] ?? -1, upto);
  };

  const els = [];
  const idOf = (seed) => "wm" + hash(seed).toString(36) + pad4(hash(seed + "#2") % 1679616);
  const text = (seed, x, y, str, { size = 20, family = 2, color = "#1e1e1e", link = null } = {}) => {
    const lines = String(str).split("\n");
    const w = Math.ceil(Math.max(...lines.map((l) => l.length), 1) * size * 0.58);
    const h = Math.ceil(lines.length * size * 1.3);
    const el = {
      id: idOf("t|" + seed), type: "text", x, y, width: w, height: h,
      text: String(str), fontSize: size, fontFamily: family, textAlign: "left",
      strokeColor: color, link,
    };
    els.push(el);
    return el;
  };
  const rect = (seed, x, y, w, h, { stroke = "#1e1e1e", fill = "transparent", width: sw = 1.5, round = true } = {}) => {
    const el = {
      id: idOf("r|" + seed), type: "rectangle", x, y, width: w, height: h,
      strokeColor: stroke, backgroundColor: fill, strokeWidth: sw, strokeStyle: "solid",
      roundness: round ? { type: 3 } : null,
    };
    els.push(el);
    return el;
  };
  const embed = (seed, x, y, w, h, targetFile) => {
    const el = {
      id: idOf("e|" + seed), type: "embeddable", x, y, width: w, height: h,
      strokeColor: "#8b5cf6", backgroundColor: "#f5f0ff", strokeWidth: 1,
      strokeStyle: "solid", roundness: { type: 3 }, link: `[[${targetFile}.excalidraw.md]]`,
    };
    els.push(el);
    return el;
  };
  const stamp = (seed, rawKey, space, slot) => {
    for (const pre of ["t|", "r|", "e|"]) {
      const el = els.find((e) => e.id === idOf(pre + seed));
      if (el) el.customData = { workmap: true, rawKey, space, slot };
    }
  };
  return { els, text, rect, embed, stamp, adoptSlot, reserve, prevPos };
}

const bar = (f, seed, x, y, w, h, done, total, color) => {
  f.rect(seed + "|track", x, y, w, h, { stroke: "#d0d0d0", fill: "#e8e8e8", width: 1 });
  const fw = Math.max(0, Math.round((w * done) / Math.max(1, total)));
  if (fw > 2) f.rect(seed + "|fill", x, y, fw, h, { stroke: STATUS_COLORS.done, fill: STATUS_COLORS.done, width: 1 });
  f.text(seed + "|count", x + w + 12, y - 2, `${done}/${total}`, { size: 15, color });
};

/* ══════════════ root drawing: outcome pods ══════════════ */
function buildRootDrawing(model, previous) {
  const f = factory(previous);
  f.text("title", 0, 0, "🗺 Work Map", { size: L.titleFont });
  bar(f, "title", 0, 46, 360, 14, model.root.rollup.done, model.root.rollup.total, STATUS_COLORS[model.root.rollup.done === model.root.rollup.total ? "done" : "in_progress"]);
  for (const o of model.outcomes) {
    const slot = f.adoptSlot(o.key, "pod");
    const moved = f.prevPos.get(o.key);
    const x = moved ? moved.x : 0;
    const y = moved ? moved.y : 120 + slot * (L.podH + L.podGap);
    f.rect("pod|" + o.key + "|box", x, y, L.podW, L.podH, { stroke: STATUS_COLORS[o.status], width: 2 });
    f.stamp("pod|" + o.key + "|box", o.key, "pod", slot); // frame = the position anchor
    f.text("pod|" + o.key, x + 16, y + 14, wrapAt(`🎯 ${o.title}`, 26).join("\n"), { size: 24, link: null });
    f.text("pod|" + o.key + "|count", x + L.podW - 90, y + 18, `${o.rollup.done}/${o.rollup.total}`, {
      size: 16, color: STATUS_COLORS[o.status],
    });
    f.embed("pod|" + o.key + "|embed", x + 16, y + L.embedTop, L.podW - 32, L.podH - L.embedTop - 16, safeName(o.key));
    f.stamp("pod|" + o.key, o.key, "pod", slot);
    f.stamp("pod|" + o.key + "|embed", o.key, "pod", slot);
  }
  return f.els;
}

/* ══════════════ outcome drawing: capability cards ══════════════ */
function buildOutcomeDrawing(model, o, previous) {
  const f = factory(previous);
  f.text("bc", 0, 0, "↑ Work Map", { size: 16, color: "#8a8a8a", link: "[[Work Map.excalidraw.md]]" });
  f.text("title", 0, 30, wrapAt(`🎯 ${o.title}`, 30).join("\n"), { size: 28 });
  bar(f, "title", 0, 76 + (wrapAt(`🎯 ${o.title}`, 30).length - 1) * 34, 360, 14, o.rollup.done, o.rollup.total, STATUS_COLORS[o.status]);
  for (const c of o.children) {
    const slot = f.adoptSlot(c.key, "card");
    const moved = f.prevPos.get(c.key);
    const x = moved ? moved.x : 0;
    const y = moved ? moved.y : 150 + slot * (L.podH + L.podGap);
    f.rect("card|" + c.key + "|box", x, y, L.podW, L.podH, { stroke: STATUS_COLORS[c.status], width: 2 });
    f.stamp("card|" + c.key + "|box", c.key, "card", slot); // frame = the position anchor
    f.text("card|" + c.key, x + 16, y + 14, wrapAt(c.title, 28).join("\n"), { size: 22, link: c.url });
    f.text("card|" + c.key + "|count", x + L.podW - 90, y + 18, `${c.rollup.done}/${c.rollup.total}`, {
      size: 16, color: STATUS_COLORS[c.status],
    });
    f.embed("card|" + c.key + "|embed", x + 16, y + L.embedTop, L.podW - 32, L.podH - L.embedTop - 16, safeName(c.key));
    f.stamp("card|" + c.key, c.key, "card", slot);
    f.stamp("card|" + c.key + "|embed", c.key, "card", slot);
  }
  return f.els;
}

/* ══════════════ capability drawing: task cards grouped by service ══════════════ */
function buildCapabilityDrawing(model, c, previous) {
  const f = factory(previous);
  const outcome = c.parent ? model.byKey.get(c.parent) : null;
  if (outcome) {
    f.text("bc", 0, 0, `↑ ${outcome.title}`, { size: 16, color: "#8a8a8a", link: `[[${safeName(outcome.key)}.excalidraw.md]]` });
  }
  f.text("title", 0, 30, c.title, { size: 28 });
  bar(f, "title", 0, 76, 360, 14, c.rollup.done, c.rollup.total, STATUS_COLORS[c.status]);

  // service sections, each with its own stable slot; task grid inside each section
  const sections = [...model.memberships.values()].filter((m) => m.capabilityKey === c.key).sort(byKeyFn);
  const direct = c.directTasks ?? [];
  const groups = [
    ...sections.map((m) => ({ key: m.key, title: `⚙ ${m.title}`, tasks: m.tasks })),
    ...(direct.length ? [{ key: c.key + "|misc", title: "⚙ other", tasks: direct }] : []),
  ].filter((g) => g.tasks.length);

  for (const g of groups) {
    const sSlot = f.adoptSlot(g.key, "section");
    const baseY = 150 + sSlot * L.sectionPitch;
    f.text("sec|" + g.key, 0, baseY, g.title, { size: 20, color: "#6d28d9" });
    f.stamp("sec|" + g.key, g.key, "section", sSlot);
    // reserve enough section slots that a tall task grid never runs into the next section
    const rows = Math.max(1, Math.ceil(g.tasks.length / L.cardCols));
    f.reserve("section", sSlot + Math.ceil((rows * (L.cardH + L.cardGY) + 80) / L.sectionPitch) - 1);
    for (const t of g.tasks) {
      const slot = f.adoptSlot(t.key, "task");
      const col = slot % L.cardCols;
      const row = Math.floor(slot / L.cardCols);
      const gridX = col * (L.cardW + L.cardGX);
      const gridY = baseY + 36 + row * (L.cardH + L.cardGY);
      const moved = f.prevPos.get(t.key);
      const x = moved ? moved.x : gridX;
      const y = moved ? moved.y : gridY;
      const statusColor = STATUS_COLORS[t.status];
      f.rect("task|" + t.key + "|box", x, y, L.cardW, L.cardH, { stroke: statusColor, width: 1.5 });
      f.text("task|" + t.key, x + 12, y + 10, wrapAt(`${icon(t.status)} ${t.title}`, 26).join("\n"), {
        size: 17, link: t.url,
      });
      f.stamp("task|" + t.key, t.key, "task", slot);
    }
  }
  return f.els;
}
const icon = (s) => (s === "done" ? "✅" : s === "blocked" ? "⛔" : s === "in_progress" ? "🔨" : "◻");

/* ══════════════ helpers ══════════════ */
function safeName(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}
function wrapAt(str, n) {
  const words = String(str).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function pad4(n) {
  return n.toString(36).padStart(4, "0");
}
const byKeyFn = (a, b) => (a.key < b.key ? -1 : 1);
