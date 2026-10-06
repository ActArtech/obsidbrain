# dual-views — one hierarchy, two projections

> Part of the obsidbrain toolkit — see the project-wide [OVERVIEW](../OVERVIEW.md).

Implementation of the outcome-driven architecture: a **single work-item hierarchy** (three enforced anchors + a many-to-many mapping) projected into two complementary visualizations that share one key space.

- **`treemap.html`** — functionality-progress view (Plotly): root → outcome → capability → capability×service → task. Tile size = task size; color = rolled-up done-leaf fraction. Native drill-down; `?focus=<key>` dims everything outside a subtree; live search box filters tiles; clicking a tile prints its ancestry chain and a focus link.
- **`story-map.excalidraw.md`** — JTBD/flows view, generated directly as an Obsidian-Excalidraw drawing (no Obsidian needed to generate): one column per outcome in journey order, capability cards stacked under it, service chips with per-membership roll-ups, honest progress bars, status-colored borders, cards/chips link to their GitHub issues.
- **`timeline.excalidraw.md`** — Gantt-style progress view: outcome bands with capability progress bars; green fill = done, status outline = current state. The Mermaid-gantt lens: green-dominant bands are behind you, red/amber is where you're stuck.
- **`workmap/`** — fractal Obsidian drill-down (projection 3): `Work Map.excalidraw.md` (outcome pods embedding each outcome drawing) → `<outcome>.excalidraw.md` (capability cards with embeds + breadcrumb up) → `<capability>.excalidraw.md` (task cards grouped by service, linked to issues, breadcrumb up). In Obsidian every pod is a live embed: zoom in to go deeper, breadcrumb to go up — the same fractal navigation as the [`fractal-index`](../fractal-index/README.md) layer, driven by the work-item model.

Both views are **generated from the same model** — no hand-maintained diagrams, no drift.

## Data model (single source of truth)

```
outcome (JTBD)                 ← anchors, ordered by journey (flowOrder)
└── capability                 ← anchor under exactly one outcome
    └── [capability × service] ← DERIVED: membership from task mapping
        └── task (leaf)        ← anchor; references capability + service
service                        ← standalone code-tree anchor
```

- Tasks reference `capability` **and** `service` — a mapping table, not an 8-deep parent chain, so one function can serve two capabilities without duplication.
- Roll-ups are **unweighted done-leaf counts** (`done/total`) — no stale estimates.
- Aggregate status: blocked > in_progress > todo; done only when every leaf is done.

## Usage

```bash
# from a JSON work-item list (see sample/workitems.json)
node cli.mjs --source sample/workitems.json --out views

# live from GitHub issues (read-only, via gh CLI auth)
node cli.mjs --source gh:owner/repo --out views --limit 200
```

Outputs in `--out`: `treemap.html`, `story-map.excalidraw.md`, `story-map.svg` (preview), `workmap/` (one drawing per outcome + per capability + the root Work Map).

**Regeneration is position-stable** in every Excalidraw projection — and format-proof: the parser reads both our plain-JSON output and the plugin's compressed re-saves, so opening a view in Obsidian can never break adoption: slot memory persisted in element `customData` is adopted from the previous files — status flips, task additions and journey re-ordering never move existing columns, cards, pods or task tiles; new items append after the high-water mark.

## GitHub conventions (labels)

| Label | Effect |
|---|---|
| `outcome` | issue becomes an outcome (journey order = issue number) |
| `capability` | issue becomes a capability (parent = GitHub sub-issue parent) |
| `service:<name>` | declares/uses service `<name>` |
| `cap:<issue#>` | maps a task to capability `gh-<issue#>` |
| `wip`, `blocked` | task status (closed ⇒ `done`) |

No outcome labels yet? The first run auto-buckets everything under a synthetic **Backlog → Untriaged** tree so you see real data immediately, then label your way out of the bucket.

## CI

Copy [`github-workflow/regenerate-views.yml`](github-workflow/regenerate-views.yml) to `.github/workflows/` in your repo: regenerates both views on issue changes and PR merges, commits them back. Status comes from real signals (issue close state) — the core of the "honest roll-ups" rule.

## Tests

`node test/run-tests.mjs` — 31 checks, zero dependencies (Node ≥ 20):

- honest roll-ups at every level; many-to-many membership and service-lens roll-ups
- treemap rows: leaves-only values, correct parenting, progress per row
- treemap HTML: embedded model parses back; focus/cross-view logic present
- story map: keyset covers every outcome/capability/membership; issue links; status colors
- determinism: byte-identical generations
- position stability: status flips / journey re-ordering move nothing; new capabilities append
- cross-view contract: story-map keyset ≡ treemap non-task keys
- `.excalidraw.md` schema validity + slot persistence
- GitHub adapter conventions incl. onboarding fallback
- fractal work map: one drawing per level, embeds + breadcrumbs, determinism, regeneration stability
- CLI end-to-end (also re-runs over its own output to prove idempotent regeneration)

Artifacts land in `test/out/` (treemap.html, story-map.excalidraw.md, story-map.svg). A live read-only smoke against a real repo: `node cli.mjs --source gh:zsviczian/obsidian-excalidraw-plugin --out test/out-gh --limit 40`.

## Relation to the fractal-index layer

Same philosophy, different projection: [`../fractal-index/`](../fractal-index/README.md) maps a *vault folder* hierarchy into stable, fractal Excalidraw indexes; `dual-views` maps a *work-item* hierarchy into a treemap + story map. The slot-memory technique (customData identity + high-water-mark append) is shared. Natural next step: a third projection rendering the work-item tree through the fractal-index engine inside Obsidian, so clicking a capability card zooms into its task drawing.
