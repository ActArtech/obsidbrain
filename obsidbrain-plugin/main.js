/* Obsidbrain Fractal Brain — main.js
 *
 * The map is a view over the notes, not a stored drawing:
 *   - notes, folders (expandable clusters), typed edges from connection notes
 *   - inferred peer edges from resolvedLinks (suppressed for covered pairs)
 *   - click a node → open its note · click an edge → open its connection note
 *   - double-click a folder → expand / collapse its children (dive)
 *   - parallel relationships between the same pair render as separate edges
 *
 * Zero dependencies beyond the vendored cytoscape.min.js.
 */

"use strict";

const { Plugin, ItemView, Notice, TFolder } = require("obsidian");

const VIEW_TYPE = "obsidbrain-view";

const REL_STYLE = {
  resonates: { color: "#7c3aed", width: 3 },
  peer: { color: "#8b5cf6", width: 2 },
  bridges: { color: "#2563eb", width: 2.5 },
  nourishes: { color: "#7c6f9e", width: 2 },
  feeds: { color: "#a78bfa", width: 1.5 },
};
const DEFAULT_REL = { color: "#94a3b8", width: 1.5 };
const INFERRED = { color: "#cbd5e1", width: 1 };

/* ── graph extraction (runs inside Obsidian, from the metadata cache) ── */

function parseFrontmatterLink(raw) {
  if (!raw) return null;
  let t = String(raw).trim().replace(/^\[\[|\]\]$/g, "").split("|")[0].trim().replace(/\.md$/, "").replace(/\/+$/, "");
  return t || null;
}

function collectConnectionNotes(app) {
  // connection notes: frontmatter type === "connection" with from/to
  const out = [];
  for (const f of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    if (!fm || fm.type !== "connection") continue;
    const from = parseFrontmatterLink(fm.from);
    const to = parseFrontmatterLink(fm.to);
    if (!from || !to) continue;
    out.push({
      notePath: f.path,
      from, to,
      relation: String(fm.relation || "peer").toLowerCase(),
      weight: Number(fm.weight) || 1,
      mutual: fm.mutual === true || fm.mutual === "true",
    });
  }
  return out;
}

function resolveLinkPath(app, linkPath) {
  // try exact, then with .md, folder as-is
  const direct = app.vault.getAbstractFileByPath(linkPath);
  if (direct) return linkPath;
  const asMd = app.vault.getAbstractFileByPath(linkPath + ".md");
  if (asMd) return linkPath + ".md";
  // suffix match (link may omit parent folders)
  const lower = linkPath.toLowerCase();
  const hit = app.vault.getMarkdownFiles().find((f) => {
    const p = f.path.toLowerCase();
    return p === lower || p === lower + ".md" || p.endsWith("/" + lower) || p.endsWith("/" + lower + ".md");
  });
  return hit ? hit.path : null;
}

