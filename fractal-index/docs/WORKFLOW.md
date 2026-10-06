# The Brain Workflow

The operating loop that makes the whole system productive. Print this; it's short.

## Daily (nothing to manage)

Write notes anywhere in the brain. Wikilink naturally — `[[Note]]` to anything
relevant. **You never touch the maps on busy days.** The maps don't decay,
because they're generated, not maintained.

## Weekly (the 5-minute review)

1. Open the brain root's `_index` drawing.
2. Run **Fractal Sync** → *whole brain + create missing sub-indexes* →
   *with note-link arrows*. One command walks every level.
3. Read the maps top-down, diving into pods that changed.
4. **The diff is your week**: new cards appeared in place, dead ones vanished,
   arrows moved to follow your actual links — and nothing you arranged by hand
   moved. What changed is what you did.

That's the whole ritual. Sync regenerates; Navigate makes maps walkable
(click pods to dive); the maps stay truthful because they're read from your
notes, never hand-drawn.

## While working

- **Dive, don't search**: root map → click the pod → you're in the sub-map.
  Breadcrumb (`↑`) climbs back.
- **Drag freely**: move cards and pods anywhere — arrows follow live
  (Navigate), and the next Sync adopts your arrangement as the new layout.
- **Restructure fearlessly**: rename/move folders and notes; identity is
  content-based, so maps keep their positions and links re-resolve.

## When tracking work (dual-views)

```bash
node dual-views/cli.mjs --source gh:<owner>/<repo> --out <vault>/Excalidraw/Work Views
```
Run after closing issues or merging PRs (or let the bundled GitHub Action do
it). Open `Work Map.excalidraw.md` — outcome pods with capability drill-downs —
or `treemap.html` for the where-is-it-blocked lens.

## The systems, one line each

| System | Role |
|---|---|
| Fractal Index | generates the maps (per folder, on demand) |
| Fractal Sync | regenerates the whole brain in one command |
| Fractal Navigate | dive/surface + live arrow tracking (startup script) |
| dual-views | work outcomes as treemap + story map + work map |
