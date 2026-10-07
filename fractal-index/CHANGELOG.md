# Changelog

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
