---
excalidraw-script: true
---

/*
╭──────────────────────────────────────────────────────────────────────────────╮
│ FRACTAL SYNC v1.0.0                                                          │
│ One command regenerates an entire brain.                                     │
│                                                                              │
│ Run this from any drawing at the ROOT of a brain (e.g. Garden/_index).       │
│ It prompts ONCE for scope + link arrows, then walks the whole folder tree:   │
│ opens every _index drawing, regenerates it with the Fractal Index engine,    │
│ creates missing sub-indexes when allowed, and reports a summary.             │
│                                                                              │
│ This is the "weekly review" command: your entire brain re-syncs in one run,  │
│ and because positions are adopted, nothing you arranged by hand moves.       │
│                                                                              │
│ Requires `Fractal Index.md` next to this script (same Scripts folder).       │
╰──────────────────────────────────────────────────────────────────────────────╯
*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.0.0")) {
  new Notice("Fractal Index: this script requires Excalidraw plugin version 2.0.0 or newer. Please update the Excalidraw plugin.");
  return;
}


const TEMPLATE = [
  "---",
  "excalidraw-plugin: parsed",
  "tags: [excalidraw]",
  "---",
  "",
  "# Excalidraw Data",
  "## Text Elements",
  "",
  "## Drawing",
  "```json",
  '{"type":"excalidraw","version":2,"source":"fractal-index","elements":[],"appState":{"grid":null,"viewBackgroundColor":"#ffffff"},"files":{}}',
  "```",
  "",
].join("\n");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const view = ea.targetView;
  if (!view || !view.file) {
    new Notice("Fractal Sync: open a drawing at the brain root first (e.g. Garden/_index).");
  } else {
    const scriptDir = utils.scriptFile && utils.scriptFile.parent;
    const indexFile = (scriptDir && scriptDir.children || []).find((f) => f.name === "Fractal Index.md");
    if (!indexFile) {
      new Notice("Fractal Sync: Fractal Index.md not found in the Scripts folder.");
    } else {
      // headless path: agents (or tests) may preset options via globalThis.__fractalSyncOptions
      const preset = globalThis.__fractalSyncOptions || null;
      const scope = preset ? preset.scope : await utils.suggester(
        ["Whole brain + create missing sub-indexes", "Only existing _index maps"],
        ["self+create", "self"],
        "Fractal Sync — scope?"
      );
      if (!scope) {
        new Notice("Fractal Sync: canceled.");
      } else {
        const links = preset ? preset.links : await utils.suggester(
          ["With note-link arrows (ExcaliBrain dimension)", "Without link arrows"],
          [true, false],
          "Draw arrows between notes that link to each other?"
        );
        const source = await app.vault.read(indexFile);
        globalThis.__fractalSyncOptions = { scope, links };

        const rootPath = view.file.parent ? view.file.parent.path : "";
        const isRoot = rootPath === "/" || rootPath === "";
        const queue = [isRoot ? "" : rootPath];
        const seen = new Set();
        const done = [];
        const failed = [];

        while (queue.length) {
          const folderPath = queue.shift();
          const mapKey = folderPath || "/";
          if (seen.has(mapKey)) continue;
          seen.add(mapKey);
          const indexPath = (folderPath ? folderPath + "/" : "") + "_index.excalidraw.md";

          let f = app.vault.getAbstractFileByPath(indexPath);
          if (!f) {
            if (scope !== "self+create") continue;
            try {
              f = await app.vault.create(indexPath, TEMPLATE);
            } catch (e) {
              failed.push(indexPath + " (create failed)");
              continue;
            }
          }

          // fire-and-forget: awaiting openLinkText can wedge on busy workspaces
          void app.workspace.openLinkText(indexPath, "obsidian-default").catch(() => {});
          let leaf = null;
          for (let i = 0; i < 30 && !leaf; i++) {
            await sleep(400);
            leaf = app.workspace.getLeavesOfType("excalidraw")
              .find((l) => l.view && l.view.file && l.view.file.path === indexPath && l.view.getScene);
          }
          if (!leaf) {
            failed.push(indexPath + " (view never loaded)");
            continue;
          }

          try {
            // a hard cap so one slow level can never wedge the whole sync
            const withTimeout = Promise.race([
              ea.plugin.scriptEngine.executeScript(
                leaf.view, source, "Fractal Index", leaf.view.file, "manual"
              ),
              new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 90s")), 90000)),
            ]);
            await withTimeout;
            await sleep(400);
            done.push(indexPath);
          } catch (e) {
            failed.push(indexPath + " (" + (e && e.message ? e.message : e) + ")");
          }

          // enqueue child folders (existing _index maps, or all when creating)
          const folder = app.vault.getAbstractFileByPath(folderPath || "/");
          for (const c of (folder && folder.children) || []) {
            if (!c.children || c.name.startsWith(".")) continue;
            const childIdx = c.path + "/_index.excalidraw.md";
            if (scope === "self+create" || app.vault.getAbstractFileByPath(childIdx)) {
              queue.push(c.path);
            }
          }
        }

        globalThis.__fractalSyncOptions = null;
        new Notice(
          `Fractal Sync: ${done.length} maps updated` +
          (failed.length ? `, ${failed.length} failed (see console)` : "") + "."
        );
        if (failed.length) console.warn("Fractal Sync failures:", failed);
      }
    }
  }
} catch (err) {
  globalThis.__fractalSyncOptions = null;
  if (typeof Notice !== "undefined") new Notice("Fractal Sync error: " + (err && err.message ? err.message : err));
  console.error("Fractal Sync error:", err);
}
