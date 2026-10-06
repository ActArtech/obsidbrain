# Contributing Fractal Index to the Excalidraw Script Store

The lowest-friction way to share this with the Obsidian Excalidraw community is a PR to
**zsviczian/obsidian-excalidraw-plugin** adding two files to `ea-scripts/` — that folder *is* the
Community Script Store (users install scripts from it directly in the plugin's Scripts panel).
The maintainer merges community PRs regularly (31 active-branch PRs merged in the last quarter).

## Draft PR series (LIVE — opened on zsviczian/obsidian-excalidraw-plugin)

| PR | Innovation | Branch |
|---|---|---|
| [#2972](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2972) | Position stability + fractal embeds (core) | `fractal-index-core` |
| [#2973](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2973) | Dive interaction + live arrow tracking | `fractal-navigate` |
| [#2974](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2974) | ExcaliBrain dimension (real-wikilink arrows) | `fractal-links` |
| [#2975](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2975) | Relationship-aware curved arrows | `fractal-relations` |

Stacked series — review #2972 first; each branch builds on the previous. All drafts.

## Public repo (LIVE)

The scripts are published at https://github.com/ActArtech/obsidbrain —
install-from-URL works today:
- https://raw.githubusercontent.com/ActArtech/obsidbrain/main/scripts/Fractal%20Index.md
- https://raw.githubusercontent.com/ActArtech/obsidbrain/main/scripts/Fractal%20Sync.md
- https://raw.githubusercontent.com/ActArtech/obsidbrain/main/scripts/Fractal%20Navigate.md

## Files to submit (already prepared)

| File | Path in the PR |
|---|---|
| The script | `ea-scripts/Fractal Index.md` ← copy of `../ea-scripts/Fractal Index.md` (also [published](https://github.com/ActArtech/obsidbrain)) |
| The icon | `ea-scripts/Fractal Index.svg` ← 1024-viewBox `class="icon"` SVG, matches repo convention |

## Suggested PR

**Title:**
```
Add ea-script: Fractal Index — folder brain-maps with static node positions and infinite drill-down
```

**Description:**
```markdown
## Fractal Index

Turns any folder into a living, zoomable visual index inside one Excalidraw drawing.

- **Every file** in the folder becomes a clickable node card (linked to the file).
- **Every subfolder** becomes a "pod" that *embeds* that subfolder's own index drawing —
  fractal drill-down: zoom into the embed to descend, breadcrumb to climb back up.
- **Static positions, guaranteed**: node positions are derived from a slot persisted in
  element `customData`. Regenerating never moves existing nodes; new items append after the
  high-water mark; folder renames keep their node positions (basename matching).
- Creates missing `<subfolder>/_index.excalidraw.md` drawings on request, so the fractal can
  be grown one level at a time by re-running the script in each new index.
- Deterministic generation: two runs on the same folder produce identical layouts.
- Honors the repo conventions: verifyMinimumPluginVersion("2.0.0") gate, companion
  scripts (Sync/Navigate) published separately, CI-tested at the linked repo.
- **Optional link dimension (ExcaliBrain-style)**: when enabled, arrows between cards and
  pods reflect the *actual* wikilinks between the underlying notes
  (`app.metadataCache.resolvedLinks`); mutual links collapse into double-headed arrows,
  and file↔subfolder relationships appear as card↔pod arrows — link graph on stable positions.

### Usage
1. Create `_index.excalidraw.md` in a folder, open it, run the script.
2. Choose "This folder + create missing sub-indexes".
3. Open each generated sub-index and re-run. Repeat downward, forever.

Only standard ExcalidrawAutomate APIs (addText / addFrame / addEmbeddable / addArrow /
copyViewElementsToEAforEditing / addElementsToView) — verified against 2.28.1.
Comes with a zero-dependency test harness (19 checks) covering determinism, rename/move
position-stability, and recursion: [link to your repo]
```

## Pre-submission checklist

- [ ] **Live smoke test in Obsidian** (the one thing mocks cannot prove): open
      `dev-vault/Brain/_index.excalidraw.md` → Scripts panel → Fractal Index →
      "This folder + create missing sub-indexes". Confirm pods + embeds + links.
- [ ] Run it twice on the same folder → no position changes, no duplicates.
- [ ] Rename a folder in Obsidian, re-run its `_index` → positions preserved.
- [ ] Record a 20–30s GIF (ScreenToGif) — the maintainer's README/script store pages
      showcase scripts with visuals; PRs with demos land faster.
- [ ] (Optional) post in the PR that you maintain the harness link — helps trust.

## Submission commands (run from your fork)

```bash
gh repo fork zsviczian/obsidian-excalidraw-plugin --clone
cd obsidian-excalidraw-plugin
git checkout -b fractal-index-script
cp <obsidbrain>/fractal-index/ea-scripts/"Fractal Index.md"  ea-scripts/
cp <obsidbrain>/fractal-index/ea-scripts/"Fractal Index.svg" ea-scripts/
git add ea-scripts/"Fractal Index.md" ea-scripts/"Fractal Index.svg"
git commit -m "Add ea-script: Fractal Index"
gh pr create --fill
```

## Companion scripts (same repo, same technique)

- **Fractal Sync** — one command regenerates an entire brain (BFS over every
  `_index`, prompts once). Natural follow-up PR once Fractal Index lands.
- **Fractal Navigate** — dive/surface interaction + live arrow tracking via
  `onLinkClickHook`/`onSceneChangeHook`; depends on Fractal Index drawings.

## Alternative distribution paths

1. **Own repository + Script Store "install from URL"** — users can install scripts from any
   URL in the plugin's script store UI; zero maintainer involvement. Good first step while
   the PR is reviewed.
2. **Separate companion plugin** (like ExcaliBrain) — only worth it if we add the planned
   live-sync (vault events) and `onLinkClickHook` zoom-navigation, which need plugin-level
   lifecycle, not scripts.
3. **dual-views** is a standalone Node tool, not an Obsidian script — publish it as its own
   repo (`dual-views` is npm-ready: package.json, bin, tests). It complements rather than
   lives in the plugin repo.
