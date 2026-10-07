# Changelog

## 1.9.2 - 2026-10-08

- NEW: **multiple relationships between the same pair**. A pair can carry
  several connection notes (`A--B.md`, `A--B--2.md`, …), each its own
  aspect with its own relation type. Maps render them as PARALLEL arrows
  (fanned perpendicular, labeled with the relation when more than one);
  the graph model stores one edge per note and suppresses the inferred
  wikilink edge for covered pairs.
- Declutter: one legend line per map ("click a pod to dive · click again to
  surface · every arrow opens its connection note") replaces the dive chip
  repeated on every pod.
- FIXED: brain discovery never found a brain at the vault ROOT (parent check
  compared the root index against itself); the Excalidraw folder is now
  skipped when scanning.
- Tests: +1 multi-relationship graph test (21), all suites green.

## 1.9.1 - 2026-10-07

- ExcaliBrain in-between wiring completed and verified live: ontology fields
  (from -> Parents, to -> Children, exclusions -> Hidden),
  autoOpenCentralDocument, and Navigate as startup script. Navigate's toggle
  command now registers reliably in the script sandbox (ea.plugin) and shows
  by REMOVING the exclusions field (an `exclusions: false` line can still
  count as hidden in strict frontmatter checks). After flipping, dataview is
  force-reloaded and ExcaliBrain itself is rebuilt (brain view reopened in
  its own split, old views detached first) — the graph reflects the toggle
  in seconds; ExcaliBrain caches per-page ontology links, so frontmatter
  edits alone can leave it stale for minutes.

- FIXED: pod previews render as real mini-maps of the sub-index drawing.
  Pod embeds were `embeddable` elements — the plugin hosts those in a
  detached workspace leaf that never finishes loading for .excalidraw.md
  targets, so every preview stayed a white box. Previews are now image
  elements transcluding the sub-index drawing (EA: addImage; on-disk
  builds: an `## Embedded Files` section the plugin rasterizes natively —
  theme-aware, refreshes when the child map changes).
- Pod previews keep the dive interaction (click pod → dive) and position
  adoption unchanged; layout version unchanged (no re-layout).

## 1.9.0 - 2026-10-07

- NEW: **nested systems, properly**. Every content folder is a `System` node;
  containment is typed `CONTAINS` edges, so systems hold sub-systems to any
  depth. `systemOf` / `ancestors` / `descendants` walk the tree;
  `systemStats` rolls up size, density, bridges, and keystone notes;
  `inducedSubgraph` isolates a system for sub-analysis.
- NEW: `detectCommunitiesHierarchical` — emergent systems within systems
  (recursive community detection, dendrogram labeled by keystone note).
- NEW: system-level connection notes — from/to may name folders, so the
  in-between system works between systems.
- NEW: `examples/nested-systems.mjs` report; MCP tool `graph_analysis`
  (offline with explicit vault, or via the connected Obsidian).
- FIXED: graph extraction now reads connection notes from EVERY level's
  `_connections/` folder (was brain root only — most notes were invisible).
- FIXED: connection-note `from`/`to` parse `[[wikilink]]`, alias, `.md`,
  and trailing-slash forms; typed edges upgrade inferred wikilink edges
  without duplicating adjacency; `.excalidraw.md` drawings are not nodes.
- Link algorithms exclude `CONTAINS` edges by default — hierarchy and
  connectivity stay separate dimensions (opt in with `excludeTypes: []`).
- Tests: +20 graph checks (model, extraction, hierarchy, dendrogram,
  roll-ups), +1 MCP check (offline graph_analysis).

## 1.8.0 - 2026-10-07

- NEW: **connection notes - the in-between system**. Every significant
  relationship gets a first-class md note in `<folder>/_connections/`:
  frontmatter (from/to/relation/mutual/weight) + editable explanation and
  evidence sections. Map arrows link to their note (click the arrow in
  Obsidian to open the why-and-how). ExcaliBrain sees the note as a real
  node between the two (A -> note -> B chain) once "from"/"to" are added
  to its ontology fields in settings.
- Scanner hygiene: _-prefixed folders/files (connection notes, templates)
  are excluded from cards, pods, and the link graph.
- Component identity: placed components carry name/label for downstream
  tooling (stub keys, relationship anchors).
- Tests: 56 checks (T34: notes generated for drawn edges, frontmatter
  valid, arrows link to existing notes, user explanations survive
  rebuilds).

## 1.7.0 - 2026-10-07

- BALANCED SQUARE GRID in both directions: 3 pods -> 2x2, 8 -> 3x3. No more
  endless vertical columns (TD) or thin one-line strips (LR). TD = row-major
  with the spine above; LR = column-major with the spine on the left.
- Layout version 3: existing maps re-layout once with the new engine, then
  positions are stable again.
- Dive chip moved above the pod box (was buried behind the embed).
- ELK fix: correct global name (ELK) + hard timeouts, grid fallback offline.
- Sync script: per-level direct execution (engine preflight deadlock avoided).
- Sync mutex: overlapping syncs impossible.
- Tests: 55 checks (direction grid T31 rewritten for the new geometry,
  zero-overlap invariant T33 across all demo brains).

## 1.6.1 - 2026-10-06

- All three scripts gate on ea.verifyMinimumPluginVersion("2.0.0").

## 1.6.0 - 2026-10-06

- Relationship-aware curved arrows: 5 types inferred from topology
  (resonates/peer/bridges/nourishes/feeds), Bezier curves, visual
  hierarchy, parallel-arrow offsets.

## 1.5.0 - 2026-10-06

- Direction config (TD/LR) with persistence in title customData.

## 1.4.x - 2026-10-06

- ELK first-run layout (grid fallback offline); elbowed structural arrows.

## 1.3.0 - 2026-10-06

- Fractal Sync: one-command whole-brain regeneration.
- Tracker persistence via setDirty.

## 1.0.0 - 1.2.0 - 2026-10-06

- Fractal Index core (slot stability, adoption, embeds, breadcrumbs),
  Navigate (dive + tracking), Knowledge Garden / Research Brain /
  Project Hub examples, dual-views projections, MCP server.
