// Serialize a mock-EA scene into (a) a real Obsidian-Excalidraw markdown drawing
// and (b) an SVG preview for visual inspection.

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sceneElements(ea) {
  return [...ea._scene.values()].filter((el) => !el.isDeleted);
}

/* ── .excalidraw.md (the plugin's "parsed" markdown format) ── */
export function toExcalidrawMD(ea, title) {
  const els = sceneElements(ea);
  const textEls = els.filter((el) => el.type === "text");
  const linkEls = els.filter((el) => el.link);

  const texts = textEls
    .map((el) => `${el.text.split("\n").join(" ")} ^${el.id}`)
    .join("\n");

  const links = linkEls.length
    ? "## Element Links\n" +
      linkEls.map((el) => `- [[${el.link.replace(/^\[\[|\]\]$/g, "")}]] ^${el.id}`).join("\n") +
      "\n"
    : "";

  const scene = {
    type: "excalidraw",
    version: 2,
    source: "fractal-index/test-harness",
    elements: els.map((el) => ({
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle || 0,
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor || "transparent",
      fillStyle: el.fillStyle || "solid",
      strokeWidth: el.strokeWidth || 1,
      strokeStyle: el.strokeStyle || "solid",
      roughness: el.roughness ?? 1,
      opacity: el.opacity ?? 100,
      groupIds: el.groupIds || [],
      frameId: el.frameId || null,
      roundness: el.roundness ?? null,
      seed: el.seed || 1,
      version: el.version || 1,
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
            lineHeight: 1.28,
            autoResize: el.autoResize ?? true,
          }
        : {}),
      ...(el.type === "arrow" ? { points: el.points, startArrowhead: null, endArrowhead: "arrow" } : {}),
      ...(el.type === "frame" ? { name: el.name } : {}),
      ...(el.type === "embeddable" ? { status: "saved" } : {}),
      ...(el.customData ? { customData: el.customData } : {}),
    })),
    appState: { grid: null, viewBackgroundColor: "#ffffff" },
    files: {},
  };

  return [
    "---",
    "excalidraw-plugin: parsed",
    "tags: [excalidraw]",
    `cssclasses: [fractal-index${title ? ", " + title.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""}]`,
    "---",
    "",
    "# Excalidraw Data",
    "## Text Elements",
    texts || "",
    "",
    links,
    "## Drawing",
    "```json",
    JSON.stringify(scene, null, 2),
    "```",
    "",
  ].join("\n");
}

/* ── SVG preview ── */
export function toSVG(ea) {
  const els = sceneElements(ea);
  if (!els.length) return "<svg xmlns='http://www.w3.org/2000/svg'/>";
  const pad = 40;
  const minX = Math.min(...els.map((e) => e.x)) - pad;
  const minY = Math.min(...els.map((e) => e.y)) - pad;
  const maxX = Math.max(...els.map((e) => e.x + (e.width || 0))) + pad;
  const maxY = Math.max(...els.map((e) => e.y + (e.height || 0))) + pad;

  const parts = [];
  const FONT = "font-family='Segoe UI, Helvetica, sans-serif'";

  for (const el of els) {
    if (el.type === "frame") {
      parts.push(
        `<rect x='${el.x}' y='${el.y}' width='${el.width}' height='${el.height}' fill='none' stroke='${el.strokeColor}' stroke-width='2' rx='10' stroke-dasharray='10 6'/>`
      );
      if (el.name) {
        parts.push(
          `<text x='${el.x + 14}' y='${el.y - 8}' ${FONT} font-size='15' fill='${el.strokeColor}'>📁 ${esc(el.name)}</text>`
        );
      }
    } else if (el.type === "embeddable") {
      parts.push(
        `<rect x='${el.x}' y='${el.y}' width='${el.width}' height='${el.height}' fill='#f5f0ff' stroke='#8b5cf6' rx='6'/>`
      );
      parts.push(
        `<line x1='${el.x}' y1='${el.y}' x2='${el.x + el.width}' y2='${el.y + el.height}' stroke='#d8ccf5'/>`
      );
      const lbl = (el.link || "").replace(/^\[\[|\]\]$/g, "").split("/").slice(-2, -1)[0] || "";
      parts.push(
        `<text x='${el.x + 10}' y='${el.y + 18}' ${FONT} font-size='13' fill='#6d28d9'>▶ ${esc(lbl)}</text>`
      );
    } else if (el.type === "text") {
      const boxId = el.boundElementBox;
      const box = boxId ? ea._scene.get(boxId) : null;
      if (box) {
        parts.push(
          `<rect x='${box.x}' y='${box.y}' width='${box.width}' height='${box.height}' fill='#ffffff' stroke='${box.strokeColor}' rx='8'/>`
        );
      }
      const lines = String(el.text).split("\n");
      const lh = Math.round((el.fontSize || 16) * 1.28);
      const anchor = el.textAlign === "center" ? "middle" : "start";
      const tx = box && el.textAlign === "center" ? box.x + box.width / 2 : el.x;
      parts.push(
        `<text x='${tx}' y='${el.y + lh * 0.85}' ${FONT} font-size='${el.fontSize}' fill='${el.strokeColor}' text-anchor='${anchor}'>` +
          lines
            .map((l, i) => `<tspan x='${tx}' dy='${i === 0 ? 0 : lh}'>${esc(l)}</tspan>`)
            .join("") +
          (el.link ? `</text><circle cx='${(box ? box.x + box.width : el.x + el.width) - 8}' cy='${(box ? box.y : el.y) + 8}' r='4' fill='#2563eb'/>` : "</text>")
      );
    } else if (el.type === "arrow") {
      const [x1, y1] = el.points[0];
      const [x2, y2] = el.points[el.points.length - 1];
      parts.push(
        `<line x1='${el.x + x1}' y1='${el.y + y1}' x2='${el.x + x2}' y2='${el.y + y2}' stroke='${el.strokeColor}' stroke-dasharray='6 5'/>`
      );
    }
  }

  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${minX} ${minY} ${maxX - minX} ${maxY - minY}' width='${Math.min(maxX - minX, 1400)}' font-family='Segoe UI, Helvetica, sans-serif'>` +
    `<rect x='${minX}' y='${minY}' width='${maxX - minX}' height='${maxY - minY}' fill='#fdfdfd'/>` +
    parts.join("") +
    `</svg>`
  );
}
