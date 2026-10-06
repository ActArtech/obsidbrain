# Obsidbrain — What We Built, and Why It Matters

*A complete system for seeing, walking, and trusting your knowledge — built entirely on the Obsidian Excalidraw plugin's own extension points.*

**Status: 104 automated test checks across Fractal Index, dual-views, and MCP · live-verified in Obsidian 1.14.4 + Excalidraw plugin 2.28.1 · MIT licensed · three scripts installed in two vaults · 25 generated maps**

---

## 1. The one-paragraph version

We turned Obsidian folders into **stable, zoomable, infinitely-nestable visual maps** ("Fractal Index"), gave those maps a **dive interaction** and a **live arrow-tracking engine** ("Fractal Navigate"), added **one-command whole-brain regeneration** ("Fractal Sync" — the weekly review ritual), and built a second tool ("dual-views") that projects a **work-item hierarchy into three synchronized views** — a progress treemap, a JTBD story map, and Obsidian-native drill-down drawings. Both tools share one philosophy: **one source of truth, many projections, positions you can trust, relationships you didn't have to draw.** Everything is generated, deterministic, tested, and regenerates without ever moving what you arranged by hand.

---

## 2. The inventory

| Component | What it is | Where | Tests |
|---|---|---|---|
| **Fractal Index** (v1.4.0) | ea-script: turns any folder into a map — file cards, subfolder pods with live embeds, breadcrumbs, wikilink arrows | [`fractal-index/ea-scripts/Fractal Index.md`](fractal-index/ea-scripts/Fractal%20Index.md) | 45 checks |
| **Fractal Navigate** (v1.0.0) | startup script: click-to-dive/surface, live arrow tracking (custom binding engine) | [`fractal-index/ea-scripts/Fractal Navigate.md`](fractal-index/ea-scripts/Fractal%20Navigate.md) | (in the 42) |
| **Examples** | Project Hub (8), Research Brain (12), **Knowledge Garden (51 notes, ~90 links)** — installable, annotated | [`fractal-index/examples/`](fractal-index/examples/README.md) | (in the 42) |
| **Fractal Sync** (v1.0.0) | ea-script: one command regenerates an entire brain (BFS the whole tree, prompts once, creates missing sub-indexes) | [`fractal-index/ea-scripts/Fractal Sync.md`](fractal-index/ea-scripts/Fractal%20Sync.md) | (in the 43) |
| **Docs** | Guide, workflow, use-case recipes, rendered gallery | [`fractal-index/docs/`](fractal-index/docs/GUIDE.md) | — |
| **dual-views** (v1.2.0) | Node CLI: one work-item model → treemap.html + story-map.excalidraw.md + workmap/ drill-downs; GitHub adapter; CI workflow | [`dual-views/`](dual-views/README.md) | 46 checks |
| **Contribution kit** | Ready-to-submit Script Store PR (script + icon + PR text + checklist) | [`fractal-index/contribution/SCRIPT-STORE-PR.md`](fractal-index/contribution/SCRIPT-STORE-PR.md) | — |
| **Verification notes** | CDP pitfalls and the live verification method | [`dev-tools/README.md`](dev-tools/README.md) | — |
| **obsidbrain-mcp** (v0.1.0) | MCP server exposing the brain to agents: status, list/read/query, generate, sync, dive, work views | [`mcp/README.md`](mcp/README.md) | 4 checks |

---

## 3. The value — five properties nobody gives you together

1. **Spatial memory that compounds.** Node positions are derived from persistent slot identity, not force layout. The map you learned last month is the map you see today. Obsidian's graph and ExcaliBrain re-flow constantly; we never do.
2. **Manual moves are truth.** Drag any card or pod anywhere — regeneration *adopts* your arrangement (never snaps back), pods move as grouped units, and arrows re-anchor to actual geometry. The system works *with* your hands, not against them.
3. **Relationships for free.** Arrows are read from your notes' real wikilinks (`metadataCache.resolvedLinks`) — mutual links merge, cross-folder links surface as pod↔pod edges, orphans stay honest. Zero diagram maintenance; the maps *are* your links.
4. **Fractal behavior, not just fractal looks.** Click a pod → the canvas dives into that subfolder's own map; click again → surface; breadcrumbs climb. Recursion you can feel, on content that's actually nested.
5. **Honest roll-ups** (dual-views). Progress = unweighted done-leaf counts from real signals (issue close state), never stale estimates. One hierarchy, three projections, same key space.

The underlying platform facts that make this valuable: the Obsidian Excalidraw fork ships binding *fields* but **no binding engine**, and strips align/distribute — so none of this comes for free; we built the missing layers on the plugin's own hooks (`onLinkClickHook`, `onSceneChangeHook`, `zoomToElementId`).

---

## 4. Best use cases — and when to use which

### Use Fractal Index + Navigate when…

| You are… | Your pattern | Payoff |
|---|---|---|
| A **researcher / Zettelkasten keeper** | Sources ↔ fields ↔ topics, questions in an inbox, journal entries | Your citation web and open questions are visible from orbit; the weekly map diff *is* your week |
| A **builder running projects** | Projects/ with shared dependencies | Cross-project dependency arrows between pods — visible without opening any project |
| A **writer** | Claims ↔ evidence ↔ chapters | Load-bearing arguments stand out by arrow count; weak chapters are visibly unlinked |
| An **operator (life admin)** | Areas, projects, journal | Neglected areas appear as unlinked islands; weekly review = 60-second map walk |
| A **team with a knowledge base** | Decisions, runbooks, systems, meetings | The root map is a living architecture diagram maintained as a side effect of writing notes |

