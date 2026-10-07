# Graph Architecture Review — Neo4j Principles Applied to Obsidbrain

*A systematic review of our knowledge-graph system through the lens of Neo4j's property graph model, Cypher query patterns, and graph data science algorithms — with concrete examples running on the Knowledge Garden brain (62 nodes, 156 edges).*

---

## 1. What we already do right (mapped to Neo4j concepts)

| Neo4j concept | Our implementation | Status |
|---|---|---|
| **Property graph model** — nodes have labels + properties, relationships have types + properties | Notes have `customData.kind` + frontmatter; connection notes have `from`/`to`/`relation`/`weight`; arrows have `rel`/`link` | ✅ Implicit, works |
| **Reified relationships** — when a relationship needs its own properties, model it as a node | Connection notes: `A → [connection note] → B` — exactly the Neo4j best practice for rich relationships | ✅ Built |
| **Multiple relationship types** — RESONATES, PEER, BRIDGES, NOURISHES, FEEDS | Our 5-type taxonomy inferred from topology | ✅ Built |
| **Labels** — group nodes into sets | `customData.kind` (file, pod-label, connection) + folder-based labels (Fields, Methods, Sources) | ⚠️ Implicit, no formal label query |
| **Native graph storage** — built for traversal, not relational joins | Our maps ARE drawings, not a graph database — the graph is *extracted*, not stored natively | ❌ Gap |

---

## 2. What Neo4j principles reveal as gaps

### Gap 1: No graph model layer

Our "graph" is **scattered across three layers** (wikilinks in md files, Excalidraw customData, connection-note frontmatter). None of these is an explicit graph model that can be queried or traversed.

**Neo4j principle:** the graph IS the database. You query it directly, not through a visual layer.

**What we built to fix this:** [`fractal-index/lib/graph.mjs`](lib/graph.mjs) — a zero-dependency property graph model with:
- `addNode(id, labels, properties)` / `addEdge(id, type, start, end, properties)`
- `neighbors(id, {type, direction})` — index-free adjacency
- `match({sourceLabel, edgeType, targetLabel, where})` — Cypher-like pattern matching
- `toJSON()` / `toCypher()` — export for Neo4j import

### Gap 2: No graph queries

"Show me all notes that have a resonates relationship with Systems Thinking" — that should be a **query**, not a visual scan.

**What we built:**
```js
import { extractGraph } from "./lib/graph.mjs";
const g = extractGraph("dev-vault", "Garden");

// Cypher-equivalent: MATCH (a)-[:PEER]->(b) RETURN a, b
const peers = g.match({ edgeType: "PEER" });

// Cypher-equivalent: MATCH (a:Note)-[r]->(b) WHERE a.basename CONTAINS "Emergence"
const emergenceLinks = g.match({
  where: (row) => row.a.properties.basename.includes("Emergence")
});
```

### Gap 3: No graph algorithms

Neo4j's GDS (Graph Data Science) library provides 50+ algorithms. The most useful for a knowledge brain:

| Algorithm | What it answers | Our implementation |
|---|---|---|
| **Degree centrality** | Which notes are hubs? | `g.degreeCentrality()` |
| **PageRank** | Which notes are most influential? | `g.pageRank()` |
| **Community detection** | Which notes cluster together? | `g.detectCommunities()` |
| **Shortest path** | How are A and B connected? | `g.shortestPath(start, end)` |
| **K-hop neighborhood** | What's within N hops of this note? | `g.neighborhood(start, hops)` |

**All implemented. Running on the Knowledge Garden brain (62 nodes, 156 edges):**

