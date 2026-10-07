// graph-tests.mjs — property graph model + nested systems.
// Pure node tests over a synthetic fixture vault (no Obsidian needed).
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { Graph, extractGraph } from "../lib/graph.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const VAULT = path.join(HERE, "tmp-graph-vault");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("FAIL  " + name + "\n      " + e.message); }
}

/* ── fixture vault ──
   Brain/
     _connections/            Fields--Inbox.md          (system-to-system)
     Fields/
       _connections/          (empty)
       Topics/
         _connections/        Emergence--Networks.md    (nested level, typed)
         Emergence.md         [[Networks]] [[Fields/Systems Thinking]] [[Ghost]]
         Networks.md          [[Emergence|see emergence]]
         Chaos.md
       Systems Thinking.md    [[Fields/Topics/Emergence.md]]
     Inbox/
       _connections/
       Scratch.md             (no links)
     Fields/diagram.excalidraw.md   (drawing — must NOT be a node)
*/
function write(rel, content) {
  const abs = path.join(VAULT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}
fs.rmSync(VAULT, { recursive: true, force: true });
write("Brain/Fields/Topics/Emergence.md",
  "# Emergence\n- [[Networks]]\n- [[Fields/Systems Thinking]]\n- [[Ghost]]\n");
write("Brain/Fields/Topics/Networks.md", "# Networks\n[[Emergence|see emergence]]\n");
write("Brain/Fields/Topics/Chaos.md", "# Chaos\n");
write("Brain/Fields/Systems Thinking.md", "# Systems Thinking\n[[Fields/Topics/Emergence.md]]\n");
write("Brain/Fields/diagram.excalidraw.md", "EXCALIDRAW DRAWING\n");
write("Brain/Inbox/Scratch.md", "# Scratch\n");
write("Brain/Fields/Topics/_connections/Emergence--Networks.md",
  '---\ntype: connection\nfrom: "[[Brain/Fields/Topics/Emergence.md]]"\nto: "[[Networks]]"\nrelation: resonates\nmutual: true\nweight: 2\nexclusions: true\n---\n\nBoth about local rules creating global order.\n');
write("Brain/_connections/Fields--Inbox.md",
  '---\ntype: connection\nfrom: "[[Brain/Fields]]"\nto: "[[Brain/Inbox]]"\nrelation: nourishes\nweight: 3\n---\n\nField notes mature from inbox sparks.\n');

const g = extractGraph(VAULT, "Brain");
const ids = () => new Set(g.nodes.keys());

/* ── extraction: nodes ── */
test("notes are nodes; drawings and _connections are not", () => {
  assert.ok(ids().has("Brain/Fields/Topics/Emergence.md"));
  assert.ok(![...ids()].some((id) => id.includes("_connections/")));
  assert.ok(![...ids()].some((id) => id.endsWith(".excalidraw.md")));
});
test("every content folder is a System node, root included", () => {
  for (const sys of ["Brain", "Brain/Fields", "Brain/Fields/Topics", "Brain/Inbox"]) {
    const n = g.node(sys);
    assert.ok(n && n.labels.has("System"), sys + " should be a System");
  }
  const root = g.node("Brain");
  assert.equal(root.properties.root, true);
  assert.equal(root.properties.depth, 0);
  assert.equal(g.node("Brain/Fields/Topics").properties.depth, 2);
});
test("wikilink edges resolve: full path, bare basename, alias, .md suffix", () => {
  const em = "Brain/Fields/Topics/Emergence.md";
  const out = g.neighbors(em, { direction: "out" }).map((n) => n.node);
  assert.ok(out.includes("Brain/Fields/Topics/Networks.md"), "bare basename");
  assert.ok(out.includes("Brain/Fields/Systems Thinking.md"), "path without extension");
  assert.ok(out.includes("Brain/Fields/Topics/Systems Thinking.md") === false);
  const st = g.neighbors("Brain/Fields/Systems Thinking.md", { direction: "out" }).map((n) => n.node);
  assert.ok(st.includes("Brain/Fields/Topics/Emergence.md"), ".md-suffixed link");
  assert.ok(!out.some((n) => n.includes("Ghost")), "unresolvable links are dropped");
});

/* ── extraction: typed relationships from connection notes ── */
test("nested _connections dirs produce typed edges", () => {
  const e = g.edgesByType("RESONATES").find((e) => e.properties.note?.endsWith("Emergence--Networks.md"));
  assert.ok(e, "edge exists");
  assert.equal(e.start, "Brain/Fields/Topics/Emergence.md");
  assert.equal(e.end, "Brain/Fields/Topics/Networks.md");
  assert.equal(e.properties.weight, 2);
  assert.equal(e.properties.mutual, true);
});
test("a connection note upgrades an inferred wikilink edge (no duplicate)", () => {
  const dupes = g.neighbors("Brain/Fields/Topics/Emergence.md", { direction: "out" })
    .filter((n) => n.node.endsWith("Networks.md"));
  assert.equal(dupes.length, 1);
  assert.equal(g.edge(dupes[0].edgeId).type, "RESONATES");
});
test("system-to-system connection notes link System nodes", () => {
  const e = g.edgesByType("NOURISHES")[0];
  assert.ok(e, "edge exists");
  assert.equal(e.type, "NOURISHES");
  assert.equal(e.start, "Brain/Fields");
  assert.equal(e.end, "Brain/Inbox");
  assert.ok(g.node("Brain/Fields").labels.has("System"));
  assert.ok(g.node("Brain/Inbox").labels.has("System"));
});

/* ── hierarchy queries ── */
test("systemOf / ancestors walk the containment chain", () => {
  const em = "Brain/Fields/Topics/Emergence.md";
  assert.equal(g.systemOf(em), "Brain/Fields/Topics");
  assert.deepEqual(g.ancestors(em), ["Brain/Fields/Topics", "Brain/Fields", "Brain"]);
});
test("descendants separate sub-systems from notes", () => {
  const d = g.descendants("Brain/Fields");
  assert.deepEqual(d.systems, ["Brain/Fields/Topics"]);
  assert.ok(d.notes.includes("Brain/Fields/Topics/Emergence.md"));
  assert.ok(d.notes.includes("Brain/Fields/Systems Thinking.md"));
  assert.equal(g.descendants("Brain/Inbox").systems.length, 0);
});

/* ── system roll-ups ── */
test("systemStats: internal vs bridging edges and density", () => {
  const st = g.systemStats("Brain/Fields");
  assert.equal(st.notes, 4); // 3 topics + Systems Thinking
  assert.equal(st.subSystems, 1);
  // internal: ST<->Emergence (2) + Emergence<->Networks via the connection
  // note (1 — the inferred reverse wikilink is suppressed for covered pairs)
  assert.equal(st.internalEdges, 3);
  // external: the Fields->Inbox system-level connection note
  assert.equal(st.externalEdges, 1);
  assert.equal(st.density, Number((3 / (4 * 3)).toFixed(4)));
  assert.ok(st.topNotes[0].basename.match(/Emergence|Networks/));
});
test("systemStats bridges name what leaves the system", () => {
  const st = g.systemStats("Brain/Fields");
  assert.ok(st.bridges.some((b) => b.basename === "Inbox"));
});

/* ── hierarchy as a separate dimension ── */
test("link algorithms exclude CONTAINS by default", () => {
  const root = g.degreeCentrality().find((r) => r.id === "Brain");
  assert.equal(root.degree, 0, "root's fame is not its child count");
  const withHierarchy = g.degree("Brain", { excludeTypes: [] });
  assert.equal(withHierarchy, 2, "opt-in sees containment (Fields + Inbox)");
});
test("pageRank ignores containment even when asked for all edges except via opt-in", () => {
  const pr = g.pageRank();
  const max = pr[0].score;
  assert.ok(max < 0.5, "no node dominates just by being a folder");
});

/* ── induced subgraph ── */
test("inducedSubgraph keeps only internal link edges by default", () => {
  const sub = g.inducedSubgraph([
    "Brain/Fields/Topics/Emergence.md", "Brain/Fields/Topics/Networks.md", "Brain/Fields/Topics/Chaos.md",
  ]);
  assert.equal(sub.nodes.size, 3);
  assert.equal([...sub.edges.values()].filter((e) => e.type === "CONTAINS").length, 0);
  assert.equal(sub.edges.size, 1); // Emergence->Networks (resonates note; reverse wikilink suppressed)
  const withH = g.inducedSubgraph(
    ["Brain/Fields", "Brain/Fields/Topics"], { includeHierarchy: true });
  assert.ok([...withH.edges.values()].some((e) => e.type === "CONTAINS"));
});

/* ── hierarchical communities ── */
test("detectCommunitiesHierarchical returns a nested dendrogram", () => {
  const tree = g.detectCommunitiesHierarchical({ depth: 2, minSize: 2 });
  assert.equal(tree.level, 0);
  assert.equal(tree.nodes.length, 5); // all Note nodes
  assert.ok(tree.children.length >= 1, "top-level split exists");
  for (const child of tree.children) {
    assert.equal(child.level, 1);
    assert.ok(child.nodes.length >= 1);
    assert.ok(typeof child.label === "string" && child.label.length > 0);
  }
  // the Emergence/Networks pair (2 link edges) must cluster together somewhere
  const flat = (n) => [n.label, ...n.children.flatMap(flat)];
  const labels = flat(tree);
  assert.ok(labels.length >= 2);
});
test("community labels name a keystone member", () => {
  const tree = g.detectCommunitiesHierarchical({ depth: 1, minSize: 2 });
  const keystone = tree.children[0].label;
  const member = g.nodesByLabel("Note").find((id) => id.includes(keystone));
  assert.ok(member, "label matches an actual note basename");
});

/* ── pattern matching + export ── */
test("match filters by labels and edge type", () => {
  const rows = g.match({ edgeType: "NOURISHES", sourceLabel: "System", targetLabel: "System" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].a.id, "Brain/Fields");
});
test("toCypher emits nodes and typed edges incl. containment", () => {
  const cy = g.toCypher();
  assert.ok(cy.includes(":System"));
  assert.ok(cy.includes(":Note"));
  assert.ok(cy.includes(":CONTAINS"));
  assert.ok(cy.includes(":RESONATES"));
});
test("toJSON / fromJSON round-trips labels and edge types", () => {
  const copy = Graph.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(copy.nodes.size, g.nodes.size);
  assert.equal(copy.edges.size, g.edges.size);
  assert.ok(copy.node("Brain").labels.has("System"));
  assert.equal(copy.edgesByType("NOURISHES").length, 1);
});

/* ── model-level unit tests ── */
test("multiple relationships between the same pair coexist as separate edges", () => {
  // second connection note for the Emergence/Networks pair (different aspect)
  write("Brain/Fields/Topics/_connections/Emergence--Networks--2.md",
    '---\ntype: connection\nfrom: "[[Brain/Fields/Topics/Emergence.md]]"\nto: "[[Networks]]"\nrelation: nourishes\nweight: 1\n---\n\nNetwork diagrams feed the emergence examples.\n');
  const g2 = extractGraph(VAULT, "Brain");
  const pairEdges = [...g2.edges.values()].filter(
    (e) => e.type !== "CONTAINS" &&
      ((e.start === "Brain/Fields/Topics/Emergence.md" && e.end === "Brain/Fields/Topics/Networks.md") ||
       (e.start === "Brain/Fields/Topics/Networks.md" && e.end === "Brain/Fields/Topics/Emergence.md")));
  assert.equal(pairEdges.length, 2, "two notes = two relationships");
  assert.deepEqual(pairEdges.map((e) => e.type).sort(), ["NOURISHES", "RESONATES"]);
  // the wikilink between the pair is NOT duplicated as an inferred edge
  assert.ok(pairEdges.every((e) => !e.properties.inferred), "inferred edge suppressed for covered pairs");
  assert.equal(g2.neighbors("Brain/Fields/Topics/Emergence.md", { excludeTypes: ["CONTAINS"] })
    .filter((n) => n.node.endsWith("Networks.md")).length, 2);
});

test("Graph: addEdge upsert does not duplicate adjacency", () => {
  const h = new Graph();
  h.addEdge("e1", "PEER", "a", "b");
  h.addEdge("e1", "RESONATES", "a", "b");
  assert.equal(h.neighbors("a").length, 1);
  assert.equal(h.neighbors("b").length, 1);
  assert.equal(h.edge("e1").type, "RESONATES");
});
test("Graph: extractGraph with hierarchy=false stays flat", () => {
  const flat = extractGraph(VAULT, "Brain", { hierarchy: false });
  assert.equal(flat.nodesByLabel("System").length, 0);
  assert.ok(flat.nodesByLabel("Note").length > 0);
});

console.log(`\ngraph tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
