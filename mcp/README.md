# obsidbrain-mcp

A zero-dependency **Model Context Protocol server** that gives any MCP client
(Claude Desktop, Cursor, ZCode, …) live access to the Obsidian brain:
generate maps, sync whole brains, read map structure, query link graphs, dive
into pods, and regenerate the dual work views — all through the same CDP
bridge the project was live-verified with.

## Requirements

Obsidian must run with a debugging port (see `dev-tools/README.md`):

```powershell
Start-Process "$env:LOCALAPPDATA\Obsidian\Obsidian.exe" -ArgumentList '--remote-debugging-port=9333'
```

## Configure (any MCP client)

```json
{
  "mcpServers": {
    "obsidbrain": {
      "command": "node",
      "args": ["D:/work/launchpad/pads/obsidbrain/mcp/server.mjs"],
      "env": { "OBSIDIAN_CDP_PORT": "9333" }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `status` | Obsidian reachable? vault, plugin version, Navigate hooks — call first; returns the exact launch command when down |
| `list_brains` | every `_index` drawing grouped by brain root, with level counts |
| `read_map` | parsed map summary: element kinds, cards with positions/links, link arrows (handles plain AND plugin-compressed drawings) |
| `query_links` | resolved wikilinks from the metadata cache, filterable by folder |
| `generate_index` | regenerate ONE folder's map (creates `_index` if missing); positions preserved |
| `sync_brain` | regenerate EVERY map in a brain; returns only after file writes are observed (`wroteThisRun`) |
| `dive` | open a drawing and zoom to an element (viewport telemetry before/after) |
| `regenerate_workviews` | run the dual-views CLI (treemap + story map + workmap, move-adoption included) |

## Design rules (inherited from dev-tools/README.md)

- **One fact per tool**; effects verified on files (mtimes), never on promises.
- **Save after mutate**: every mutation explicitly saves (`view.save`), because
  programmatic `updateScene` writes never mark a view dirty.
- **Scripts execute directly** (compile + run with `ea.setView(view)`), not via
  `scriptEngine.executeScript` — the engine's save preflight can hang forever
  on generated drawings (see pitfall 16 in dev-tools/README.md).
- Graceful degradation: with Obsidian down, tools return structured errors
  that tell the agent exactly how to fix it.

## Test

```bash
node mcp/run-tests.mjs        # offline: protocol, tools/list, graceful-down (no Obsidian needed)
node mcp/test-client.mjs status|list_brains|read_map <path>|query_links <folder>|
                             generate_index <folder>|dive <path> <key>|sync_brain <root>|workviews <src> <out>
```
