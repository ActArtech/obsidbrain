#!/usr/bin/env node
// nested-systems.mjs — report the nested systems of a brain.
//
// Declared systems come from the folder tree (System nodes + CONTAINS
// edges); emergent systems come from hierarchical community detection
// over the actual links; system-to-system relationships come from
// connection notes at any level. Run:
//
//   node examples/nested-systems.mjs [vaultPath] [brain]
//
// Defaults to the repo's dev vault, Garden brain.

import path from "node:path";
import url from "node:url";
import { extractGraph } from "../lib/graph.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const vault = path.resolve(HERE, "..", process.argv[2] || "../dev-vault");
const brain = process.argv[3] || "Garden";

const g = extractGraph(vault, brain);
const pad = (s, n) => String(s).padEnd(n);
const rel = (id) => id.split("/").pop();

/* ── declared systems: the folder tree with roll-ups ── */
console.log(`\n═══ declared systems — ${brain} ═══`);
console.log("    (folder = System node; containment = CONTAINS edges)\n");
const systems = g.nodesByLabel("System");
const stats = new Map(systems.map((id) => [id, g.systemStats(id)]));
for (const id of systems.sort((a, b) => a.localeCompare(b))) {
  const st = stats.get(id);
  const indent = "  ".repeat(st.depth);
  const nums = pad(st.notes, 3) + " notes  " + pad(st.internalEdges, 3) + " internal  " + pad(st.externalEdges, 3) + " bridges  density " + st.density;
  console.log(`${indent}${rel(id)}/   ${st.root ? "(root) " : ""}${nums}`);
  const tops = st.topNotes.map((t) => t.basename).join(", ");
  if (tops) console.log(`${indent}    keystone notes: ${tops}`);
}

/* ── system-to-system relationships (connection notes) ── */
console.log(`\n═══ system-to-system relationships ═══`);
const sysRels = g.match({ sourceLabel: "System", targetLabel: "System" }).filter((r) => r.r.type !== "CONTAINS");
if (!sysRels.length) {
  console.log("    none yet — write a connection note whose from/to are folders:");
  console.log(`    e.g. ${brain}/_connections/Inbox--Fields.md  with  from: "[[${brain}/Inbox]]"  to: "[[${brain}/Fields]]"`);
} else {
  for (const r of sysRels) {
    console.log(`    ${rel(r.a.id)}  --[${r.r.type}${r.r.properties.weight > 1 ? " x" + r.r.properties.weight : ""}]-->  ${rel(r.b.id)}`);
    console.log(`        note: ${r.r.properties.note}`);
  }
}

/* ── emergent systems: hierarchical communities ── */
console.log(`\n═══ emergent systems — communities within communities ═══`);
console.log("    (label propagation, recursive; label = keystone note)\n");
const tree = g.detectCommunitiesHierarchical({ depth: 2 });
const dump = (n, ind) => {
  console.log(`${ind}${n.label}  (${n.nodes.length} notes)`);
  n.children.forEach((c) => dump(c, ind + "    "));
};
dump(tree, "  ");

/* ── global keystones ── */
console.log(`\n═══ keystone notes (PageRank, links only — containment excluded) ═══\n`);
for (const r of g.pageRank().slice(0, 6)) {
  console.log(`    ${pad((g.node(r.id)?.properties.basename || r.id), 34)} ${r.score}`);
}

/* ── one Cypher taste ── */
console.log(`\n═══ Cypher export sample (g.toCypher()) ═══\n`);
console.log(
  g.toCypher()
    .split("\n")
    .filter((l) => l.includes(":System") || l.includes("CONTAINS"))
    .slice(0, 4)
    .join("\n")
    .replace(/^/gm, "    ")
);
console.log(`\n    (${g.nodes.size} nodes, ${g.edges.size} edges total — full export via the library)\n`);
