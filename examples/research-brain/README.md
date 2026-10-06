# Example: Research Brain (Zettelkasten, 3 levels)

A knowledge-work brain designed to exercise **every feature** of Fractal Index
and the ExcaliBrain link dimension. Install it, generate each level, and read
this page against the drawings — every arrow below is predictable.

```
Research/
├── _index.excalidraw.md        ← level 1 map
├── README.md                   hub note → links into 3 pods
├── Fields/                     ← level 2 map
│   ├── Physics.md
│   ├── Neuroscience.md         ↕ mutual link with Complexity Science
│   ├── Complexity Science.md
│   └── Topics/                 ← level 3 map (deepest)
│       ├── Neural Networks.md
│       ├── Emergence.md        hub-within-a-level: links up to two Fields notes
│       └── Scale-Free Networks.md
├── Methods/                    ← level 2 map
│   ├── Statistical Methods.md
│   └── Computational Modeling.md
├── Inbox/
│   ├── Reading List.md         THE hub: four links across the brain
│   └── Question - consciousness.md   orphan on purpose
└── attachments/                demonstrates a non-note folder as a pod
```

## Install

```bash
node examples/install-demo.mjs research-brain "<path-to-vault>"
```

Then open `Research/_index.excalidraw.md` in Obsidian → Scripts → **Fractal
Index** → *"This folder + create missing sub-indexes"* → *"With note-link
arrows"*. Repeat in `Fields/`, `Topics/`, `Methods/`, `Inbox/`.

## What you should see, level by level

### Research (level 1)
- Cards: `README` + pods: `Fields`, `Methods`, `Inbox`, `attachments`.
- **Card→pod arrows** from README: it links to notes living inside Fields and
  Methods → two arrows from the README card into those pods.
- **Hub in action**: `Inbox/Reading List` links to 4 notes across the brain →
  the Inbox *pod* gets pod→pod arrows into Fields (3 targets) and Methods
  (1 target). Open `Inbox/_index` to see the fan-out from the card itself.
- **Cross-branch mutual**: Fields ⇄ Methods — Computational Modeling and
  Neural Networks reference each other from both sides, so the two pods get
  one double-headed arrow. (Verified live: 5 arrows at this level.)

### Fields (level 2)
- Cards: Physics, Neuroscience, Complexity Science. Pod: Topics.
- **Two mutual pairs**: Neuroscience ⇄ Complexity Science, and
  Physics ⇄ Complexity Science — each renders as ONE double-headed arrow.
- **Pod→card arrows**: files inside Topics (Emergence) link up to Neuroscience
  and Complexity Science → two arrows from the Topics pod to those cards.
  This is the ExcaliBrain "children point at parents" pattern, drawn on a
  stable map.

### Topics (level 3)
- Three cards, no pods. Neural Networks → Emergence and
  Scale-Free Networks → Neural Networks: two single arrows.
- Emergence's own links point outside this folder → invisible here (arrows
  only draw where both endpoints are on the map); they reappear at the Fields
  level as pod→card edges.

### Methods (level 2)
- Two cards. Computational Modeling's link to Neural Networks is invisible
  here (target lives in a different branch) — by design. Reappears nowhere
  both endpoints coexist; that honesty prevents hairballs.

### Inbox
- `Reading List` with arrows out to… nothing at this level (all four targets
  are outside Inbox) — but its card is the hub you saw firing at level 1.
- `Question - consciousness`: zero arrows. Orphans are fine; the map doesn't
  invent relationships.

## Feature checklist demonstrated

| Feature | Where to look |
|---|---|
| Static positions | add a note anywhere, regenerate — nothing moves |
| Infinite recursion | Research → Fields → Topics (embeds all the way down) |
| Breadcrumbs | `↑ Fields/` etc. at every child level |
| Mutual-link merge | Neuroscience ⇄ Complexity Science (Fields) |
| Cross-level pod edges | Topics pod → Neuroscience card (Fields) |
| Hub fan-out | README and Reading List (Research level) |
| Orphans tolerated | Question - consciousness (Inbox) |
| Non-note pods | attachments/ |
