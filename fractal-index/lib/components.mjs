// Component-based dimension system for Fractal Index maps.
//
// Every UI component MEASURES itself from its content and renders as a set of
// elements positioned relative to its own origin, reporting its exact bounds.
// A layout solver (layout.mjs) then places component bounds with a
// zero-overlap guarantee — element collisions become impossible by
// construction instead of being patched after the fact.
//
// Width estimation is deliberately generous (emoji ≈ 1.5×font, +10% safety):
// an overestimated box is roomy; an underestimated one collides.

export const FONT = {
  ratio: 0.62,          // avg glyph width as a fraction of font size
  emojiRatio: 1.5,      // emoji code points render wide
  safety: 1.1,          // +10% so estimates never undershoot
  lineHeight: 1.3,
};

export function measureText(text, fontSize) {
  let w = 0;
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    w += (cp >= 0x1f000 || (cp >= 0x2600 && cp < 0x2800) ? FONT.emojiRatio : FONT.ratio) * fontSize;
  }
  const lines = String(text).split("\n");
  return {
    w: Math.ceil(w * FONT.safety),
    h: Math.ceil(lines.length * fontSize * FONT.lineHeight),
    lines: lines.length,
  };
}

/* ── components: (props) => { size, elements(at x,y), meta } ───────────────
   Each factory returns a render(x, y) closure. render() emits elements whose
   coordinates are absolute; size includes every decoration (chips, badges). */

export function Title({ text, color = "#1e1e1e", size = 36 }) {
  const m = measureText(text, size);
  return {
    size: { w: m.w, h: m.h },
    render(x, y) {
      return [{
        make: (seed) => el("text", seed, x, y, m.w, m.h, {
          text, fontSize: size, fontFamily: 1, color,
        }),
        seed: "title|" + text,
      }];
    },
  };
}

export function Breadcrumb({ text, link }) {
  const m = measureText(text, 18);
  return {
    size: { w: m.w, h: m.h },
    render(x, y) {
      return [{
        make: (seed) => el("text", seed, x, y, m.w, m.h, {
          text, fontSize: 18, fontFamily: 2, color: "#8a8a8a", link: link ? wl(link) : null,
        }),
        seed: "bc|" + text,
      }];
    },
  };
}

export function Pod({ name, childCount, embedPath = null, hint = null, chip = "⤢ click pod to dive", width = 380 }) {
  const label = `📁 ${name}  (${childCount})`;
  const lm = measureText(label, 26);
  const chipM = measureText(chip, 14);
  const PAD = 16;
  const LABEL_H = Math.max(34, lm.h);
  const EMBED_H = 210;
  const BOX_H = PAD + LABEL_H + 8 + EMBED_H + 16;
  const CHIP_ROW = chipM.h + 6;
  const w = Math.min(Math.max(width, lm.w + PAD * 2 + chipM.w + 12), 560);
  const h = CHIP_ROW + BOX_H;
  const embedTarget = embedPath;

  return {
    size: { w, h },
    name,
    meta: { label: name, embedTarget },
    render(x, y) {
      const els = [];
      const boxY = y + CHIP_ROW;
      // decoration row above the box: dive chip, right-aligned
      els.push({
        make: (seed) => el("text", seed, x + w - chipM.w, y, chipM.w, chipM.h, {
          text: chip, fontSize: 14, fontFamily: 2, color: "#a78bfa", align: "right",
        }),
        seed: "chip|" + name,
        bounds: { x: x + w - chipM.w, y, w: chipM.w, h: chipM.h },
      });
      // box frame
      els.push({
        make: (seed) => el("rectangle", seed, x, boxY, w, BOX_H, {
          strokeColor: "#8b5cf6", strokeWidth: 2,
        }),
        seed: "podframe|" + name,
      });
      // inner recursion motif
      els.push({
        make: (seed) => el("rectangle", seed, x + 8, boxY + 8, w - 16, BOX_H - 16, {
          strokeColor: "#8b5cf6", strokeStyle: "dashed", strokeWidth: 1,
        }),
        seed: "podmotif|" + name,
      });
      // label
      els.push({
        make: (seed) => el("text", seed, x + PAD, boxY + 10, lm.w, lm.h, {
          text: label, fontSize: 26, fontFamily: 1, color: "#8b5cf6",
          link: embedTarget ? wl(embedTarget) : null,
        }),
        seed: "podlabel|" + name,
        bounds: { x: x + PAD, y: boxY + 10, w: lm.w, h: lm.h },
      });
      // embed or hint — the pod preview is an image element transcluding the
      // sub-index drawing (embeddable elements hang mounting a nested view
      // and render as white boxes); build-index attaches the SVG dataURL
      if (embedTarget) {
        els.push({
          make: (seed) => el("image", seed, x + 20, boxY + PAD + LABEL_H + 8, w - 40, EMBED_H, {
            strokeColor: "#8b5cf6", link: wl(embedTarget),
          }),
          seed: "podembed|" + name,
        });
      } else {
        const hint = "(no _index yet — run Fractal Index inside\nthis subfolder to grow the fractal)";
        const hm = measureText(hint, 16);
        els.push({
          make: (seed) => el("text", seed, x + 20, boxY + PAD + LABEL_H + 8, hm.w, hm.h, {
            text: hint, fontSize: 16, fontFamily: 2, color: "#8a8a8a",
          }),
          seed: "podhint|" + name,
        });
      }
      return els;
    },
  };
}

