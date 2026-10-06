# Review and fixes — 2026-10-07

## Scope

This review covered the published `obsidbrain` tree and the local draft material for the four stacked upstream PRs: [#2972](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2972) (core), [#2973](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2973) (navigation), [#2974](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2974) (wikilinks), and [#2975](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/2975) (relationships). Live GitHub PR pages were inaccessible from this environment, so their current review state and remote diffs were not verified. No PR branch was pushed or updated during this work.

## Findings and changes

1. **LR map arrows were re-anchored as TD arrows.** Fractal Index generated horizontal spines and vertical pod stubs for LR maps. Fractal Navigate's scene hook used vertical spine and horizontal stub geometry for every map. The tracker now reads the direction stored on the map title and uses matching geometry. The regression test exercises LR, then TD, including the spine, a pod stub, link arrows, convergence, and drag protection.
2. **The tested Fractal scripts differed from the installable scripts.** The local Fractal test harness now uses copies of the published script implementations. The public repo now includes that harness, and CI compares all three installable scripts with the tested copies before running the suite.
3. **Fractal tests relied on a child process for example installation.** The installer now exports `installDemo`, while retaining its CLI behavior. The test calls the same implementation directly and checks the generated notes and indexes. This permits the suite to run where process spawning is restricted.
4. **Sync left a 90-second timer alive after a successful run.** The timeout is now cleared when script execution settles, so offline tests exit promptly.
5. **The public repo described files that were absent.** It now includes the Fractal source, tests, guides, gallery, contribution kit, the dual-views workflow and package documents, and the linked CDP verification notes. The overview reflects that four draft upstream PRs already exist. The MCP setup example uses a portable path placeholder.
6. **Generated dual-views output was not ignored.** Root `.gitignore` paths now match the actual directory structure. The previous `test/out/` patterns did not match `dual-views/test/out/`.

## Verification

| Check | Result |
|---|---|
| Fractal Index suite, from the public repo | 54/54 passed |
| dual-views suite, from the public repo | 46/46 passed |
| Installable versus tested script hashes | All three matched |
| `git diff --check` | Passed |
| MCP offline suite | Could not start: this sandbox rejects Node child-process spawn with `EPERM` |

The first public-repo Fractal run also hit a transient `EPERM` during fixture rename; an immediate rerun passed 54/54. The TD/LR arrow fix has not yet been rechecked in a live Obsidian session.

## Upstream PR handoff

The navigation fix belongs in the branch behind #2973. Because #2974 and #2975 are stacked on it, they should be refreshed after #2973 is updated. The local `build/pr-series` files are reference snapshots; this work updated the installable and tested scripts in `public-repo` and the local Fractal source, not those remote PR branches. Reviewers should see a passing Fractal CI job and a short TD/LR drag demonstration before merge.
