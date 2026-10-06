// Projection 2: JTBD / flow story map as a generated Obsidian-Excalidraw drawing.
// CI-friendly: writes the .excalidraw.md file directly (no Obsidian needed).
//
// Layout: one column per outcome (JTBD) — journey order left→right.
//   column header = outcome title + honest roll-up bar (done leaves / total)
//   cards         = capabilities under the outcome (stacked, stable slots)
//   chips inside  = capability×service memberships with their own roll-ups
// Status colors match the treemap; every stamped element carries
// customData.rawKey — the SAME key space as the treemap (cross-view contract).
//
// Position stability: slot per outcome-column and per capability-card is
// persisted in customData; regenerating over an existing drawing adopts exact
// key matches; new items append after the high-water mark. Status changes,
// title changes and re-ordering of tasks never move anything.

import { STATUS_COLORS } from "./hierarchy.mjs";
import { decompressFromBase64 } from "./lzstring.mjs";

const LAYOUT = {
  colW: 560,
  colGap: 70,
  headerY: 0,
  bodyY: 150,
  cardW: 520,
  cardPad: 16,
  chipH: 30,
  chipGap: 8,
  cardPitch: 190,
  titleFont: 30,
  cardTitleFont: 22,
  chipFont: 14,
};

export function buildStoryMap(model, previousElements = []) {
  /* ── slot memory from the previous drawing ── */
  const prevByKey = new Map(); // rawKey → customData
  const prevPos = new Map(); // rawKey → {x, y}: MANUAL MOVES are adopted as truth
  const hiWater = { outcome: -1, card: -1 };
  for (const el of previousElements) {
    const cd = el.customData;
    if (!cd || cd.dualviews !== true || !cd.rawKey) continue;
    if (!prevByKey.has(cd.rawKey)) prevByKey.set(cd.rawKey, cd);
    if (cd.space in hiWater && typeof cd.slot === "number") {
      hiWater[cd.space] = Math.max(hiWater[cd.space], cd.slot);
    }
    // anchors: outcome → title text; card → the card rectangle
    if (cd.space === "outcome" && el.type === "text" && !prevPos.has(cd.rawKey)) {
      prevPos.set(cd.rawKey, { x: el.x, y: el.y });
    }
    if (cd.space === "card" && el.type === "rectangle" && !prevPos.has(cd.rawKey)) {
      prevPos.set(cd.rawKey, { x: el.x, y: el.y });
    }
  }
  const nextSlot = (space) => ++hiWater[space];
  const adoptSlot = (rawKey, space) => {
    const p = prevByKey.get(rawKey);
    if (p && p.space === space && typeof p.slot === "number") return p.slot;
    return nextSlot(space);
  };

  const els = [];
  const idOf = (seed) => "dv" + hash(seed).toString(36) + pad4(hash(seed + "#2") % 1679616);

  const text = (seed, x, y, str, { size = 20, family = 2, color = "#1e1e1e", align = "left", link = null } = {}) => {
    const lines = String(str).split("\n");
    const w = Math.ceil(Math.max(...lines.map((l) => l.length), 1) * size * 0.58);
    const h = Math.ceil(lines.length * size * 1.3);
    const el = {
      id: idOf("t|" + seed), type: "text", x, y, width: w, height: h,
      text: String(str), fontSize: size, fontFamily: family, textAlign: align,
      strokeColor: color, link,
    };
    els.push(el);
    return el;
  };
  const rect = (seed, x, y, w, h, { stroke = "#1e1e1e", fill = "transparent", width: sw = 1.5, dash = "solid" } = {}) => {
    const el = {
      id: idOf("r|" + seed), type: "rectangle", x, y, width: w, height: h,
      strokeColor: stroke, backgroundColor: fill, strokeWidth: sw, strokeStyle: dash,
      roundness: { type: 3 },
    };
    els.push(el);
    return el;
  };
  /* stamp the base elements of a column/card with identity + slot */
  const stamp = (seedPrefix, rawKey, space, slot) => {
    for (const pre of ["t|", "r|"]) {
      const el = els.find((e) => e.id === idOf(pre + seedPrefix));
      if (el) el.customData = { dualviews: true, rawKey, space, slot };
    }
  };

  const colX = (slot) => 40 + slot * (LAYOUT.colW + LAYOUT.colGap);

  for (const o of model.outcomes) {
    const oKey = "outcome:" + o.key;
    const oSlot = adoptSlot(o.key, "outcome");
    const movedCol = prevPos.get(o.key);
    const x = movedCol ? movedCol.x : colX(oSlot);
    const headerY = movedCol ? movedCol.y : LAYOUT.headerY;

    text(oKey, x, headerY, "🎯 " + o.title, { size: LAYOUT.titleFont });
    const barW = 360, barH = 14;
    rect(oKey + "|bar", x, headerY + 48, barW, barH, { stroke: "#d0d0d0", fill: "#e8e8e8", width: 1 });
    const fillW = Math.max(0, Math.round((barW * o.rollup.done) / Math.max(1, o.rollup.total)));
    if (fillW > 2) {
      rect(oKey + "|bar|fill", x, headerY + 48, fillW, barH, { stroke: STATUS_COLORS.done, fill: STATUS_COLORS.done, width: 1 });
    }
    text(oKey + "|count", x + barW + 12, headerY + 44, `${o.rollup.done}/${o.rollup.total}`, {
      size: 16, color: STATUS_COLORS[o.status],
    });
    stamp(oKey, o.key, "outcome", oSlot);

    for (const c of o.children) {
      const cKey = "card:" + c.key;
      const cSlot = adoptSlot(c.key, "card");
      const movedCard = prevPos.get(c.key);
      const chips = c.memberships;
      // wrap long titles so they can never reach the right-aligned count badge
      const titleLines = wrapAt(c.title, 30);
      const titleH = titleLines.length * Math.ceil(LAYOUT.cardTitleFont * 1.3);
      const cardH = LAYOUT.cardPad * 2 + titleH + 8 + Math.max(1, chips.length) * (LAYOUT.chipH + LAYOUT.chipGap);
      const rows = Math.ceil((cardH + 24) / LAYOUT.cardPitch);
      hiWater.card = Math.max(hiWater.card, cSlot + rows - 1);
      const cy = movedCard ? movedCard.y : LAYOUT.bodyY + cSlot * LAYOUT.cardPitch;
      const cx = movedCard ? movedCard.x : x;

      rect(cKey, cx, cy, LAYOUT.cardW, cardH, { stroke: STATUS_COLORS[c.status], width: 2 });
      text(cKey, cx + LAYOUT.cardPad, cy + LAYOUT.cardPad, titleLines.join("\n"), { size: LAYOUT.cardTitleFont, link: c.url });
      text(cKey + "|count", cx + LAYOUT.cardW - LAYOUT.cardPad - 70, cy + LAYOUT.cardPad + 4, `${c.rollup.done}/${c.rollup.total}`, {
        size: 16, color: STATUS_COLORS[c.status], align: "right",
      });

      let chipY = cy + LAYOUT.cardPad + titleH + 14;
      if (!chips.length) {
        text(cKey + "|none", cx + LAYOUT.cardPad, chipY, "(no tasks mapped)", { size: 13, color: "#999" });
      }
      for (const m of chips) {
        const mKey = "chip:" + m.key;
        rect(mKey, cx + LAYOUT.cardPad, chipY, LAYOUT.cardW - 2 * LAYOUT.cardPad, LAYOUT.chipH, {
          stroke: STATUS_COLORS[m.status], fill: "#ffffff", width: 1.2,
        });
        const svc = model.byKey.get(m.serviceKey);
        text(mKey, cx + LAYOUT.cardPad + 10, chipY + 7, `${m.title}  ·  ${m.rollup.done}/${m.rollup.total}`, {
          size: LAYOUT.chipFont, family: 3, color: "#333", link: svc?.url ?? null,
        });
        stamp(mKey, m.key, "chip", cSlot); // membership keys = the cross-view contract
        chipY += LAYOUT.chipH + LAYOUT.chipGap;
      }
      stamp(cKey, c.key, "card", cSlot);
    }
  }

  return { elements: els, keyset: collectRawKeys(els) };
}