export function FileCard({ icon, name, link }) {
  const label = `${icon} ${name}`;
  const m = measureText(label, 20);
  const w = Math.max(140, m.w + 24);
  const h = m.h + 20;
  return {
    size: { w, h },
    name,
    render(x, y) {
      return [
        {
          make: (seed) => el("rectangle", seed, x, y, w, h, {
            strokeColor: "#1e1e1e", strokeWidth: 1,
          }),
          seed: "cardbox|" + name,
        },
        {
          make: (seed) => el("text", seed, x + 12, y + 10, m.w, m.h, {
            text: label, fontSize: 20, fontFamily: 2, color: "#1e1e1e",
            link: link ? wl(link) : null,
          }),
          seed: "cardtext|" + name,
        },
      ];
    },
  };
}

/* ── shared element constructor (plugin-compatible schema) ── */
function el(type, seed, x, y, w, h, extra = {}) {
  const id = "fi" + hash(seed).toString(36) + (hash(seed + "#2") % 1679616).toString(36).padStart(4, "0");
  return {
    id, type, x, y, width: w, height: h, angle: 0,
    strokeColor: extra.color || "#1e1e1e", backgroundColor: extra.fill || "transparent",
    fillStyle: "solid", strokeWidth: extra.strokeWidth || 1,
    strokeStyle: extra.dash || "solid", roughness: 1, opacity: extra.op ?? 100,
    roundness: extra.round ?? null, seed: 1, version: 1, versionNonce: 1,
    updated: 1, isDeleted: false, boundElements: [], groupIds: [],
    frameId: null, link: extra.link ?? null, locked: false,
    ...(type === "text" ? {
      text: extra.text || "", fontSize: extra.fontSize || 20, fontFamily: extra.fontFamily || 2,
      textAlign: extra.align || "left", verticalAlign: "top", containerId: null,
      originalText: extra.text || "", lineHeight: 1.3, autoResize: true,
    } : {}),
    ...(type === "arrow" ? { points: extra.points || [[0, 0], [0, 0]], startArrowhead: extra.startArrowhead ?? null, endArrowhead: extra.endArrowhead ?? "arrow" } : {}),
    ...(type === "image" ? { fileId: extra.fileId ?? null, scale: [1, 1], crop: null } : {}),
    ...(type === "embeddable" ? { scale: [1, 1] } : {}),
    ...(type === "rectangle" && extra.name !== undefined ? {} : {}),
    ...(/^podframe/.test(seed) ? { name: " " } : {}),
    ...(extra.customData ? { customData: extra.customData } : {}),
  };
}
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h >>> 0;
}
function wl(p) { return "[[" + String(p).replace(/([\[\]|])/g, "\\$1") + "]]"; }
