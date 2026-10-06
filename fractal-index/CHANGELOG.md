# Fractal Index

A thin "fractal brain" layer built on the **Obsidian Excalidraw plugin's own extension points** (ExcalidrawAutomate scripts). It turns any folder of your vault into a stable, zoomable, infinitely-nestable visual map — with the guarantee that **node positions never move out from under you**.

## What it gives you

| Requirement | How it's met |
|---|---|
| Multiple diagrams, not one holistic view | Each folder gets its own `_index.excalidraw.md` drawing — as many views as you like |
| Shows everything inside a folder | Every file → a clickable node card; every subfolder → a "pod" |
| Visually progressive | Pods embed a live preview of the subfolder's own index drawing (zoom in, engage, or click through) |
| Static node positions | Position = persistent slot stored in each element's `customData`; regeneration only appends, never reshuffles |
| Infinite subsets | A pod opens *another diagram*, not just a file — recursively, folder after folder; breadcrumbs link back up |

## Install

1. Your vault needs the [Obsidian Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin) (developed against master @ 2.28.1).
2. Copy [`ea-scripts/Fractal Index.md`](ea-scripts/Fractal%20Index.md) into your vault's Excalidraw **scripts folder** (default `ea-scripts/` under the folder configured in *Excalidraw → Settings → Scripts*).

## Use

1. In any folder, create a new Excalidraw drawing named `_index` (file: `<folder>/_index.excalidraw.md`).
2. Open it and run the **Fractal Index** script (command palette → "Excalidraw: Run script" or the script toolbar).
3. Choose **"This folder + create missing sub-indexes"** the first time — the script lays out the folder and creates empty `_index` drawings for each subfolder.
4. Open each subfolder's `_index` and re-run the script there. Repeat downward — that's the fractal.

Re-run any index at any time: existing nodes keep their exact positions; new files are appended; deleted files disappear; a renamed folder keeps all its inner node positions (matched by basename).

## Guarantees (and the tests that prove them)

Run `node test/run-tests.mjs` — 19 checks, zero dependencies (Node ≥ 20):

- **T1** Fresh generation: file cards, pods, wiki-links, sub-index creation, embed previews, no duplicate ids.
- **T2** Determinism: two independent runs produce byte-identical layouts.
- **T3** Static positions under real vault churn — files added/deleted/moved, folder renamed `Areas→Zones`: untouched nodes don't move by a single pixel, renamed-folder contents keep their positions, new items get fresh slots, stale elements are cleaned up.
- **T4** Recursion: deepest level generates with breadcrumbs back to the parent index.
- **T5** The serialized `.excalidraw.md` artifact is structurally valid (frontmatter, sections, full element schema).

The harness compiles the **actual shipped script** exactly the way the plugin's `ScriptEngine` does (`new AsyncFunction("ea","utils", body)`) and runs it against a mock ExcalidrawAutomate + a real on-disk fixture vault, then renders the scene to [`test/out/preview.svg`](test/out/preview.svg) / `preview.png` and drop-in drawings [`Brain _index.excalidraw.md`](test/out/Brain%20_index.excalidraw.md), [`Areas _index.excalidraw.md`](test/out/Areas%20_index.excalidraw.md).

## Known limitations (v0.1)

- **One folder level per run.** The script creates missing sub-index files, but you open each and re-run there. (Phase 2: a single recursive sweep.)
- Sub-index embeds show the subfolder's *current saved* drawing — run the script in a subfolder first to populate it.
- A file *rename* (new basename) is treated as delete+add (new position); a file *move* between indexed folders keeps its basename-matched position in the destination index.
- The mock harness mirrors the EA API signatures as verified in the plugin source (`addText`/`addFrame`/`addEmbeddable`/`addArrow`/`getViewElements`/`copyViewElementsToEAforEditing`/`addElementsToView`, `utils.suggester`), but the first run inside a live Obsidian is still the real smoke test.

## Distribution & sharing

- **Script Store contribution**: [contribution/SCRIPT-STORE-PR.md](contribution/SCRIPT-STORE-PR.md) — ready-to-submit PR kit for zsviczian/obsidian-excalidraw-plugin (script + icon + PR text + checklist).
- v1.0.0, MIT License, zero dependencies, 19 test checks. Verified against plugin 2.28.1 (all ExcalidrawAutomate calls checked against the shipped main.js).

## Phase 2 ideas

- Recursive generation in one run (drive `ea.getViewOfFile` / raw scene JSON for sublevels).
- `ea.onLinkClickHook` (merged in PR #2960) to intercept pod clicks and zoom *into* the embedded sub-index instead of opening a tab.
- Autostart script (plugin setting) + vault event listeners for live sync.
- Slot compaction command ("reflow but keep clusters").
