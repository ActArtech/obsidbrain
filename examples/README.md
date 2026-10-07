# Fractal Index — Examples

Two purpose-built demo brains, each with an installer and an annotated README
that predicts every arrow you'll see. Use them to learn the system, to demo it,
or as templates for your own structure.

| Example | Shape | Best at demonstrating |
|---|---|---|
| [Research Brain](research-brain/README.md) | knowledge work · 3 levels deep · 12 notes | mutual links, hub notes, cross-level pod edges, orphans, non-note folders |
| [Project Hub](project-hub/README.md) | team portfolio · 2 levels · 8 notes | cross-project dependency arrows between pods, "importance lives one level up" |
| [**Knowledge Garden**](knowledge-garden/README.md) | **showcase** · 3 levels · 51 notes · ~90 links | everything at real scale: literature pattern, people↔ideas, hubs, journal connective tissue, the link cap |

## Install (into any vault)

```bash
node examples/install-demo.mjs research-brain "<path-to-vault>"
node examples/install-demo.mjs project-hub    "<path-to-vault>"
```

Then, in Obsidian, open each folder's `_index.excalidraw.md` and run the
**Fractal Index** script (Scripts panel or command palette):

1. *"This folder + create missing sub-indexes"* the first time
2. *"With note-link arrows (ExcaliBrain dimension)"*
3. Repeat in each new sub-`_index` — one level per run

Regenerate any level at any time: node positions never move; arrows re-read
your actual wikilinks.

## Companion examples (dual-views)

The [`dual-views`](../../dual-views/README.md) generator ships its own sample
datasets — including `saas-platform.json`, where the four JTBD outcomes are an
AARRR funnel (Acquire → Activate → Retain → Expand), so the story-map columns
literally become your funnel and the treemap shows where the blocked work
hides (notifications & integrations in the sample).

```bash
node ../dual-views/cli.mjs --source ../dual-views/sample/saas-platform.json --out views
```

## Connection notes: fill in the why

Every arrow gets a first-class md note in that folder's `_connections/`
(frontmatter: from/to/relation/weight — body: **Why these are connected**
+ **Evidence**). The generated template is the prompt; the value is the
explanation you write. A filled note looks like this:

```markdown
## Why these are connected

Two answers to one question: how do simple parts produce structured
wholes? Networks supplies the static grammar (hubs, percolation, small
worlds); Emergence supplies the dynamic story (local rules compounding
into global order). An ant colony is a network that emergences: remove
the map, the traffic still flows.

## Evidence

[[Linked]] (Barabási) ch. 1–3; percolation chapter of the reading queue.
```

## Nested systems

Folders aren't just path prefixes — every content folder is a **System
node** and containment is typed `CONTAINS` edges, so systems nest to any
depth. `systemStats` rolls up size, density, bridges (what leaves the
system), and keystone notes; `detectCommunitiesHierarchical` finds
*emergent* systems-within-systems from the link structure alone, so you
can compare the structure you built with the structure you use.

Relationships between whole systems work like relationships between
notes — write a connection note whose `from`/`to` name folders:

```markdown
---
type: connection
from: "[[Garden/Inbox]]"
to: "[[Garden/Fields]]"
relation: nourishes
---
```

Inspect any brain from the command line:

```bash
node fractal-index/examples/nested-systems.mjs "<path-to-vault>" Garden
```

or ask an agent via MCP: the `graph_analysis` tool returns the system
tree, emergent dendrogram, and bridge report as JSON.
