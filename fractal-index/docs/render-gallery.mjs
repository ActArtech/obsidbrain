// Render .excalidraw.md drawings (our generated ones) to PNG gallery images
// via the SVG renderer + headless Chrome.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { toSVG } from "../test/serialize.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const VAULT = path.join(HERE, "..", "..", "dev-vault");
const OUT = path.join(HERE, "..", "docs", "images");
fs.mkdirSync(OUT, { recursive: true });

const shots = [
  ["Garden/_index.excalidraw.md", "garden-root.png", 1600, 1400],
  ["Garden/Fields/_index.excalidraw.md", "garden-fields.png", 1100, 900],
  ["Garden/Fields/Topics/_index.excalidraw.md", "garden-topics.png", 1400, 800],
  ["Garden/Sources/_index.excalidraw.md", "garden-sources.png", 1200, 700],
  ["Projects/_index.excalidraw.md", "projects-root.png", 1100, 1200],
  ["Research/Fields/_index.excalidraw.md", "research-fields.png", 1200, 800],
];

for (const [rel, name, w, h] of shots) {
  const md = fs.readFileSync(path.join(VAULT, rel), "utf8").replace(/\r\n/g, "\n");
  const m = md.match(/```json\n([\s\S]*?)\n```/);
  if (!m) { console.log(name, "SKIP (compressed or missing json)"); continue; }
  const scene = JSON.parse(m[1]);
  const els = scene.elements.filter((e) => !e.isDeleted);
  const fakeEA = { _scene: new Map(els.map((e) => [e.id, e])) };
  const svgPath = path.join(OUT, name + ".svg");
  fs.writeFileSync(svgPath, toSVG(fakeEA));
  console.log(name, "<-", rel, "elements:", els.length);
}
