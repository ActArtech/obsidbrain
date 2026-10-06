# Example: Project Hub (portfolio, cross-project dependencies)

A working-team brain: two projects that share a foundation. The interesting
structure is **dependency arrows between pods** — the thing flat todo lists
can't show.

```
Projects/
├── _index.excalidraw.md
├── Roadmap.md                 hub → names both projects + shared library
├── Website Redesign/
│   ├── Brief.md               ⇄ Design System (mutual) · → Component Library (Shared)
│   ├── Design System.md
│   └── Analytics Plan.md      → Roadmap (points "up" to the portfolio level)
├── Mobile App/
│   ├── PRD.md                 → Component Library (Shared)
│   └── API Contract.md        → Design System (Website Redesign!)
└── Shared/
    ├── Component Library.md   the dependency hub — linked from everywhere
    └── Brand Assets.md
```

## Install

```bash
node examples/install-demo.mjs project-hub "<path-to-vault>"
```

Open `Projects/_index.excalidraw.md` → run **Fractal Index** with
*create sub-indexes* + *note-link arrows*; then repeat inside the three
project folders.

## What you should see

### Projects (level 1)
- Cards: Roadmap. Pods: Website Redesign, Mobile App, Shared.
- **Dependency web between pods** (the money shot — all six verified live):
  - Roadmap card → Mobile App pod and Shared pod; Roadmap ⇄ Website Redesign
    is ONE double-headed arrow (Roadmap links in, Analytics Plan links back).
  - Website Redesign pod → Shared pod (Brief → Component Library).
  - Mobile App pod → Shared pod (PRD → Component Library) **and**
    Mobile App pod → Website Redesign pod (API Contract → Design System):
    a cross-project dependency, visible *at the portfolio level* without
    opening either project.

### Website Redesign
- Brief ⇄ Design System: one double-headed arrow.
- Brief → Component Library: invisible here (target outside) — flip to the
  Projects map to see it as a pod edge.

### Mobile App
- Two cards, no arrows inside (both dependencies point outside the folder) —
  open Projects to see them. Good example of "arrows draw where both
  endpoints live."

### Shared
- Component Library with no in-folder arrows — but it is the most-linked note
  in the whole demo. Its importance shows one level up, not where it sits:
  exactly how a dependency hub behaves in real portfolios.

## Why this example matters

Every project tool shows you tasks *inside* a project. The Fractal Index shows
the **portfolio-level dependency graph** — who depends on shared code — with
zero manual diagram maintenance: the arrows are read from your notes' actual
wikilinks every time you regenerate.
