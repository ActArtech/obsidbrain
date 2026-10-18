// mermaid-view.mjs — render a brain's graph as Mermaid flowcharts, one per
// folder, following the systembrief locked rules:
//   flowchart TB · quoted labels ≤ ~28 chars · alnum node ids · no path-shape
//   syntax · relation-typed labeled edges (parallel edges welcome) ·
//   classDefs for meaning · ≤ 12 nodes per diagram (overview/detail split —
//   the fractal already provides it: one diagram per folder level).

export const MERMAID_STYLES = {
  resonates: { stroke: "#7c3aed", label: "resonates" },
  peer: { stroke: "#8b5cf6", label: "peer" },
  bridges: { stroke: "#2563eb", label: "bridges" },
  nourishes: { stroke: "#7c6f9e", label: "nourishes" },
  feeds: { stroke: "#a78bfa", label: "feeds" },
  contains: { stroke: "#94a3b8", label: null },
  inferred: { stroke: "#cbd5e1", label: null },
};

const sanitizeId = (rel) => "n" + String(rel).replace(/[^a-zA-Z0-9]/g, "_");
const clip = (s, n = 28) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Mermaid header with locked classDefs (light paper, relation colors). */
function header() {
  return [
    "flowchart TB",
    "  classDef folder fill:#fff7ed,stroke:#c2410c,color:#1d1d1f,stroke-width:2px",
    "  classDef note fill:#ffffff,stroke:#64748b,color:#1d1d1f",
    "  classDef hub fill:#ecfdf5,stroke:#047857,color:#1d1d1f,stroke-width:2px",
  ];
}

/**
 * One folder level → Mermaid source.
 * @param {object} g - Graph from graph.mjs
 * @param {string} folder - folder rel path ("" = brain root)
 * @param {object} opts - { maxNodes = 12, maxEdges = 16 }
 */
export function folderToMermaid(g, folder, { maxNodes = 12, maxEdges = 16 } = {}) {
  const prefix = folder ? folder + "/" : "";
  const folderNode = folder || null;

  // direct children: subfolders + notes directly inside
  const subFolders = folderSetOf(g, folder);
  const directNotes = g.nodesByLabel("Note").filter((id) => {
    const parent = id.slice(0, Math.max(id.lastIndexOf("/"), 0));
    return parent === folder;
  });

  // budget: folders first, then strongest direct notes
  const nodes = [];
  if (folderNode) nodes.push(folderNode);
  for (const s of subFolders) if (nodes.length < maxNodes) nodes.push(s);
  const ranked = directNotes
    .map((id) => ({ id, score: g.degree(id, { excludeTypes: ["CONTAINS"] }) }))
    .sort((a, b) => b.score - a.score);
  for (const r of ranked) if (nodes.length < maxNodes) nodes.push(r.id);
  const nodeSet = new Set(nodes);

  // edges between the kept nodes, strongest first, CONTAINS flattened into
  // containment styling; parallel edges (same pair) all survive
  const edges = [];
  const seenPairs = new Map();
  for (const [, e] of g.edges) {
    if (!nodeSet.has(e.start) || !nodeSet.has(e.end)) continue;
    if (e.type === "CONTAINS" && folderNode && e.start === folderNode) continue; // implied by grouping
    edges.push(e);
  }
  edges.sort((a, b) => (b.properties.weight || 1) - (a.properties.weight || 1));
  const kept = edges.slice(0, maxEdges);

  const lines = header();
  const labelOf = (id) => {
    const n = g.node(id);
    const name = (n && (n.properties.name || n.properties.basename)) || id.split("/").pop();
    const isFolder = n && n.labels.has("System");
    const badge = isFolder ? "📁 " : "";
    return badge + clip(name, 26);
  };
  for (const id of nodes) {
    const id2 = sanitizeId(id);
    const n = g.node(id);
    const cls = id === folderNode ? "hub" : n && n.labels.has("System") ? "folder" : "note";
    lines.push(`  ${id2}["${labelOf(id)}"]:::${cls}`);
  }
  for (const e of kept) {
    const a = sanitizeId(e.start), b = sanitizeId(e.end);
    const rel = (e.properties.relation || e.type || "peer").toLowerCase();
    const st = MERMAID_STYLES[rel] || MERMAID_STYLES.peer;
    const label = st.label ? `|"${clip(st.label + (e.properties.weight > 1 ? " ×" + e.properties.weight : ""), 20)}"|` : "";
    const arrow = rel === "inferred" ? "-.->" : "-->";
    lines.push(`  ${a} ${arrow}${label} ${b}`);
  }
  if (!nodes.length) lines.push(`  EMPTY["(empty folder)"]:::note`);
  return lines.join("\n");
}

function folderSetOf(g, folder) {
  // direct sub-systems of this folder
  const out = [];
  const prefix = folder ? folder + "/" : "";
  for (const id of g.nodesByLabel("System")) {
    const parent = id.slice(0, Math.max(id.lastIndexOf("/"), 0));
    if (parent === folder && id !== folder) out.push(id);
  }
  return out.sort();
}

/**
 * Every folder level of the graph → { "Garden/Fields": "flowchart TB …", … }
 * ordered root-first.
 */
export function graphToMermaidMaps(g, brainRoot) {
  const folders = [...g.nodesByLabel("System")].sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );
  const out = new Map();
  for (const f of folders) out.set(f, folderToMermaid(g, f));
  return out;
}
