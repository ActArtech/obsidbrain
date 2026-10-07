// obsidbrain-mcp tool implementations. Each tool is one fact (dev-tools
// README pitfall 9), verifies effects on files where relevant (pitfall 8),
// and saves after mutating (pitfall 3).

import path from "node:path";
import url from "node:url";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { parseStoryMapElements } from "../dual-views/lib/storymap-excalidraw.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

const TEMPLATE = [
  "---", "excalidraw-plugin: parsed", "tags: [excalidraw]", "---", "",
  "# Excalidraw Data", "## Text Elements", "", "## Drawing",
  "```json",
  '{"type":"excalidraw","version":2,"source":"fractal-index","elements":[],"appState":{"grid":null,"viewBackgroundColor":"#ffffff"},"files":{}}',
  "```", "",
].join("\n");

export const TOOLS = [
  {
    name: "status",
    description: "Obsidian reachability + vault + Excalidraw plugin + Fractal Navigate hooks. Call this first.",
    inputSchema: { type: "object", properties: {} },
    run: async (cdp) => cdp.evalIn(`(() => {
      const p = app.plugins?.plugins?.["obsidian-excalidraw-plugin"];
      return {
        obsidian: true,
        vault: (app.vault && app.vault.getName) ? app.vault.getName() : null,
        excalidrawPlugin: !!p,
        pluginVersion: p ? p.manifest.version : null,
        navigateHooks: p && p.ea ? {
          link: typeof p.ea.onLinkClickHook === "function",
          scene: !!(p.ea.onSceneChangeHook && p.ea.onSceneChangeHook.trackElements),
        } : null,
        openExcalidrawViews: app.workspace.getLeavesOfType("excalidraw").length,
      };
    })()`),
  },
  {
    name: "list_brains",
    description: "All _index.excalidraw.md drawings in the vault, grouped by brain root (the folder whose own parent has no _index).",
    inputSchema: { type: "object", properties: {} },
    run: async (cdp) => cdp.evalIn(`(() => {
      const files = app.vault.getFiles().filter((f) => f.name === "_index.excalidraw.md").map((f) => f.path);
      const brains = [];
      for (const p of files) {
        const dir = p.slice(0, -"_index.excalidraw.md".length).replace(/\\/$/, "");
        const parentDir = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "";
        const parentHasIndex = files.some((q) => q === parentDir + "/_index.excalidraw.md");
        if (!parentHasIndex) brains.push({ root: dir || "/", levels: files.filter((q) => q.startsWith(dir + "/") || q === p).length });
      }
      return { brains, totalIndexDrawings: files.length };
    })()`),
  },
  {
    name: "read_map",
    description: "Parsed summary of a generated drawing: element counts by kind, cards with positions/links, link arrows. Works on plain and plugin-compressed files.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "vault-relative drawing path, e.g. Garden/_index.excalidraw.md" } },
      required: ["path"],
    },
    run: async (cdp, args) => {
      const md = await cdp.evalIn(`app.vault.cachedRead(app.vault.getAbstractFileByPath(${JSON.stringify(args.path)}))`);
      if (md == null) throw new Error("not found in vault: " + args.path);
      const els = parseStoryMapElements(md).filter((e) => !e.isDeleted);
      const kinds = {};
      const cards = [];
      const arrows = [];
      for (const e of els) {
        const cd = e.customData || {};
        const k = cd.kind || e.type;
        kinds[k] = (kinds[k] || 0) + 1;
        if (k === "file" || k === "pod-label") {
          cards.push({ key: cd.key || null, label: (e.text || "").split("\n")[0].slice(0, 60), x: Math.round(e.x), y: Math.round(e.y), link: e.link || null });
        }
        if (k === "link") {
          arrows.push({ key: cd.key, mutual: e.startArrowhead === "arrow" });
        }
      }
      return { path: args.path, elements: els.length, kinds, cards, linkArrows: arrows };
    },
  },
  {
    name: "query_links",
    description: "Resolved wikilinks from the vault's metadata cache, optionally filtered by folder prefix.",
    inputSchema: {
      type: "object",
      properties: { folder: { type: "string", description: "optional vault folder prefix, e.g. Garden/Fields" } },
    },
    run: async (cdp, args) => {
      const prefix = args.folder ? args.folder.replace(/\/?$/, "/") : "";
      return cdp.evalIn(`(() => {
        const rl = app.metadataCache.resolvedLinks;
        const out = {};
        const prefix = ${JSON.stringify(prefix)};
        for (const src in rl) {
          if (prefix && !src.startsWith(prefix)) continue;
          const targets = Object.entries(rl[src]).filter(([,n]) => n > 0);
          if (targets.length) out[src] = targets.map(([t, n]) => t + " x" + n);
        }
        return { sources: Object.keys(out).length, links: out };
      })()`);
    },
  },
  {
    name: "generate_index",
    description: "Create (if missing) and regenerate the Fractal Index map of ONE folder, with link arrows. Positions of existing nodes are preserved.",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "vault-relative folder, e.g. Garden/Fields (empty string = vault root)" },
        links: { type: "boolean", description: "draw note-link arrows (default true)" },
      },
    },
    run: async (cdp, args) => {
      const folder = (args.folder || "").replace(/\/?$/, "");
      const indexPath = folder ? folder + "/_index.excalidraw.md" : "_index.excalidraw.md";
      const result = await cdp.evalIn(`(async () => {
        const plugin = app.plugins?.plugins?.["obsidian-excalidraw-plugin"];
        if (!plugin) throw new Error("Excalidraw plugin not loaded");
        const indexPath = ${JSON.stringify(indexPath)};
        if (!app.vault.getAbstractFileByPath(indexPath)) {
          await app.vault.create(indexPath, ${JSON.stringify(TEMPLATE)});
        }
        const code = await app.vault.read(app.vault.getAbstractFileByPath("Excalidraw/Scripts/Fractal Index.md"));
        void app.workspace.openLinkText(indexPath, "obsidian-default").catch(() => {});
        let view = null;
        for (let i = 0; i < 25 && !view; i++) {
          await new Promise((r) => setTimeout(r, 400));
          view = app.workspace.getLeavesOfType("excalidraw").find((l) => l.view?.file?.path === indexPath && l.view.getScene)?.view;
        }
        if (!view) throw new Error("view never loaded: " + indexPath);
        globalThis.__fractalSyncOptions = { scope: "self", links: ${args.links === false ? "false" : "true"} };
        try {
          const ea = plugin.ea;
          ea.setView(view, false);
          const body = code.replace(/^---\\n[\\s\\S]*?\\n---\\n/, "");
          const fn = new (async () => {}).constructor("ea", "utils", body);
          await fn(ea, { suggester: async () => "self", scriptFile: view.file });
        } finally {
          globalThis.__fractalSyncOptions = null;
        }
        await new Promise((r) => setTimeout(r, 500));
        try { await view.save(false, true); } catch (e) {}
        const els = view.getViewElements().filter((e) => !e.isDeleted);
        const kinds = {};
        for (const e of els) { const k = (e.customData||{}).kind || e.type; kinds[k]=(kinds[k]||0)+1; }
        return { generated: indexPath, elements: els.length, kinds };
      })()`);
      return result;
    },
  },
  {
    name: "sync_brain",
    description: "Regenerate EVERY map in a brain (Fractal Sync over the whole tree). Polls file mtimes until writes settle (executeScript resolves early).",
    inputSchema: {
      type: "object",
      properties: {
        rootIndexPath: { type: "string", description: "vault path of the root _index drawing, e.g. Garden/_index.excalidraw.md" },
        links: { type: "boolean", description: "draw note-link arrows (default true)" },
      },
      required: ["rootIndexPath"],
    },
    run: async (cdp, args) => {
      const busy = await cdp.evalIn('globalThis.__fractalSyncRunning === true').catch(() => false);
      if (busy) return { error: 'a sync is already running inside Obsidian — retry when it finishes' };
      const root = args.rootIndexPath;
      await cdp.evalIn(`(async () => {
        const plugin = app.plugins?.plugins?.["obsidian-excalidraw-plugin"];
        const code = await app.vault.read(app.vault.getAbstractFileByPath("Excalidraw/Scripts/Fractal Sync.md"));
        void app.workspace.openLinkText(${JSON.stringify(root)}, "obsidian-default").catch(() => {});
        let view = null;
        for (let i = 0; i < 25 && !view; i++) {
          await new Promise((r) => setTimeout(r, 400));
          view = app.workspace.getLeavesOfType("excalidraw").find((l) => l.view?.file?.path === ${JSON.stringify(root)} && l.view.getScene)?.view;
        }
        if (!view) throw new Error("root view never loaded");
        globalThis.__fractalSyncOptions = { scope: "self+create", links: ${args.links === false ? "false" : "true"} };
        globalThis.__syncTrace = [];
        try {
          const fn = new (async () => {}).constructor("ea", "utils", code.replace(/^---\\n[\\s\\S]*?\\n---\\n/, ""));
          await fn({ targetView: view, plugin: { scriptEngine: plugin.scriptEngine, ea: plugin.ea } },
                   { suggester: async () => undefined, scriptFile: app.vault.getAbstractFileByPath("Excalidraw/Scripts/Fractal Sync.md") });
        } catch (e) {
          globalThis.__fractalSyncOptions = null;
          throw e;
        }
        globalThis.__fractalSyncOptions = null;
        return "sync finished";
      })()`);
      // the sync keeps running after executeScript resolves: watch mtimes settle
      const rootDir = path.posix.dirname(root);
      const absDir = await cdp.evalIn(`app.vault.getAbstractFileByPath(${JSON.stringify(rootDir === "." ? "" : rootDir)})?.path ?? null`);
      const absRoot = await cdp.evalIn(`(app.vault.adapter && app.vault.adapter.getBasePath ? app.vault.adapter.getBasePath() : null)`);
      if (absRoot) {
        const watchDir = path.join(absRoot, rootDir === "." ? "" : rootDir);
        const touched = () => collect(watchDir);
        let prev = touched();
        // phase 1: this dispatch must produce at least one NEW write (BFS is slow — up to 3 min)
        const baseline = prev.newest;
        let sawNewWrite = false;
        for (let i = 0; i < 90 && !sawNewWrite; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const now = touched();
          if (now.newest > baseline) sawNewWrite = true;
          prev = now;
        }
        // phase 2: writes settled (three consecutive quiet rounds; the sync flag is unreliable)
        let quietRounds = 0;
        for (let i = 0; i < 90 && quietRounds < 3; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const now = touched();
          if (now.count === prev.count && now.newest === prev.newest) quietRounds++;
          else quietRounds = 0;
          prev = now;
        }
        try { await cdp.evalIn('globalThis.__fractalSyncOptions = null'); } catch (e) {}
        return { synced: root, indexDrawings: prev.count, wroteThisRun: sawNewWrite, lastWriteAgo: Math.round((Date.now() - prev.newest) / 1000) + "s" };
      }
      return { synced: root, note: "sync dispatched (file polling unavailable)" };
    },
  },
  {
    name: "dive",
    description: "Open a drawing and optionally zoom into an element (pod dive via zoomToElementId). Returns viewport telemetry.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "vault-relative drawing path" },
        key: { type: "string", description: "optional customData.key to zoom to, e.g. pod|Projects/Mobile App|embed" },
      },
      required: ["path"],
    },
    run: async (cdp, args) => cdp.evalIn(`(async () => {
      void app.workspace.openLinkText(${JSON.stringify(args.path)}, "obsidian-default").catch(() => {});
      let view = null;
      for (let i = 0; i < 25 && !view; i++) {
        await new Promise((r) => setTimeout(r, 400));
        view = app.workspace.getLeavesOfType("excalidraw").find((l) => l.view?.file?.path === ${JSON.stringify(args.path)} && l.view.getScene)?.view;
      }
      if (!view) throw new Error("view never loaded");
      const api = view.excalidrawAPI;
      const snap = () => { const s = api.getAppState(); return { zoom: s.zoom.value, scrollX: Math.round(s.scrollX), scrollY: Math.round(s.scrollY) }; };
      const before = snap();
      if (${JSON.stringify(args.key || "")}) {
        const el = view.getViewElements().find((e) => e.customData && e.customData.key === ${JSON.stringify(args.key || "")});
        if (!el) throw new Error("element not found: " + ${JSON.stringify(args.key || "")});
        setTimeout(() => { try { view.zoomToElementId(el.id, false); } catch (e) {} }, 60);
        await new Promise((r) => setTimeout(r, 1500));
      }
      return { path: ${JSON.stringify(args.path)}, before, after: snap() };
    })()`),
  },
  {
    name: "regenerate_workviews",
    description: "Run the dual-views CLI: one work-item hierarchy -> treemap.html + story map + workmap drawings (adopts moved positions, reads plugin-compressed files).",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "'json:<path>' or 'gh:<owner/repo>'" },
        out: { type: "string", description: "output dir (absolute, or relative to repo)" },
        title: { type: "string" },
      },
      required: ["source", "out"],
    },
    run: async (cdp, args) => {
      const cli = path.join(REPO, "dual-views", "cli.mjs");
      const out = path.isAbsolute(args.out) ? args.out : path.join(REPO, args.out);
      const stdout = await new Promise((resolve, reject) => {
        const p = spawn(process.execPath, [cli, "--source", args.source, "--out", out, ...(args.title ? ["--title", args.title] : [])], { encoding: "utf8" });
        let s = "";
        p.stdout.on("data", (c) => (s += c));
        p.stderr.on("data", (c) => (s += c));
        p.on("close", (code) => (code === 0 ? resolve(s) : reject(new Error("cli failed: " + s.slice(0, 400)))));
      });
      return { ok: true, output: stdout.trim().split("\n").slice(0, 8) };
    },
  },
  {
    name: "graph_analysis",
    description:
      "Nested-systems analysis of a brain: builds the property graph (folders = System nodes with CONTAINS edges; wikilinks + connection notes = typed link edges), then reports per-system roll-ups (size, density, bridges), a hierarchical community dendrogram (emergent systems within systems), top notes by PageRank, and system-to-system relationships. Works offline with an explicit vault path, or against the connected Obsidian vault.",
    inputSchema: {
      type: "object",
      properties: {
        brain: { type: "string", description: "brain root folder, e.g. Garden (empty = whole vault)" },
        vault: { type: "string", description: "absolute vault path; defaults to the connected Obsidian vault" },
        depth: { type: "number", description: "dendrogram depth (default 2)" },
      },
    },
    skipConnect: (args) => !!args.vault, // explicit vault = no Obsidian needed
    run: async (cdp, args) => {
      const vaultPath = args.vault || (await cdp.evalIn("app.vault.adapter.getBasePath()"));
      const { extractGraph } = await import(url.pathToFileURL(path.join(REPO, "fractal-index", "lib", "graph.mjs")).href);
      const brain = args.brain || "";
      const g = extractGraph(vaultPath, brain);
      const clip = (s) => (typeof s === "string" && s.length > 60 ? s.slice(0, 57) + "…" : s);
      const dendro = (n) => ({
        level: n.level,
        label: clip(n.label),
        size: n.nodes.length,
        children: n.children.map(dendro),
      });
      const edgeTypes = {};
      for (const [, e] of g.edges) edgeTypes[e.type] = (edgeTypes[e.type] || 0) + 1;
      const systems = g.nodesByLabel("System")
        .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
        .map((id) => {
          const st = g.systemStats(id, { top: 3 });
          return {
            system: st.id,
            notes: st.notes,
            subSystems: st.subSystems,
            internalEdges: st.internalEdges,
            bridgesOut: st.externalEdges,
            density: st.density,
            topNotes: st.topNotes.map((t) => t.basename),
            bridgesTo: st.bridges.map((b) => b.basename),
          };
        });
      const sysRels = g
        .match({ sourceLabel: "System", targetLabel: "System" })
        .filter((r) => r.r.type !== "CONTAINS")
        .map((r) => ({ from: r.a.properties.name || r.a.id, relation: r.r.type, to: r.b.properties.name || r.b.id }));
      return {
        vault: vaultPath,
        brain: brain || "(whole vault)",
        nodes: g.nodes.size,
        edges: g.edges.size,
        edgeTypes,
        systems,
        systemRelationships: sysRels,
        emergentSystems: dendro(g.detectCommunitiesHierarchical({ depth: args.depth ?? 2 })),
        topNotes: g
          .pageRank()
          .slice(0, 8)
          .map((r) => ({ note: (g.node(r.id)?.properties.basename || r.id), score: r.score })),
      };
    },
  },
];

function collect(dir) {
  let count = 0;
  let newest = 0;
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "_index.excalidraw.md") {
        count++;
        try { newest = Math.max(newest, fs.statSync(p).mtimeMs); } catch {}
      }
    }
  };
  walk(dir);
  return { count, newest };
}
