// Projection 4: timeline — a Gantt-style progress view from the hierarchy.
// Each outcome is a horizontal band (journey order top→down), each capability
// a progress bar within its band. Fill ∝ done/total. Status-colored outline.
// Same deterministic IDs and adoption contract as all other projections.
//
// The timeline answers "where are we in the journey?" at a glance:
// green-dominant bands are behind you, red/amber bands are where you're stuck.

import { STATUS_COLORS } from "./hierarchy.mjs";
import { toExcalidrawMD } from "./storymap-excalidraw.mjs";

const L = {
  titleFont: 32,
  bandFont: 22,
  labelFont: 16,
  countFont: 14,
  barH: 28,
  barGap: 12,
  bandGap: 36,
  labelW: 280,
  barW: 400,
  countW: 80,
  marginX: 40,
  marginY: 120,
  barX: 0, // computed = marginX + labelW
};

export function buildTimeline(model, previousElements = []) {
  const els = [];
  const prevPos = new Map();
  for (const el of previousElements) {
    const cd = el.customData;
    if (!cd || cd.dualviews !== true || !cd.rawKey) continue;
    if (cd.space === "band" && el.type === "text" && !prevPos.has(cd.rawKey)) {
      prevPos.set(cd.rawKey, { x: el.x, y: el.y });
    }
    if (cd.space === "bar" && el.type === "rectangle" && !prevPos.has(cd.rawKey)) {
      prevPos.set(cd.rawKey, { x: el.x, y: el.y });
    }
  }

  const idOf = (seed) =>
    "tl" + hash(seed).toString(36) + pad4(hash(seed + "#2") % 1679616);

  const text = (seed, x, y, str, opts = {}) => {
    const lines = String(str).split("\n");
    const w = Math.ceil(Math.max(...lines.map((l) => l.length), 1) * (opts.size || 16) * 0.58);
    const h = Math.ceil(lines.length * (opts.size || 16) * 1.3);
    els.push({
      id: idOf("t|" + seed), type: "text", x, y, width: w, height: h,
      text: String(str), fontSize: opts.size || 16, fontFamily: opts.family || 2,
      textAlign: opts.align || "left", strokeColor: opts.color || "#1e1e1e",
      link: opts.link || null,
    });
  };
  const rect = (seed, x, y, w, h, opts = {}) => {
    els.push({
      id: idOf("r|" + seed), type: "rectangle", x, y, width: w, height: h,
      strokeColor: opts.stroke || "#1e1e1e", backgroundColor: opts.fill || "transparent",
      strokeWidth: opts.width || 1.5, strokeStyle: opts.dash || "solid",
      roundness: { type: 3 },
    });
  };
  const stamp = (seed, rawKey, space) => {
    for (const pre of ["t|", "r|"]) {
      const el = els.find((e) => e.id === idOf(pre + seed));
      if (el) el.customData = { dualviews: true, rawKey, space };
    }
  };

  const barX = L.marginX + L.labelW;

  // title
  text("title", L.marginX, 0, "📅 Development Timeline", { size: L.titleFont });

  // overall progress bar
  const overall = model.root.rollup;
  const ow = L.labelW + L.barW + L.countW;
  rect("overall|track", L.marginX, 48, ow, 12, { stroke: "#d0d0d0", fill: "#e8e8e8", width: 1 });
  const ofw = Math.max(0, Math.round((ow * overall.done) / Math.max(1, overall.total)));
  if (ofw > 2) rect("overall|fill", L.marginX, 48, ofw, 12, { stroke: STATUS_COLORS.done, fill: STATUS_COLORS.done, width: 1 });
  text("overall|count", L.marginX + ow + 12, 44, `${overall.done}/${overall.total}`, { size: 14, color: STATUS_COLORS.done });

  // outcome bands (journey order)
  let y = L.marginY;
  for (const o of model.outcomes) {
    const bandKey = "band:" + o.key;
    const movedBand = prevPos.get(o.key);
    const bandX = movedBand ? movedBand.x : L.marginX;
    const bandY = movedBand ? movedBand.y : y;
    const bandH = o.children.length * (L.barH + L.barGap) + L.bandFont + 16;

    text(bandKey, bandX, bandY, `🎯 ${o.title}`, { size: L.bandFont, color: STATUS_COLORS[o.status] });
    text(bandKey + "|count", bandX + L.labelW + L.barW + 16, bandY + 4, `${o.rollup.done}/${o.rollup.total}`, {
      size: L.countFont, color: STATUS_COLORS[o.status],
    });
    stamp(bandKey, o.key, "band");

    let barY = bandY + L.bandFont + 12;
    for (const c of o.children) {
      const barKey = "bar:" + c.key;
      const movedBar = prevPos.get(c.key);
      const by = movedBar ? movedBar.y : barY;

      // capability label
      text(barKey + "|label", L.marginX, by + 6, c.title, {
        size: L.labelFont, link: c.url, color: "#333",
      });

      // progress bar: outline (status color) + green fill (done portion)
      rect(barKey + "|outline", barX, by, L.barW, L.barH, {
        stroke: STATUS_COLORS[c.status], width: 1.2,
      });
      const fw = Math.max(0, Math.round((L.barW * c.rollup.done) / Math.max(1, c.rollup.total)));
      if (fw > 2) {
        rect(barKey + "|fill", barX, by, fw, L.barH, {
          stroke: STATUS_COLORS.done, fill: STATUS_COLORS.done, width: 0.5,
        });
      }

      // status chip + counts
      text(barKey + "|count", barX + L.barW + 12, by + 6, `${c.rollup.done}/${c.rollup.total}`, {
        size: L.countFont, color: STATUS_COLORS[c.status],
      });
      stamp(barKey + "|outline", c.key, "bar"); // outline = the position anchor

      barY = by + L.barH + L.barGap;
    }
    y = bandY + bandH + L.bandGap;
  }

  return { elements: els, keyset: collectKeys(els) };
}

function collectKeys(els) {
  const keys = new Set();
  for (const el of els) if (el.customData?.rawKey) keys.add(el.customData.rawKey);
  return keys;
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

export function timelineToMD(elements) {
  return toExcalidrawMD(elements, { title: "Timeline" });
}
