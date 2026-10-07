// graph.mjs — property graph model, queries, and algorithms.
// Neo4j principles applied natively (zero deps): property graph model,
// index-free adjacency, Cypher-like pattern matching, graph algorithms.
//
// The graph is extracted from the vault's wikilinks + connection notes,
// stored as an adjacency list, and queried/analyzed without a server.
//
// Nested systems: every folder is a System node and containment is a
// first-class CONTAINS edge, so systems can hold sub-systems, be linked
// to each other by connection notes, and roll their metrics up the tree.
// Link algorithms exclude CONTAINS edges by default — hierarchy and
// connectivity are separate dimensions that compose, not mix.

import fs from "node:fs";
import path from "node:path";

export const HIERARCHY_TYPE = "CONTAINS";

/* ══════════════ graph model ══════════════ */

export class Graph {
  constructor() {
    this.nodes = new Map();     // id → { labels: Set, properties: Object }
    this.edges = new Map();     // id → { type, start, end, properties }
    this.adjacency = new Map(); // nodeId → [{ edgeId, other, direction }]
  }

  addNode(id, labels = [], properties = {}) {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { labels: new Set(labels), properties });
      this.adjacency.set(id, []);
    }
    return this.nodes.get(id);
  }

  addEdge(id, type, start, end, properties = {}) {
    if (!this.nodes.has(start)) this.addNode(start);
    if (!this.nodes.has(end)) this.addNode(end);
    if (this.edges.has(id)) {
      // upsert: re-adding an edge id updates it (e.g. a connection note
      // upgrading an inferred wikilink edge) without duplicating adjacency
      const e = this.edges.get(id);
      Object.assign(e, { type, start, end, properties });
      return id;
    }
    this.edges.set(id, { type, start, end, properties });
    this.adjacency.get(start).push({ edgeId: id, other: end, direction: "out" });
    this.adjacency.get(end).push({ edgeId: id, other: start, direction: "in" });
    return id;
  }

  node(id) { return this.nodes.get(id) || null; }
  edge(id) { return this.edges.get(id) || null; }

  /** Does an edge pass the type filters of a query? */
  _allowed(e, { type = null, excludeTypes = null } = {}) {
    if (type && e.type !== type) return false;
    if (excludeTypes && excludeTypes.includes(e.type)) return false;
    return true;
  }

  neighbors(id, { type = null, direction = null, excludeTypes = null } = {}) {
    return (this.adjacency.get(id) || [])
      .filter((a) => {
        const e = this.edges.get(a.edgeId);
        if (!e || !this._allowed(e, { type, excludeTypes })) return false;
        if (direction && a.direction !== direction) return false;
        return true;
      })
      .map((a) => {
        const edge = this.edges.get(a.edgeId);
        return { node: a.other, edgeId: a.edgeId, direction: a.direction, properties: edge?.properties ?? {} };
      });
  }

  degree(id, { type = null, excludeTypes = null } = {}) {
    return this.neighbors(id, { type, excludeTypes }).length;
  }

  nodesByLabel(label) {
    return [...this.nodes.entries()]
      .filter(([_, n]) => n.labels.has(label))
      .map(([id]) => id);
  }

  edgesByType(type) {
    return [...this.edges.entries()]
      .filter(([_, e]) => e.type === type)
      .map(([id, e]) => ({ id, ...e }));
  }

  /* ══════════════ nested systems: hierarchy queries ══════════════ */

  /** The System node immediately containing `id` (via CONTAINS), or null. */
  systemOf(id) {
    for (const n of this.neighbors(id, { type: HIERARCHY_TYPE, direction: "in" })) {
      if (this.node(n.node)?.labels.has("System")) return n.node;
    }
    return null;
  }

  /** Chain of containing systems, nearest first: [parent, grandparent, …, root]. */
  ancestors(id) {
    const chain = [];
    let cur = this.systemOf(id);
    const seen = new Set([id]);
    while (cur && !seen.has(cur)) {
      chain.push(cur);
      seen.add(cur);
      cur = this.systemOf(cur);
    }
    return chain;
  }

  /**
   * Everything under a System: { systems: [subSystemIds…], notes: [NoteIds…] }.
   * `id` itself is not included.
   */
  descendants(id) {
    const systems = [];
    const notes = [];
    const queue = [id];
    const seen = new Set([id]);
    while (queue.length) {
      for (const n of this.neighbors(queue.shift(), { type: HIERARCHY_TYPE, direction: "out" })) {
        if (seen.has(n.node)) continue;
        seen.add(n.node);
        const node = this.node(n.node);
        if (!node) continue;
        if (node.labels.has("System")) { systems.push(n.node); queue.push(n.node); }
        else notes.push(n.node);
      }
    }
    return { systems, notes };
  }

  /**
   * Roll-up stats for one system, computed over its whole subtree:
   * size, internal connectivity, bridges leaving the system, density,
   * and the most influential notes inside it.
   */
  systemStats(id, { top = 3, excludeTypes = [HIERARCHY_TYPE] } = {}) {
    const sys = this.node(id);
    if (!sys || !sys.labels.has("System")) return null;
    const { systems, notes } = this.descendants(id);
    const members = new Set([id, ...systems, ...notes]);

    let internal = 0, external = 0;
    const bridgeTargets = new Map();
    for (const [_, e] of this.edges) {
      if (excludeTypes?.includes(e.type)) continue;
      const aIn = members.has(e.start), bIn = members.has(e.end);
      if (aIn && bIn) internal++;
      else if (aIn !== bIn) {
        external++;
        const outside = aIn ? e.end : e.start;
        bridgeTargets.set(outside, (bridgeTargets.get(outside) || 0) + 1);
      }
    }

    const sub = this.inducedSubgraph([...systems, ...notes]);
    const ranked = sub.pageRank({ type: null })
      .filter((r) => r.id !== id)
      .slice(0, top)
      .map((r) => {
        const n = this.node(r.id);
        return { id: r.id, score: r.score, basename: n?.properties.basename || n?.properties.name || r.id };
      });

    const pairs = notes.length * (notes.length - 1);
    return {
      id,
      name: sys.properties.name || id,
      depth: sys.properties.depth ?? 0,
      subSystems: systems.length,
      notes: notes.length,
      internalEdges: internal,
      externalEdges: external,
      density: pairs > 0 ? Number((internal / pairs).toFixed(4)) : 0,
      bridges: [...bridgeTargets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, top)
        .map(([targetId, count]) => {
          const t = this.node(targetId);
          return { id: targetId, count, basename: t?.properties.basename || t?.properties.name || targetId };
        }),
      topNotes: ranked,
    };
  }

  /**
   * Subgraph restricted to `ids`: copies those nodes and only the edges
   * whose both endpoints are inside the set. `includeHierarchy` keeps
   * CONTAINS edges too (default: link edges only).
   */
  inducedSubgraph(ids, { includeHierarchy = false } = {}) {
    const keep = new Set(ids);
    const sub = new Graph();
    for (const id of ids) {
      const n = this.nodes.get(id);
      if (n) sub.addNode(id, [...n.labels], { ...n.properties });
    }
    for (const [edgeId, e] of this.edges) {
      if (!keep.has(e.start) || !keep.has(e.end)) continue;
      if (!includeHierarchy && e.type === HIERARCHY_TYPE) continue;
      sub.addEdge(edgeId, e.type, e.start, e.end, { ...e.properties });
    }
    return sub;
  }

  /* ══════════════ Cypher-like pattern matching ══════════════ */

  /**
   * Match a pattern: (a:Label)-[r:TYPE]->(b:Label)
   * Returns [{ a, r, b }] where each is { id, properties }.
   */
  match({ sourceLabel = null, edgeType = null, targetLabel = null, where = null }) {
    const results = [];
    for (const [edgeId, edge] of this.edges) {
      if (edgeType && edge.type !== edgeType) continue;
      const a = this.nodes.get(edge.start);
      const b = this.nodes.get(edge.end);
      if (!a || !b) continue;
      if (sourceLabel && !a.labels.has(sourceLabel)) continue;
      if (targetLabel && !b.labels.has(targetLabel)) continue;
      const row = { a: { id: edge.start, ...a }, r: { id: edgeId, ...edge }, b: { id: edge.end, ...b } };
      if (where && !where(row)) continue;
      results.push(row);
    }
    return results;
  }

  /* ══════════════ graph algorithms ══════════════ */

  /**
   * Degree centrality: which nodes have the most connections?
   * Returns [{ id, degree, label }] sorted by degree (descending).
   * CONTAINS edges are excluded by default — hierarchy is not fame.
   */
  degreeCentrality({ label = null, type = null, excludeTypes = [HIERARCHY_TYPE] } = {}) {
    const results = [];
    for (const [id, node] of this.nodes) {
      if (label && !node.labels.has(label)) continue;
      results.push({ id, label: [...node.labels][0] || "", degree: this.degree(id, { type, excludeTypes }) });
    }
    return results.sort((a, b) => b.degree - a.degree);
  }

  /**
   * PageRank (simplified, power iteration): which nodes are most influential?
   * Returns [{ id, score }] sorted by score (descending).
   * CONTAINS edges are excluded by default.
   */
  pageRank({ damping = 0.85, iterations = 20, type = null, excludeTypes = [HIERARCHY_TYPE] } = {}) {
    const ids = [...this.nodes.keys()];
    const n = ids.length;
    if (!n) return [];
    const scores = new Map(ids.map((id) => [id, 1 / n]));
    const outDegree = new Map();
    for (const id of ids) {
      outDegree.set(id, this.neighbors(id, { type, direction: "out", excludeTypes }).length);
    }
    for (let iter = 0; iter < iterations; iter++) {
      const newScores = new Map();
      let danglingSum = 0;
      for (const id of ids) {
        if (outDegree.get(id) === 0) danglingSum += scores.get(id);
      }
      for (const id of ids) {
        let rank = (1 - damping) / n + (damping * danglingSum) / n;
        for (const [src, edge] of this.edges) {
          if (edge.end !== id) continue;
          if (!this._allowed(edge, { type, excludeTypes })) continue;
          if (outDegree.get(edge.start) > 0) {
            rank += damping * scores.get(edge.start) / outDegree.get(edge.start);
          }
        }
        newScores.set(id, rank);
      }
      for (const id of ids) scores.set(id, newScores.get(id));
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score: Number(score.toFixed(6)) }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Community detection (label propagation): which notes cluster together?
   * Returns Map<communityId, Set<nodeId>>.
   * CONTAINS edges are excluded by default.
   */
  detectCommunities({ iterations = 10, excludeTypes = [HIERARCHY_TYPE] } = {}) {
    const ids = [...this.nodes.keys()];
    const communities = new Map(ids.map((id) => [id, id])); // start: each node its own community

    for (let iter = 0; iter < iterations; iter++) {
      let changed = false;
      for (const id of ids) {
        // count neighbor communities
        const counts = new Map();
        for (const n of this.neighbors(id, { excludeTypes })) {
          const c = communities.get(n.node);
          if (c !== undefined) counts.set(c, (counts.get(c) || 0) + 1);
        }
        if (!counts.size) continue;
        // join the most common neighbor community
        let best = communities.get(id), bestCount = 0;
        for (const [c, count] of counts) {
          if (count > bestCount) { best = c; bestCount = count; }
        }
        if (best !== communities.get(id)) {
          communities.set(id, best);
          changed = true;
        }
      }
      if (!changed) break;
    }

    // group by community
    const groups = new Map();
    for (const [id, c] of communities) {
      if (!groups.has(c)) groups.set(c, new Set());
      groups.get(c).add(id);
    }
    return groups;
  }

  /**
   * Hierarchical community detection — systems within systems, derived
   * from link structure rather than folders. Runs community detection on
   * the whole graph, then recurses inside each community on its induced
   * subgraph, producing a dendrogram:
   *   { level, label, nodes: [nodeId…], children: [dendrogramNode…] }
   * `label` is the highest-PageRank member (the community's keystone note).
   * Stops descending below `minSize` nodes or at `depth` levels.
   */
  detectCommunitiesHierarchical({ depth = 2, minSize = 4, iterations = 10 } = {}) {
    const self = this;
    const labelFor = (nodeIds) => {
      const sub = this.inducedSubgraph(nodeIds);
      const best = sub.pageRank()[0];
      return best ? (self.node(best.id)?.properties.basename || best.id) : "(empty)";
    };
    const run = (nodeIds, level) => {
      const node = { level, label: labelFor(nodeIds), nodes: nodeIds, children: [] };
      if (level >= depth || nodeIds.length < minSize) return node;
      const sub = this.inducedSubgraph(nodeIds);
      const groups = [...sub.detectCommunities({ iterations }).values()]
        .map((s) => [...s])
        .sort((a, b) => b.length - a.length);
      // no real split (one community = everything, or all singletons): stop
      if (groups.length <= 1 || (groups[0].length === nodeIds.length)) return node;
      node.children = groups.map((g) => run(g, level + 1));
      return node;
    };
    const noteIds = this.nodesByLabel("Note");
    return run(noteIds.length ? noteIds : [...this.nodes.keys()], 0);
  }

  /**
   * Shortest path (BFS): how are A and B connected?
   * Returns [{ node, via }] or null. CONTAINS edges are excluded by default.
   */
  shortestPath(start, end, { type = null, excludeTypes = [HIERARCHY_TYPE] } = {}) {
    if (start === end) return [{ node: start, via: null }];
    const queue = [[start]];
    const visited = new Set([start]);
    while (queue.length) {
      const path = queue.shift();
      const last = path[path.length - 1];
      for (const n of this.neighbors(last, { type, excludeTypes })) {
        if (visited.has(n.node)) continue;
        visited.add(n.node);
        const newPath = [...path, n.node];
        if (n.node === end) {
          return newPath.map((id) => ({ node: id, label: [...(this.nodes.get(id)?.labels ?? [])][0] || "" }));
        }
        queue.push(newPath);
      }
    }
    return null;
  }

  /**
   * K-hop neighborhood: everything within N hops of a node.
   * CONTAINS edges are excluded by default.
   */
  neighborhood(start, hops = 2, { type = null, excludeTypes = [HIERARCHY_TYPE] } = {}) {
    const visited = new Map([[start, 0]]);
    const queue = [[start, 0]];
    while (queue.length) {
      const [id, depth] = queue.shift();
      if (depth >= hops) continue;
      for (const n of this.neighbors(id, { type, excludeTypes })) {
        if (!visited.has(n.node)) {
          visited.set(n.node, depth + 1);
          queue.push([n.node, depth + 1]);
        }
      }
    }
    return visited; // Map<nodeId, depth>
  }

  /**
   * Serialize to Cypher CREATE statements (for Neo4j import).
   */
  toCypher() {
    const lines = [];
    for (const [id, node] of this.nodes) {
      const labels = [...node.labels].map((l) => ":" + l.replace(/[^a-zA-Z0-9_]/g, "_")).join("");
      const props = JSON.stringify(node.properties).replace(/"/g, "'");
      lines.push(`CREATE (n${id.replace(/[^a-zA-Z0-9]/g, "_")}${labels} ${props});`);
    }
    for (const [id, edge] of this.edges) {
      const a = edge.start.replace(/[^a-zA-Z0-9]/g, "_");
      const b = edge.end.replace(/[^a-zA-Z0-9]/g, "_");
      const props = JSON.stringify(edge.properties).replace(/"/g, "'");
      lines.push(`MATCH (a${a.replace(/[^a-zA-Z0-9_]/g, "_")}), (b${b.replace(/[^a-zA-Z0-9_]/g, "_")}) CREATE (a)-[:${edge.type} ${props}]->(b);`);
    }
    return lines.join("\n");
  }

  toJSON() {
    return {
      nodes: [...this.nodes.entries()].map(([id, n]) => ({
        id, labels: [...n.labels], properties: n.properties,
      })),
      edges: [...this.edges.entries()].map(([id, e]) => ({
        id, type: e.type, start: e.start, end: e.end, properties: e.properties,
      })),
    };
  }

  static fromJSON(data) {
    const g = new Graph();
    for (const n of data.nodes) g.addNode(n.id, n.labels, n.properties);
    for (const e of data.edges) g.addEdge(e.id, e.type, e.start, e.end, e.properties);
    return g;
  }
}

/* ══════════════ extraction from Fractal Index maps ══════════════ */

/**
 * Extract a Graph from a vault's connection notes + wikilinks.
 * Every folder becomes a System node; containment is CONTAINS edges, so
 * systems nest properly and metrics roll up the tree. Connection notes
 * are read from every level's `_connections/` folder and may reference
 * folders as well as notes (system-to-system relationships).
 *
 * @param {string} vaultPath - absolute path to the vault
 * @param {string} brainFolder - brain root folder (e.g. "Garden") or "" for all
 * @param {object} opts - { hierarchy = true }
 * @returns {Graph}
 */
export function extractGraph(vaultPath, brainFolder = "", { hierarchy = true } = {}) {
  const g = new Graph();
  const brainAbs = path.join(vaultPath, brainFolder || "");

  // walk collects content md files AND every level's _connections dir
  const connDirs = [];
  function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "_connections") { connDirs.push(p); continue; }
        walk(p, out);
      } else if (e.name.endsWith(".md") && !e.name.endsWith(".excalidraw.md")) {
        out.push(p);
      }
    }
    return out;
  }

  const mdFiles = walk(brainAbs).map((p) => ({
    abs: p,
    rel: path.relative(vaultPath, p).split(path.sep).join("/"),
  }));

  // nodes: every md note is a Note node (before CONTAINS edges so the
  // edge auto-create doesn't register them label-less)
  for (const f of mdFiles) {
    g.addNode(f.rel, ["Note"], { path: f.rel, basename: path.basename(f.rel, ".md") });
  }

  /* ── systems: folder nodes + CONTAINS edges ──
     A folder qualifies as a System when its subtree holds at least one
     content note (connection-note folders don't make empty systems). */
  const folderSet = new Set(); // rel paths of System nodes
  if (hierarchy) {
    const hasContentMd = new Map(); // folder rel → subtree holds content md?
    for (const f of mdFiles) {
      const rel = f.rel.slice(0, Math.max(f.rel.lastIndexOf("/"), 0));
      hasContentMd.set(rel, true);
    }
    // depth is counted relative to the brain root (root = 0)
    const rootLen = brainFolder ? brainFolder.split("/").length : 0;
    const folders = new Map(); // rel → depth
    for (const rel of hasContentMd.keys()) {
      if (!rel) continue; // notes at vault root have no folder
      const parts = rel.split("/");
      for (let i = Math.max(1, rootLen); i <= parts.length; i++) {
        const ancestor = parts.slice(0, i).join("/");
        if (!folders.has(ancestor)) folders.set(ancestor, i - rootLen);
      }
    }
    if (brainFolder && !folders.has(brainFolder)) folders.set(brainFolder, 0);

    for (const [rel, depth] of [...folders.entries()].sort((a, b) => a[1] - b[1])) {
      folderSet.add(rel);
      g.addNode(rel, ["System"], {
        path: rel,
        name: rel.split("/").pop(),
        depth,
        parent: depth > 0 ? rel.split("/").slice(0, -1).join("/") : null,
        root: rel === brainFolder,
      });
    }
    // containment: system → sub-system, system → note
    for (const child of folderSet) {
      if (child === brainFolder) continue;
      const parent = child.split("/").slice(0, -1).join("/");
      if (folderSet.has(parent)) {
        g.addEdge("contain:" + parent + "=>" + child, HIERARCHY_TYPE, parent, child, {});
      }
    }
    for (const f of mdFiles) {
      const parent = f.rel.slice(0, Math.max(f.rel.lastIndexOf("/"), 0));
      if (folderSet.has(parent)) {
        g.addEdge("contain:" + parent + "=>" + f.rel, HIERARCHY_TYPE, parent, f.rel, {});
      }
    }
  }

  /* ── link resolution: notes and folders, exact before suffix ── */
  const candidates = [
    ...mdFiles.map((f) => ({ rel: f.rel, kind: "Note" })),
    ...(hierarchy ? [...folderSet].sort((a, b) => b.length - a.length).map((rel) => ({ rel, kind: "System" })) : []),
  ];
  const resolveLink = (raw) => {
    let t = String(raw).trim().replace(/^\[\[|\]\]$/g, "").split("|")[0].trim().replace(/\.md$/, "").replace(/\/+$/, "");
    if (!t) return null;
    for (const c of candidates) if (c.rel === t || c.rel === t + ".md") return c;
    for (const c of candidates) if (c.rel.endsWith("/" + t) || c.rel.endsWith("/" + t + ".md")) return c;
    return null;
  };

  // edges: forward links (PEER or type from inline fields)
  for (const f of mdFiles) {
    const content = fs.readFileSync(f.abs, "utf8");
    for (const m of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const resolved = resolveLink(m[1]);
      if (resolved && resolved.rel !== f.rel && resolved.kind === "Note") {
        const edgeId = f.rel + "=>" + resolved.rel;
        if (!g.edge(edgeId)) {
          g.addEdge(edgeId, "PEER", f.rel, resolved.rel, { inferred: true });
        }
      }
    }
  }

  // edges: connection notes → typed relationships (RESONATES, BRIDGES, …)
  // read from EVERY level's _connections/ folder; from/to may be notes
  // or folders (system-to-system relationships)
  for (const connDir of connDirs) {
    for (const f of fs.readdirSync(connDir).filter((f) => f.endsWith(".md") && f !== "_index.excalidraw.md")) {
      const content = fs.readFileSync(path.join(connDir, f), "utf8");
      const fm = parseFrontmatter(content);
      if (!fm || !fm.from || !fm.to) continue;
      const from = resolveLink(fm.from);
      const to = resolveLink(fm.to);
      if (!from || !to || from.rel === to.rel) continue;
      const type = (fm.relation || "PEER").toUpperCase();
      const edgeId = from.rel + "=>" + to.rel;
      // explicit connection notes win over inferred wikilink edges
      g.addEdge(edgeId, type, from.rel, to.rel, {
        relation: fm.relation, weight: Number(fm.weight) || 1, mutual: fm.mutual === "true",
        note: path.relative(vaultPath, path.join(connDir, f)).split(path.sep).join("/"),
      });
    }
  }

  return g;
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const props = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (kv) props[kv[1]] = kv[2];
  }
  return props;
}
