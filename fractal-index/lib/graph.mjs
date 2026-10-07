// graph.mjs — property graph model, queries, and algorithms.
// Neo4j principles applied natively (zero deps): property graph model,
// index-free adjacency, Cypher-like pattern matching, graph algorithms.
//
// The graph is extracted from the vault's wikilinks + connection notes,
// stored as an adjacency list, and queried/analyzed without a server.

import fs from "node:fs";
import path from "node:path";

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
    this.edges.set(id, { type, start, end, properties });
    this.adjacency.get(start).push({ edgeId: id, other: end, direction: "out" });
    this.adjacency.get(end).push({ edgeId: id, other: start, direction: "in" });
    return id;
  }

  node(id) { return this.nodes.get(id) || null; }
  edge(id) { return this.edges.get(id) || null; }

  neighbors(id, { type = null, direction = null } = {}) {
    return (this.adjacency.get(id) || [])
      .filter((a) => {
        const e = this.edges.get(a.edgeId);
        if (!e) return false;
        if (type && e.type !== type) return false;
        if (direction && a.direction !== direction) return false;
        return true;
      })
      .map((a) => {
        const edge = this.edges.get(a.edgeId);
        return { node: a.other, edgeId: a.edgeId, direction: a.direction, properties: edge?.properties ?? {} };
      });
  }

  degree(id, { type = null } = {}) {
    return this.neighbors(id, { type }).length;
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
   */
  degreeCentrality({ label = null, type = null } = {}) {
    const results = [];
    for (const [id, node] of this.nodes) {
      if (label && !node.labels.has(label)) continue;
      results.push({ id, label: [...node.labels][0] || "", degree: this.degree(id, { type }) });
    }
    return results.sort((a, b) => b.degree - a.degree);
  }

  /**
   * PageRank (simplified, power iteration): which nodes are most influential?
   * Returns [{ id, score }] sorted by score (descending).
   */
  pageRank({ damping = 0.85, iterations = 20, type = null } = {}) {
    const ids = [...this.nodes.keys()];
    const n = ids.length;
    if (!n) return [];
    const scores = new Map(ids.map((id) => [id, 1 / n]));
    const outDegree = new Map();
    for (const id of ids) {
      outDegree.set(id, this.neighbors(id, { type, direction: "out" }).length);
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
          if (type && edge.type !== type) continue;
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
   */
  detectCommunities({ iterations = 10 } = {}) {
    const ids = [...this.nodes.keys()];
    const communities = new Map(ids.map((id) => [id, id])); // start: each node its own community

    for (let iter = 0; iter < iterations; iter++) {
      let changed = false;
      for (const id of ids) {
        // count neighbor communities
        const counts = new Map();
        for (const n of this.neighbors(id)) {
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
   * Shortest path (BFS): how are A and B connected?
   * Returns [{ node, via }] or null.
   */
  shortestPath(start, end, { type = null } = {}) {
    if (start === end) return [{ node: start, via: null }];
    const queue = [[start]];
    const visited = new Set([start]);
    while (queue.length) {
      const path = queue.shift();
      const last = path[path.length - 1];
      for (const n of this.neighbors(last, { type })) {
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
   */
  neighborhood(start, hops = 2, { type = null } = {}) {
    const visited = new Map([[start, 0]]);
    const queue = [[start, 0]];
    while (queue.length) {
      const [id, depth] = queue.shift();
      if (depth >= hops) continue;
      for (const n of this.neighbors(id, { type })) {
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
 * @param {string} vaultPath - absolute path to the vault
 * @param {string} brainFolder - brain root folder (e.g. "Garden") or "" for all
 * @returns {Graph}
 */
export function extractGraph(vaultPath, brainFolder = "") {
  const g = new Graph();
  const prefix = brainFolder ? brainFolder + "/" : "";

  function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "_connections") continue; // handled separately
        walk(p, out);
      } else if (e.name.endsWith(".md")) {
        out.push(p);
      }
    }
    return out;
  }

  const brainAbs = path.join(vaultPath, brainFolder || "");
  const mdFiles = walk(brainAbs).map((p) => ({
    abs: p,
    rel: path.relative(vaultPath, p).split(path.sep).join("/"),
  }));

  // nodes: every md note is a Note node
  for (const f of mdFiles) {
    g.addNode(f.rel, ["Note"], { path: f.rel, basename: path.basename(f.rel, ".md") });
  }

  // edges: forward links (PEER or type from inline fields)
  for (const f of mdFiles) {
    const content = fs.readFileSync(f.abs, "utf8");
    const srcId = f.rel;
    for (const m of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const raw = m[1].trim();
      const resolved = resolveLink(srcId, raw, mdFiles);
      if (resolved && resolved !== srcId) {
        const edgeId = srcId + "=>" + resolved;
        if (!g.edge(edgeId)) {
          g.addEdge(edgeId, "PEER", srcId, resolved, { inferred: true });
        }
      }
    }
  }

  // edges: connection notes → typed relationships (RESONATES, BRIDGES, etc.)
  const connDir = path.join(brainAbs, "_connections");
  if (fs.existsSync(connDir)) {
    for (const f of fs.readdirSync(connDir).filter((f) => f.endsWith(".md") && f !== "_index.excalidraw.md")) {
      const content = fs.readFileSync(path.join(connDir, f), "utf8");
      const fm = parseFrontmatter(content);
      if (!fm) continue;
      const from = resolveLink("", fm.from, mdFiles);
      const to = resolveLink("", fm.to, mdFiles);
      if (!from || !to) continue;
      const type = (fm.relation || "PEER").toUpperCase();
      g.addEdge(from + "=>" + to, type, from, to, { relation: fm.relation, weight: fm.weight ?? 1 });
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

function resolveLink(srcRel, raw, mdFiles) {
  const t = raw.trim().replace(/\.md$/, "");
  for (const f of mdFiles) {
    if (f.rel === t || f.rel === t + ".md") return f.rel;
    if (f.rel.endsWith("/" + t) || f.rel.endsWith("/" + t + ".md")) return f.rel;
  }
  return null;
}
