# Example: Knowledge Garden (the showcase)

A realistic brain at **51 notes, 3 levels, ~90 wikilinks, 11 index drawings** — the example that demonstrates Fractal Index at the scale a real vault operates at, with the four canonical knowledge-work link patterns built in.

```
Garden/
├── _index.excalidraw.md      ← the map of maps (9 pods + Welcome hub)
├── Welcome.md                THE hub: 6 links spanning the whole garden
├── Fields/                   4 field notes + Topics pod
│   └── Topics/               10 topic notes: a hub (Emergence), chains, pairs
├── Methods/                  5 methods + Practices pod
│   └── Practices/            3 rituals (Daily Note, Weekly Review, Queue Hygiene)
├── People/                   5 thinkers — each mutual-linked with their ideas
├── Sources/                  8 literature notes (the Zettelkasten pattern)
├── Projects/                 2 projects cross-linking methods and fields
├── Journal/                  5 daily notes linking into what was worked on
├── Inbox/                    Reading Queue hub + 3 questions + 3 fleeting notes
└── attachments/              non-note pod
```

## Install

```bash
node examples/install-demo.mjs knowledge-garden "<path-to-vault>"
```

Open `Garden/_index.excalidraw.md` → run **Fractal Index** (create sub-indexes + link arrows), then descend: run it in `Fields/`, `Fields/Topics/`, `Methods/`, `Sources/`, `People/`, `Inbox/`, `Journal/`, `Projects/`.

## The four patterns to read on the maps

1. **Literature notes** (Zettelkasten): at the garden root, watch the
   `Sources` pod and `Fields` pod exchange arrows — every book points at the
   ideas it planted, and every field note points back at its source. At
   `Fields` level the same pattern repeats between field cards and the
   Topics pod.
2. **People ↔ ideas**: `People/Daily... ` — each person card connects to the
   fields/sources their work belongs to; the `People` map shows the web of
   who-belongs-to-what.
3. **Hub notes**: `Welcome` at the root (six arrows into three different
   pods) and `Emergence` at `Fields/Topics` (three arrows out) — the notes
   that hold the garden together are visible at a glance.
4. **Journal as connective tissue**: `Journal` notes link backwards into
   fields, methods, and sources — the Journal pod at the root is one of the
   busiest nodes on the map, which is exactly what a healthy practice looks
   like.

## What scale teaches that the small demos can't

- **The cap earns its keep**: the root map draws only the strongest 60 of
  ~100+ relationships — readable, not a hairball.
- **Multiple views of the same structure**: the same Sources↔Fields
  relationship appears as pod↔pod arrows at the root and differently at each
  level below — fractal self-similarity, on your actual links.
- **Weekly review becomes a ritual**: re-running the script in each level is
  a 60-second meditation on what changed — new notes appear in place,
  nothing you arranged by hand moves.

The garden's note bodies are deliberately real (short but substantive), so
hovering cards and opening notes feels like working a living vault, not a
fixture.