function topFolderOf(path) {
  const i = path.indexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function buildBrain(app, root) {
  const rootPrefix = root ? root + "/" : "";
  const inScope = (p) => (root ? p.startsWith(rootPrefix) : true);

  const coveredPairs = new Set();
  const typedEdges = [];
  for (const c of collectConnectionNotes(app)) {
    if (!inScope(c.from) || !inScope(c.to)) continue;
    const from = resolveLinkPath(app, c.from);
    const to = resolveLinkPath(app, c.to);
    if (!from || !to || from === to) continue;
    coveredPairs.add(from + "=>" + to);
    coveredPairs.add(to + "=>" + from);
    typedEdges.push({ from, to, ...c });
  }

  // folders under root (with ≥1 note)
  const folders = new Set();
  for (const f of app.vault.getMarkdownFiles()) {
    if (!inScope(f.path)) continue;
    if (f.path.includes("_connections/")) continue; // metadata folders are not systems
    let dir = f.parent;
    while (dir && dir.path !== root && dir.path !== "/") {
      if (!(dir instanceof TFolder)) break;
      if (dir.path.includes("_connections")) { dir = dir.parent; continue; }
      folders.add(dir.path);
      dir = dir.parent;
    }
  }

  // notes under root
  const notes = app.vault.getMarkdownFiles().filter((f) => {
    if (!inScope(f.path)) return false;
    if (f.path.includes("/_connections/") || f.basename.startsWith("_index")) return false;
    return true;
  });

  // inferred peer edges (suppressed for pairs covered by connection notes)
  const inferred = [];
  const rl = app.metadataCache.resolvedLinks;
  for (const src in rl) {
    if (!inScope(src) || !src.endsWith(".md") || src.includes("/_connections/")) continue;
    for (const dst in rl[src]) {
      if (!rl[src][dst] || !inScope(dst) || !dst.endsWith(".md")) continue;
      if (dst.includes("/_connections/")) continue;
      const k = src + "=>" + dst;
      if (coveredPairs.has(k)) continue;
      inferred.push({ from: src, to: dst, weight: rl[src][dst] });
    }
  }

  return { root, folders, notes, typedEdges, inferred };
}

/* ── cytoscape elements ── */

function brainToElements(brain) {
  const els = [];
  for (const f of brain.folders) {
    els.push({ data: { id: "f:" + f, kind: "folder", path: f, name: f.split("/").pop() } });
  }
  for (const n of brain.notes) {
    els.push({ data: { id: "n:" + n.path, kind: "note", path: n.path, name: n.basename } });
  }
  const noteSet = new Set(brain.notes);
  for (const t of brain.typedEdges) {
    const st = REL_STYLE[t.relation] || DEFAULT_REL;
    // from/to may name FOLDERS (system-level relationships) — route to the
    // cluster node; skip relationships whose endpoints are outside the brain
    const sid = brain.folders.has(t.from) ? "f:" + t.from : noteSet.has(t.from) ? "n:" + t.from : null;
    const tid = brain.folders.has(t.to) ? "f:" + t.to : noteSet.has(t.to) ? "n:" + t.to : null;
    if (!sid || !tid) continue;
    els.push({
      data: {
        id: "t:" + t.notePath,
        kind: "typed",
        source: sid,
        target: tid,
        relation: t.relation,
        note: t.notePath,
        weight: t.weight,
        color: st.color,
        width: st.width,
        label: t.relation + (t.weight > 1 ? " ×" + t.weight : ""),
      },
    });
  }
  for (const [i, inf] of brain.inferred.entries()) {
    els.push({
      data: {
        id: "i:" + i + ":" + inf.from + "=>" + inf.to,
        kind: "inferred",
        source: "n:" + inf.from,
        target: "n:" + inf.to,
        color: INFERRED.color,
        width: INFERRED.width,
        label: "",
      },
    });
  }
  return els;
}

/* ── the view ── */

class ObsidbrainView extends ItemView {
  constructor(leaf) {
    super(leaf);
    this.expanded = new Set(); // expanded folder paths
    this.cy = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Fractal Brain"; }
  getIcon() { return "waypoints"; }

  async onOpen() {
    const root = this.app.workspace.getActiveFile()
      ? topFolderOf(this.app.workspace.getActiveFile().path)
      : "";
    this.contentEl.empty();
    this.contentEl.addClass("obsidbrain-root");

    const bar = this.contentEl.createDiv({ cls: "obsidbrain-bar" });
    this.rootLabel = bar.createSpan({ cls: "obsidbrain-root-label" });
    const btnFit = bar.createEl("button", { text: "⟲ fit" });
    btnFit.onclick = () => this.cy && this.cy.fit(undefined, 30);
    const btnFs = bar.createEl("button", { text: "⛶ full screen" });
    btnFs.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else this.contentEl.requestFullscreen();
    };
    const btnExpandAll = bar.createEl("button", { text: "expand all" });
    btnExpandAll.onclick = () => {
      for (const f of this.brain.folders) this.expanded.add(f);
      this.renderBrain();
    };
    const btnCollapse = bar.createEl("button", { text: "collapse" });
    btnCollapse.onclick = () => { this.expanded.clear(); this.renderBrain(); };

    this.canvasEl = this.contentEl.createDiv({ cls: "obsidbrain-canvas" });
    this.brain = buildBrain(this.app, root);
    this.rootLabel.setText("🧠 " + (root || "vault"));
    this.renderBrain();
  }

  renderBrain() {
    const brain = this.brain;
    const expandedPrefixes = [...this.expanded];

    const els = brainToElements(brain);

    // MVP scope rule: folders render as cluster nodes; children appear only
    // when the folder is expanded — nesting without thumbnails
    const visible = els.filter((el) => {
      const d = el.data;
      if (d.kind === "folder") return true;
      const parent = d.path ? d.path.slice(0, Math.max(d.path.lastIndexOf("/"), 0)) : "";
      if (!parent) return true; // root-level
      // visible when parent chain is expanded
      const parts = d.path.split("/");
      // visible when every folder between the root and the file is expanded
      // (root itself is always visible; the last part is the filename)
      for (let i = 1; i < parts.length - 1; i++) {
        const anc = parts.slice(0, i).join("/");
        if (!this.expanded.has(anc)) return false;
      }
      return true;
    });

    // visible includes edges (their visibility check passes trivially) —
    // nodes only for the id set, then edges filtered to visible endpoints
    const visibleNodes = visible.filter((el) => !el.data.source);
    const ids = new Set(visibleNodes.map((el) => el.data.id));
    const edges = els.filter((el) => el.data.source && ids.has(el.data.source) && ids.has(el.data.target));

    if (this.cy) { this.cy.destroy(); this.cy = null; }
    this.canvasEl.empty();
    const container = this.canvasEl.createDiv({ cls: "obsidbrain-cy" });

    // eslint-disable-next-line no-undef
    const build = (elements) => cytoscape({
      container,
      elements,
      wheelSensitivity: 0.2,
      style: [
        { selector: "node[kind = 'note']", style: {
          "background-color": "#ffffff", "border-color": "#64748b", "border-width": 1.5,
          label: "data(name)", color: "#1d1d1f", "font-size": 11, "font-family": "system-ui",
          "text-valign": "center", "text-halign": "center", shape: "round-rectangle",
          width: "label", height: 26, padding: "8px",
        } },
        { selector: "node[kind = 'folder']", style: {
          "background-color": "#fff7ed", "border-color": "#c2410c", "border-width": 2,
          label: "data(name)", color: "#7c2d12", "font-size": 12, "font-weight": "bold",
          "font-family": "system-ui", "text-valign": "center", "text-halign": "center",
          shape: "round-rectangle", width: "label", height: 30, padding: "10px",
        } },
        { selector: "edge", style: {
          width: "data(width)", "line-color": "data(color)",
          "target-arrow-color": "data(color)", "target-arrow-shape": "triangle",
          "curve-style": "bezier", "control-point-step-size": 40,
          label: "data(label)", "font-size": 9, color: "#475569",
          "text-background-color": "#ffffff", "text-background-opacity": 0.85,
          "text-background-padding": 2,
        } },
        { selector: "edge[kind = 'inferred']", style: {
          "line-style": "dashed", "target-arrow-shape": "triangle", label: "",
        } },
        { selector: "node:selected", style: { "border-color": "#7c3aed", "border-width": 2.5 } },
      ],
      layout: { name: "cose", animate: false, randomize: true, idealEdgeLength: 90, nodeOverlap: 24 },
    });
    // defensive: never crash the view on a leaked edge — render the nodes
    // and re-add edges one by one, dropping any that reference missing nodes
    try {
      this.cy = build([...visibleNodes, ...edges]);
    } catch (e) {
      if (this.cy) { this.cy.destroy(); this.cy = null; }
      container.empty();
      this.cy = build(visibleNodes);
      edges.forEach((el) => { try { this.cy.add(el); } catch (err) { /* drop orphan */ } });
    }

    this.cy.on("tap", "node[kind = 'note']", (evt) => {
      const path = evt.target.data("path");
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f) this.app.workspace.openLinkText(path, this.viewLeafPath || "obsidbrain", false);
    });
    this.cy.on("tap", "edge[kind = 'typed']", (evt) => {
      const note = evt.target.data("note");
      const f = note && this.app.vault.getAbstractFileByPath(note);
      if (f) this.app.workspace.openLinkText(note, this.viewLeafPath || "obsidbrain", false);
    });
    this.cy.on("dblclick", "node[kind = 'folder']", (evt) => {
      const path = evt.target.data("path");
      if (this.expanded.has(path)) this.expanded.delete(path);
      else this.expanded.add(path);
      this.renderBrain();
    });
    this.cy.on("tap", "node[kind = 'folder']", (evt) => {
      new Notice("📁 " + evt.target.data("name") + " — double-click to expand/collapse");
    });
  }

  async onClose() {
    if (this.cy) this.cy.destroy();
  }
}

