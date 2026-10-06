# Changelog

## 1.2.0 - 2026-10-06

- NEW: **Timeline projection** — a Gantt-style progress view from the
  existing hierarchy. Each outcome is a horizontal band (journey order),
  each capability a progress bar within it. Green fill ∝ done/total;
  status-colored outline; overall progress bar at the top. Mermaid gantt's
  lens: "where are we in the journey?" at a glance — green-dominant bands
  are behind you, red/amber bands are where you're stuck. Same adoption
  contract: moved bands and bars keep their positions across regeneration.
  Tests: T16a-f (structure, fills, cross-view keys, adoption, determinism,
  schema).


## 1.1.0 - 2026-10-06

- **Plugin-format parsing**: `parseStoryMapElements` now reads the Obsidian
  Excalidraw plugin's re-saved drawings (`\`\`\`compressed-json` blocks,
  LZString base64) via a dependency-free decompressor — verified against real
  plugin-saved files from the vault (T15a/b).
- **Position adoption** (manual moves are truth, matching fractal-index):
  story-map columns and capability cards, workmap pods, capability cards and
  task cards all adopt their current x/y from the previous drawing — however
  it was saved (T15c/d). Untouched elements keep slot positions.
- Live-verified end-to-end: plugin re-saved the story map compressed → user
  card dragged to (950, 1430) → CLI regenerated over the compressed file →
  the moved card landed at exactly (950, 1430) and untouched columns stayed
  at their slots. Previously this exact sequence silently discarded the
  user's layout.
- Note: an OPEN Obsidian view will re-save an externally regenerated file in
  compressed form — harmless now; both formats round-trip.


## 1.0.0 — 2026-10-06

- Three projections from one work-item model: Plotly treemap (search + focus),
  Excalidraw story map, fractal Obsidian work-map drill-downs (embeds + breadcrumbs).
- Honest roll-ups: unweighted done-leaf counts; status from real signals (issue state).
- Three-anchor hierarchy with many-to-many capability-x-service membership.
- GitHub adapter (gh GraphQL) with onboarding fallback bucket.
- Position-stable regeneration in every Excalidraw projection (slot memory).
- 35 test checks, zero dependencies, including output-purity gates:
  no markup in generated data, whitelisted tags only in previews,
  and a markup-free treemap (no <br> anywhere in generated files).
