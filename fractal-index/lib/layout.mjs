// Layout solver: packs component bounds into the canvas with a guaranteed
// zero-overlap invariant. Components declare their size; the solver only
// assigns origins. Shelf packing (rows filled left-to-right, then wrap).

import { assertNoOverlap } from "./invariant.mjs";

export function shelfPack(items, maxWidth, gapX, gapY) {
  // items: [{ size: {w, h}, ... }] → positions [{x, y, w, h, item}]
  const rows = [];
  let row = { items: [], w: 0, h: 0 };
  for (const item of items) {
    const w = item.size.w, h = item.size.h;
    if (row.items.length && row.w + gapX + w > maxWidth) {
      rows.push(row);
      row = { items: [], w: 0, h: 0 };
    }
    row.items.push(item);
    row.w = row.items.length > 1 ? row.w + gapX + w : w;
    row.h = Math.max(row.h, h);
  }
  if (row.items.length) rows.push(row);

  const placed = [];
  let y = 0;
  for (const r of rows) {
    let x = 0;
    for (const item of r.items) {
      placed.push({ x, y, w: item.size.w, h: item.size.h, item });
      x += item.size.w + gapX;
    }
    y += r.h + gapY;
  }
  const totalW = Math.max(...rows.map((r) => r.w), 0);
  const totalH = Math.max(y - gapY, 0);
  return { placed, totalW, totalH };
}

/**
 * Compose sections vertically; each section is shelf-packed to the same
 * max width. Runs the overlap invariant across ALL placed components
 * (arrows excluded — they connect, so crossing is their job).
 */
export function compose(sections, { maxWidth, gapX = 60, gapY = 60 }) {
  const allBounds = []; // {x,y,w,h,label}
  const elementChunks = [];
  let y = 0;
  const placedBySection = [];
  for (const section of sections) {
    const { placed, totalW, totalH } = shelfPack(section.components, maxWidth, section.gapX ?? gapX, section.gapY ?? gapY);
    y += section.gapBefore ?? 0;
    const sectionY = y;
    for (const p of placed) {
      allBounds.push({
        x: p.x, y: sectionY + p.y, w: p.w, h: p.h,
        label: section.name + ":" + (p.item.label || p.item.name || "?"),
      });
      placedBySection.push({ section: section.name, x: p.x, y: sectionY + p.y, w: p.w, h: p.h, item: p.item });
    }
    for (const p of placed) {
      const els = p.item.render(p.x, sectionY + p.y);
      elementChunks.push({ section: section.name, els, origin: { x: p.x, y: sectionY + p.y }, bounds: p });
    }
    y = sectionY + totalH + gapY;
  }
  assertNoOverlap(allBounds);
  return { placedBySection, elementChunks, height: y, width: maxWidth };
}