function collectRawKeys(els) {
  const keys = new Set();
  for (const el of els) if (el.customData?.rawKey) keys.add(el.customData.rawKey);
  return keys;
}

/* greedy word-wrap at ~n chars */
function wrapAt(str, n) {
  const words = String(str).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ── deterministic hash ids (same scheme as fractal-index) ── */
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

/* ── .excalidraw.md writer ── */
export function toExcalidrawMD(elements, { title = "Story Map" } = {}) {
  const full = elements.map((el) => ({
    id: el.id,
    type: el.type,
    x: Math.round(el.x * 100) / 100,
    y: Math.round(el.y * 100) / 100,
    width: Math.round(el.width * 100) / 100,
    height: Math.round(el.height * 100) / 100,
    angle: 0,
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor || "transparent",
    fillStyle: "solid",
    strokeWidth: el.strokeWidth || 1,
    strokeStyle: el.strokeStyle || "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: el.roundness ?? null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: el.link || null,
    locked: false,
    ...(el.type === "text"
      ? {
          text: el.text,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          textAlign: el.textAlign || "left",
          verticalAlign: "top",
          containerId: null,
          originalText: el.text,
          lineHeight: 1.3,
          autoResize: true,
        }
      : {}),
    ...(el.customData ? { customData: el.customData } : {}),
  }));

  const textSection = full.filter((e) => e.type === "text").map((t) => `${t.text.split("\n").join(" ")} ^${t.id}`).join("\n");
  const scene = {
    type: "excalidraw",
    version: 2,
    source: "dual-views generator",
    elements: full,
    appState: { grid: null, viewBackgroundColor: "#ffffff" },
    files: {},
  };
  return [
    "---",
    "excalidraw-plugin: parsed",
    "tags: [excalidraw, story-map]",
    "---",
    "",
    "# Excalidraw Data",
    "## Text Elements",
    textSection,
    "",
    "## Drawing",
    "```json",
    JSON.stringify(scene, null, 2),
    "```",
    "",
  ].join("\n");
}

/* ── parse an existing generated story map for slot adoption ── */
export function parseStoryMapElements(md) {
  // our own plain-JSON output
  const plain = md.match(/```json\n([\s\S]*?)\n```/);
  if (plain) {
    try {
      const scene = JSON.parse(plain[1]);
      return Array.isArray(scene.elements) ? scene.elements : [];
    } catch { /* fall through to compressed */ }
  }
  // the Obsidian Excalidraw plugin's re-saved format (LZString base64)
  const compressed = md.match(/```compressed-json\n?([\s\S]*?)\n?```/);
  if (compressed) {
    try {
      const cleaned = compressed[1].replace(/[\n\r]/g, "");
      const scene = JSON.parse(decompressFromBase64(cleaned) || "null");
      return scene && Array.isArray(scene.elements) ? scene.elements : [];
    } catch { /* corrupted — treat as no previous state */ }
  }
  return [];
}

/* ── SVG preview (visual testing without Obsidian) ── */
export function toSVG(elements) {
  if (!elements.length) return "<svg xmlns='http://www.w3.org/2000/svg'/>";
  const pad = 50;
  const minX = Math.min(...elements.map((e) => e.x)) - pad;
  const minY = Math.min(...elements.map((e) => e.y)) - pad;
  const maxX = Math.max(...elements.map((e) => e.x + e.width)) + pad;
  const maxY = Math.max(...elements.map((e) => e.y + e.height)) + pad;
  const parts = [];
  for (const el of elements) {
    if (el.type === "embeddable") {
      parts.push(
        `<rect x='${el.x}' y='${el.y}' width='${el.width}' height='${el.height}' fill='#f5f0ff' stroke='#8b5cf6' rx='8'/>` +
          `<line x1='${el.x}' y1='${el.y}' x2='${el.x + el.width}' y2='${el.y + el.height}' stroke='#d8ccf5'/>` +
          `<text x='${el.x + 12}' y='${el.y + 22}' font-family='Segoe UI, Helvetica, sans-serif' font-size='13' fill='#6d28d9'>▶ ${esc((el.link || "").replace(/\[\[|\]\]|\.excalidraw\.md/g, ""))}</text>`
      );
    } else if (el.type === "rectangle") {
      parts.push(
        `<rect x='${el.x}' y='${el.y}' width='${el.width}' height='${el.height}' fill='${!el.backgroundColor || el.backgroundColor === "transparent" ? "none" : el.backgroundColor}' stroke='${el.strokeColor}' stroke-width='${el.strokeWidth || 1}' rx='6'${el.strokeStyle === "dashed" ? " stroke-dasharray='6 5'" : ""}/>`
      );
    } else if (el.type === "text") {
      const lines = String(el.text).split("\n");
      const lh = Math.round(el.fontSize * 1.3);
      const anchor = el.textAlign === "right" ? "end" : el.textAlign === "center" ? "middle" : "start";
      const tx = el.textAlign === "right" ? el.x + el.width : el.x;
      parts.push(
        `<text x='${tx}' y='${el.y + lh * 0.85}' font-family='Segoe UI, Helvetica, sans-serif' font-size='${el.fontSize}' fill='${el.strokeColor}' text-anchor='${anchor}'${el.link ? " text-decoration='underline'" : ""}>` +
          lines.map((l, i) => `<tspan x='${tx}' dy='${i === 0 ? 0 : lh}'>${esc(l)}</tspan>`).join("") +
          `</text>`
      );
    }
  }
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${minX} ${minY} ${maxX - minX} ${maxY - minY}' width='${Math.min(maxX - minX, 1600)}' font-family='Segoe UI, Helvetica, sans-serif'>` +
    `<rect x='${minX}' y='${minY}' width='${maxX - minX}' height='${maxY - minY}' fill='#fdfdfd'/>` +
    parts.join("") +
    `</svg>`
  );
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
