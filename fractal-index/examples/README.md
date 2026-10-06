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
