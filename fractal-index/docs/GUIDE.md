# The Fractal Index Guide

*From folders you scroll, to a brain you can see, walk, and trust.*

---

## 1. Why this exists

Three failure modes of knowledge tools, and the answer this system gives:

| Failure mode | What goes wrong | The fractal answer |
|---|---|---|
| **Graph views** (Obsidian graph, ExcaliBrain) | nodes float on springs; the map you *learned* is gone the moment you navigate | positions are **permanent** — your spatial memory compounds |
| **Folder trees** | structure exists but is invisible; you scroll, you don't see | every folder is a **map**: files as cards, subfolders as pods with live previews of the level below |
| **Todo lists & boards** | dependencies between projects are invisible | arrows are read from your **actual wikilinks** — including cross-folder dependencies, at the level where they matter |

One more design commitment: **the system never surprises you**. Regeneration
never moves a node you placed. New items appear; dead ones disappear; nothing
else changes.

## 2. The 5-minute quick start

1. Create an Excalidraw drawing named `_index` inside any folder.
2. Open it → Scripts panel → **Fractal Index** →
   *"This folder + create missing sub-indexes"* → *"With note-link arrows"*.
3. Click a pod: the canvas **dives** into that subfolder's own map.
   Click it again: you're back. (Requires the **Fractal Navigate** startup
   script — see §6.)
4. **From then on, one command does everything: run Fractal Sync** from the
   root map — it regenerates the entire brain (all levels) after prompting
   once. First generation can also be done level-by-level with Fractal Index
   if you prefer watching the fractal grow.
5. Anytime anything changes — new notes, renames, reorganization — re-run
   Fractal Index in that folder. Positions of everything you've arranged
   **stay exactly where they are**; arrows re-anchor to reality.

## 3. Reading a map

```
🧠 Folder name                    ← title (with ↑ breadcrumb to the parent map)
│
├─ 📁 Pod (12)   [preview]        ← subfolder: count, live embed of its map,
│   ⤢ click pod to dive             click to dive, concentric border = recursion
│
└─ 📝 Note card ──── arrows ────   ← files: icon by type, click opens the note
```

- **Purple arrows** = real wikilinks between notes (both endpoints on this map).
  Mutual links collapse into one double-headed arrow.
- **Card→pod / pod→card / pod→pod arrows** = links that cross folder lines:
  they appear on the map where *both endpoints are visible*. A note's
  importance can live one level up from where the note sits.
- **Dashed gray spine** on the left = the folder's own structure (title → pods).

## 4. Feature reference — what you'll see, and where to see it

Every feature below is demonstrated in the bundled examples (§8); the
"Where" column points at the exact spot.

| Feature | What you'll see | Where |
|---|---|---|
| Static positions | add 10 notes, regenerate — nothing moves; new cards append | anywhere, try it |
| One-command brain sync | Fractal Sync regenerates every level, prompts once | Knowledge Garden: 11 maps in one run |
| Manual moves are truth | drag a card anywhere, regenerate — it stays; arrows re-anchor to it | any map |
| Pods move as one unit | grab a pod's frame/label/embed — the whole pod travels | any map with subfolders |
| Live arrow tracking | drag a card slowly — its arrows follow in real time | with Fractal Navigate installed |
| Dive / surface | click a pod → zoom into its embedded map; click again → back out | any map with pods |
| Breadcrumbs | `↑ Parent/` under the title, links to the parent map | any child map |
| Mutual-link merge | two notes linking to each other → ONE double-headed arrow | Garden: `Fields` (Systems Thinking ⇄ via Biology) |
| Hub visibility | a note with many links becomes a many-arrowed node | Garden: Welcome (root), Emergence (Topics) |
| Cross-folder dependencies | pod↔pod arrows between related folders | Projects example: Mobile App → Shared |
| Literature pattern | Sources pod ⇄ Fields pod at the root | Knowledge Garden root |
| Orphans respected | unlinked notes appear as plain cards, no fake arrows | Research Brain: Inbox |
| Link cap | strongest 60 links drawn; a Notice reports truncation | Knowledge Garden root (~100+ links) |
| Non-note folders | attachments/images show as pods like any folder | Garden: attachments |
| Honest counts | pod labels show `(n)` = files inside, always truthful | everywhere |

## 5. Workflows (the rituals that make it stick)

**Daily capture.** Write notes anywhere; don't organize. The maps don't need
your attention to stay correct — organization happens *when you look*.

**Weekly review (60 seconds).** Walk the levels top-down; re-run Fractal
Index in each. Three things happen: new notes appear in place, arrows update
to your actual links, and — because nothing else moves — *the diff is the
week*. You will literally see what grew.

**Restructuring without fear.** Renamed a folder? Its inner map keeps every
position (identity is by content, matched by name). Moved a file between
folders? The old card vanishes here, appears there — with its links
following it to wherever both endpoints meet.

**Deep reading.** Enter a subject folder, dive pod by pod, and read the
arrows: they are the citations you actually wrote, drawn where you wrote
them.

## 6. Fractal Navigate (the interaction layer)

Install once: *Settings → Excalidraw → Scripts → Startup script* →
`Excalidraw/Scripts/Fractal Navigate.md`. From every app start you get:

| Gesture | Result |
|---|---|
| click a **pod** | dive: animated zoom into that pod's embedded map |
| click it **again** | surface: back to the full map |
| click a **file card** | opens the note (native) |
| click **breadcrumb** | climbs to the parent map (native) |
| **Ctrl/Cmd**+click | native behavior escape hatch |
| drag a card | its arrows follow live (custom binding engine) |

## 7. FAQ & limits

- **Why don't arrows track moves without Navigate?** The Obsidian Excalidraw
  fork ships binding *fields* but no binding *engine*. Navigate supplies one
  via `onSceneChangeHook`; regeneration self-heals arrows regardless.
- **A link I know exists shows no arrow.** Arrows only draw where both
  endpoints are visible (card or pod) on *that* map. Climb a level — the
  relationship reappears as a pod edge. This is the anti-hairball rule.
- **Big folders?** Items cap at 500, links at 60 strongest (both in `CFG`).
- **Fractal Index does one level per run** (watch the fractal grow);
  **Fractal Sync does the whole brain in one command** — use Sync for the
  weekly rhythm.
- **Does it touch my notes?** Never — it only writes the `_index` drawings.

## 8. The examples ladder (small → showcase)

| Example | Size | Use it to learn |
|---|---|---|
| [Project Hub](../examples/project-hub/README.md) | 8 notes | cross-project dependency arrows |
| [Research Brain](../examples/research-brain/README.md) | 12 notes, 3 levels | mutual pairs, hub fan-out, orphans |
| [**Knowledge Garden**](../examples/knowledge-garden/README.md) | **51 notes, ~90 links** | **everything, at real scale** |

See [USE-CASES.md](USE-CASES.md) for recipes and [GALLERY.md](GALLERY.md)
for rendered maps of every example.