### Use dual-views when…

- You manage work as **outcomes/JTBD** and want both a *functionality* lens (treemap: where is the blocked work?) and a *flow* lens (story map: does the journey hold up?) from one hierarchy.
- Your issues live on GitHub — the adapter pulls them via `gh` (labels: `outcome`, `capability`, `service:x`, `cap:#`), with an auto-bucket for unlabeled repos so the first run shows something real.
- You want CI to keep views fresh (bundled workflow regenerates on issue close / PR merge).

### When *not* to use it (honesty section)

- You want a **dynamic link navigator** to explore unknown connections — use ExcaliBrain for that; it's complementary (navigator vs. stable map).
- Your folders hold thousands of files at one level — caps (500 items, 60 arrows) keep maps readable but mean you should structure first.
- You need real-time multi-user cursors or freeform infinite whiteboards — that's Excalidraw itself, unscripted.

---

## 5. How to use it

### Fractal Index + Sync + Navigate (the 5-minute start)

```bash
# install the three scripts into your vault's script folder (default: Excalidraw/Scripts)
cp fractal-index/ea-scripts/"Fractal Index.md"    <vault>/Excalidraw/Scripts/
cp fractal-index/ea-scripts/"Fractal Sync.md"     <vault>/Excalidraw/Scripts/
cp fractal-index/ea-scripts/"Fractal Navigate.md" <vault>/Excalidraw/Scripts/
```
1. In any folder, create an Excalidraw drawing named `_index`.
2. Open it → Scripts panel → **Fractal Index** → *folder + sub-indexes* → *with note-link arrows*.
3. **From then on, one command: run Fractal Sync from the root map** — it regenerates the entire brain after prompting once.
4. Once: Settings → Excalidraw → Scripts → **Startup script** → `Fractal Navigate.md`.
5. Then: **click pods to dive**, click cards to open notes, drag anything — arrows follow; Sync anytime (nothing you arranged moves).

The full daily/weekly operating loop: [docs/WORKFLOW.md](fractal-index/docs/WORKFLOW.md).

Want it pre-populated? Install an example brain:
`node fractal-index/examples/install-demo.mjs knowledge-garden "<vault>"`

### dual-views

```bash
node dual-views/cli.mjs --source dual-views/sample/saas-platform.json --out views
node dual-views/cli.mjs --source gh:<owner>/<repo> --out views     # live issues
```
Outputs: `views/treemap.html` (search + `?focus=`), `views/story-map.excalidraw.md`, `views/workmap/` (Work Map → per-outcome → per-capability drill-downs). Copy `github-workflow/regenerate-views.yml` into your repo for CI.

---

## 6. How we know it works (the verification story)

- **79 automated checks, zero dependencies** — determinism, position stability under rename/move/churn, cross-view key contracts, output-purity gates (no markup can leak into drawings), dive/surface/tracking unit tests with exact geometry.
- **Live verification in the real app**, via a purpose-built Chrome-DevTools-Protocol driver (now with its own [pitfall manual](dev-tools/README.md)): the actual ScriptEngine executed the actual scripts; every demo map (20+ drawings across four brains) was generated by the plugin itself; the dive was proven with viewport telemetry (0.58× → 1.90× → 0.58×); arrow re-anchoring verified end-to-end — move → re-anchor in scene → dirty flag → autosave → re-anchored geometry parsed from the saved file itself.
- **Live testing found real bugs mocks couldn't**: `TFolder.isRoot` is a *function* on current Obsidian (title/breadcrumb broke — fixed, v1.0.1); pod↔pod arrows were silently dropped (found by checking the Project Hub example against its own docs — fixed + test-locked, v1.0.2); programmatic `updateScene` writes never persist (fixed via `setDirty`, v1.3.0). Each is the argument for the method.
- **Platform discoveries documented in changelogs** so the next builder doesn't re-derive them: no binding engine, `updateScene` invisible to the scene hash, hooks must target `ea.plugin.ea`, zoom calls must defer past click handlers.

---

## 7. Sharing & what's next

**Upstream review**: four stacked draft PRs ([#2972](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2972) through [#2975](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2975)) cover the Fractal Index core, navigation, wikilink arrows, and relationship styling. The [contribution kit](fractal-index/contribution/SCRIPT-STORE-PR.md) tracks the series. A short demo GIF would help reviewers. dual-views is npm-shaped and repo-ready.

**Roadmap, in value order**:
1. ~~obsidbrain-mcp~~ **BUILT (v0.1.0)** — 8 tools over the CDP bridge, offline-tested + live-smoked; see [mcp/README.md](mcp/README.md).
2. ~~Plugin-format parsing for dual-views~~ **DONE in v1.1.0** — lz-string decompression + position adoption, live-verified.
3. ~~ELK first-run layout~~ **DONE in v1.4.0** — elkjs layered layout on first generation, grid fallback offline, adoption preserves forever.
4. ~~Timeline projection~~ **DONE in dual-views v1.2.0** — Gantt-style progress bars per capability, grouped by outcome. Remaining: coverage/age lens.

---

*Built and verified 2026-10-06 on Obsidian 1.14.4 / plugin 2.28.1. Start with [the Guide](fractal-index/docs/GUIDE.md), taste the [Gallery](fractal-index/docs/GALLERY.md), or walk the Garden in `dev-vault`.*
