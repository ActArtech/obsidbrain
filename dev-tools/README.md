# Dev Tools — driving Obsidian for verification and automation

A zero-dependency Chrome DevTools Protocol client (`ws-cdp.mjs`) plus runner
scripts that execute inside a live Obsidian. This is how everything in this
project was live-verified, and it is the foundation for a future
`obsidbrain-mcp` server.

## Use

```powershell
# launch Obsidian with a debugging port (use an uncommon port; 9222 is often taken by Chrome)
Stop-Process -Name Obsidian -Force
Start-Process "$env:LOCALAPPDATA\Obsidian\Obsidian.exe" -ArgumentList '--remote-debugging-port=9333'
# then:
curl -s http://127.0.0.1:9333/json/list -o cdp.json   # find the page target's webSocketDebuggerUrl
node dev-tools/ws-cdp.mjs "<wsUrl>" <runner.mjs>
```

Runners are `(async () => {...})()` expressions evaluated inside the app with
`awaitPromise`. Typical capabilities: open drawings, execute scripts via
`plugin.scriptEngine.executeScript(view, code, name, file, "manual")`, read
scene/appState, move elements, take screenshots (Win32 + System.Drawing in the
runners' history).

## Runner inventory

| Runner | What it does / demonstrates |
|---|---|
| `cdp-renav.mjs` | re-register Fractal Navigate's hooks with the latest script version (manual run overwrites the plugin-lifetime hooks) |
| `cdp-dive.mjs` | full dive/surface cycle with viewport telemetry (zoom before/after) |
| `cdp-track.mjs`, `cdp-direct.mjs`, `cdp-gates.mjs`, `cdp-nonce.mjs`, `cdp-final.mjs`, `cdp-rec.mjs` | the debugging ladder that isolated the tracker dispatch story — kept as a map of how to bisect a silent hook |
| `ws-drag.mjs` | trusted-input drag driver (Input.dispatchMouseEvent) + scene-coordinate math; also the record of why synthetic drags are the last resort |
| `cdp-persist.mjs` | tracker persistence proof: move card → re-anchor → `isDirty()` → poll the saved file for the new geometry |
| `cdp-sync.mjs`, `cdp-garden.mjs`, `cdp-batch2.mjs` | one-command whole-brain regeneration (Sync) and level-by-level batch generation |
| `cdp-useredit.mjs`, `cdp-close.mjs` | simulate the real user sequence: open view (plugin re-saves compressed) → drag a card → save → close → CLI regenerates and adopts |
| `cdp-hookserver.mjs`, `cdp-api.mjs`, `cdp-tab.mjs`, `cdp-probe.mjs`, `cdp-capture.mjs`, `cdp-dispatch.mjs`, `cdp-zoom.mjs`, `cdp-notices.mjs`, `cdp-clear.mjs`, `cdp-diag.mjs` | single-question probes (API surface, gates, notices) — copy one when you need one fact from the live app |

## Hard-won pitfalls (do not relearn these)

### Dispatch & hooks
1. **Hook callback arity**: `onSceneChangeHook.callback(elements, appState, files, view, ea)` — the VIEW is the 4th argument. Passing it 3rd silently no-ops.
2. **The first onChange after load is consumed** by the view's `justLoaded` branch — it returns before hooks dispatch.
3. **Programmatic `api.updateScene` writes are invisible** to the plugin's scene hash (`hashElementsVersion`) — `onSceneChangeHook` never fires for them, and they don't mark the view dirty (won't save). Real user edits (drags) do both. After programmatic mutations, call `view.setDirty()`.
4. **Manual script runs get a temporary view-scoped EA** — hooks set on it die with it. Register hooks on `ea.plugin.ea` for plugin lifetime.
5. **Zoom calls inside click handlers must be deferred** (~60ms `setTimeout`) or the click's aftermath cancels them.

### Instrumentation & verification method
6. **Instrumentation can poison the system under test**: a debug wrapper that resets a counter to a number will throw inside the hook chain forever after. Wrap fresh, and clean up.
7. **Synthetic input is unreliable** (DPR scaling, hidden tabs, trusted events): prefer driving APIs directly, and verify effects on FILES rather than simulating gestures. When you must verify a drag-path behavior, the honest options are: invoke the registered hook/callback directly (proves everything but React's event wiring), or ask the human for ten seconds.
8. **Verify on files, not promises**: `executeScript` may resolve before the script's async work completes — wait for side effects (file mtimes/content), not the returned promise.
9. **One fact per probe**: when something silently no-ops, write a single-question eval (see the probe runners) instead of compounding guesses in one big script.

### Platform behaviors
10. **The plugin re-saves drawings in its own format** (`compressed-json`, LZString base64) whenever a view opens/saves — external plain-JSON writes get re-compressed by any open view. Parsers must handle both (dual-views does since v1.1.0).
11. **`zoomToElementId`/`zoomToElements`** are the real dive APIs on the view (the fork has no `scrollToContent` on the imperative API).
12. **`TFolder.isRoot` is a function** on current Obsidian, not a boolean — root checks must be path-based (`folder.path === "/"`).

### Environment
13. **Workspace state matters**: dozens of leftover leaves put the app in a pathological state (Sync wedged mid-tree). Restart to a clean state before blaming your code.
14. **Windows**: `?` is illegal in filenames; `/tmp` on this machine fills up; a shell CWD inside a directory locks it against deletion (EBUSY on rmSync — clean child dirs, not the parent); Python heredocs mangle `\` escapes in embedded code — prefer the Edit tool for code, and literal regexes over `new RegExp(string)`.
16. **`scriptEngine.executeScript` can hang forever** on its legacy save preflight
    (observed when the target drawing contains generated text elements with >8-char
    ids — exactly our drawings). Reliable alternative: compile the script body and
    run it directly — `ea.setView(view, false)` then
    `new (async()=>{}).constructor("ea","utils", body)(ea, utils)` — the Sync BFS
    that hung for 3 minutes via the engine completes in ~4s directly.
15. **Port 9222 is usually Chrome's** — pick an uncommon debugging port and verify the listener's owning PID before debugging "wrong app" responses.

## From here to obsidbrain-mcp (built — see ../mcp/)

The MCP server now exists at [`../mcp/`](../mcp/README.md) — built on this bridge, with every rule above enforced in its tool implementations.