```
── Top 5 by degree centrality ──
17  _index.excalidraw.md   (the hub maps)
13  Systems Thinking.md    (the most connected idea)
13  Zettelkasten.md        (the most connected method)
12  _index.excalidraw.md   (another map)
11  Information Theory.md  (a highly connected field)

── Top 5 by PageRank ──
0.136  Systems Thinking    (most influential idea)
0.116  Emergence           (hub topic)
0.087  Biology             (connected field)
0.087  Networks            (connected topic)
0.065  Information Theory  (connected field)

── Communities ──
Community 1: Biology, Systems Thinking, Emergence, Entropy and Life,
             Feedback, Game Theory  (the "complexity systems" cluster)
Community 2: Information Theory, Mathematics, Chaos, Signal and Noise,
             Fleeting notes, Questions  (the "math/information" cluster)
Community 3: Zettelkasten, Daily Note Ritual, Weekly Review,
             Feynman Technique, journal entries  (the "practice" cluster)
Community 4: Donella Meadows, Thinking in Systems, Marginalia
             (the "sources" cluster)
```

### Gap 4: No traversal

"Start at Emergence, follow connections, show me everything within 2 hops" — that's a traversal.

**What we built:** `g.neighborhood(start, hops)` + `g.shortestPath(start, end)`

### Gap 5: No Neo4j export

For heavy-duty analysis (50+ GDS algorithms), export to a real Neo4j database:

```js
import { extractGraph } from "./lib/graph.mjs";
import fs from "node:fs";
const g = extractGraph("dev-vault", "Garden");
fs.writeFileSync("garden.cypher", g.toCypher());
// Then: cypher-shell -f garden.cypher
```

---

## 3. The architectural insight

Our system was already generating a **real property graph** — we just weren't treating it as one:

```
Your notes (md)  ──wikilinks──►  implicit graph
       │                              │
       ▼                              ▼
Fractal Index maps            graph.mjs (NEW)
       │                              │
       ▼                              ▼
  visual arrows              explicit queries + algorithms
       │                              │
       ▼                              ▼
  ExcaliBrain graph           Neo4j export (optional)
```

The two paths are **parallel views of the same graph** — one visual, one computational. The graph model layer is the bridge.

---

## 4. Concrete examples on the Knowledge Garden brain

### "Which notes are the hubs?"
```js
g.degreeCentrality().slice(0, 5)
// → Systems Thinking (13), Zettelkasten (13), Information Theory (11)
```

### "What does Emergence connect to?"
```js
g.neighbors("Garden/Fields/Topics/Emergence.md")
// → Neuroscience, Complexity Science, Biology (via community links)
```

### "How are Emergence and the Zettelkasten method related?"
```js
g.shortestPath(
  "Garden/Fields/Topics/Emergence.md",
  "Garden/Methods/Zettelkasten.md"
)
// → path through Systems Thinking (they're both children of the same field)
```

### "What clusters exist in my brain?"
```js
g.detectCommunities()
// → 4 communities: complexity systems, math/information,
//   practice/methods, sources/people
```

### "Which source supports which idea?"
```js
g.match({ sourceLabel: "Note", edgeType: "RESONATES" })
// → Thinking in Systems → Systems Thinking (connection note as reified edge)
```

---

## 5. What this means for the system

The graph model layer (graph.mjs) is the **foundation for everything that comes next**:

| Feature | How the graph enables it |
|---|---|
| **Map-diff report** | Compare the graph before/after Sync — added/removed edges = what changed |
| **Coverage/age lens** | Color nodes by last-modified date (stored as properties) |
| **Smart Fractal Sync** | Only regenerate maps whose subgraph changed (graph diff) |
| **MCP graph queries** | Agents query the knowledge graph as tool calls (`query_brain("show hubs")`) |
| **Semantic search** | PageRank-weighted search — important notes rank higher |
| **Auto-clustering** | Suggest folder structure from detected communities |
| **Neo4j dashboard** | Import into Neo4j Bloom for interactive exploration |

---

## 6. Files

| File | What it is |
|---|---|
| [`lib/graph.mjs`](../lib/graph.mjs) | Property graph model + algorithms + extraction + Cypher export |
| [`lib/components.mjs`](../lib/components.mjs) | Self-measuring UI components |
| [`lib/layout.mjs`](../lib/layout.mjs) | Shelf-packing layout solver with zero-overlap invariant |
| [`lib/invariant.mjs`](../lib/invariant.mjs) | The invariant check |
| [`test/run-tests.mjs`](../test/run-tests.mjs) | 56 checks including T33 (zero-overlap) and T34 (connection notes) |