/* ── plugin ── */

class ObsidbrainPlugin extends Plugin {
  async onload() {
    // vendored cytoscape: read from the plugin folder and inject inline
    // (UMD detects no module system in a <script> → binds window.cytoscape)
    try {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(this.app.vault.adapter.getBasePath(), this.manifest.dir, "cytoscape.min.js"), "utf8");
      const s = document.createElement("script");
      // Obsidian's window defines module/exports, which would send the UMD
      // build into CommonJS mode and lose the global — shadow them so the
      // library binds to window.cytoscape
      s.textContent = "!(function(){ var module, exports, define;\n" + src + "\n; })();";
      document.head.appendChild(s);
    } catch (e) {
      new Notice("Obsidbrain: cytoscape.min.js is missing from the plugin folder.");
    }

    this.registerView(VIEW_TYPE, (leaf) => new ObsidbrainView(leaf));
    this.addRibbonIcon("waypoints", "Open Fractal Brain", () => this.activate());
    this.addCommand({ id: "open-fractal-brain", name: "Open Fractal Brain", callback: () => this.activate() });
  }

  async activate() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      // open in the MAIN area — the graph needs room, not a sidebar sliver
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (leaf) {
      this.app.workspace.revealLeaf(leaf);
      // reload data on every activation (the view mirrors the notes, live)
      const v = leaf.view;
      if (v && v.renderBrain) {
        const root = this.app.workspace.getActiveFile()
          ? topFolderOf(this.app.workspace.getActiveFile().path)
          : v.brain ? v.brain.root : "";
        v.brain = buildBrain(this.app, root);
        if (v.rootLabel) v.rootLabel.setText("🧠 " + (root || "vault"));
        v.renderBrain();
      }
    }
  }

  onunload() {}
}

module.exports = ObsidbrainPlugin;
