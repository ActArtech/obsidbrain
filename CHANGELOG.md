# Changelog

obsidbrain ships two components, each with its own detailed changelog.
GitHub releases: <https://github.com/ActArtech/obsidbrain/releases>

| Component | Current | History |
|---|---|---|
| **Fractal Index / Sync / Navigate** (the Obsidian scripts) | 1.9.2 | [fractal-index/CHANGELOG.md](fractal-index/CHANGELOG.md) |
| **dual-views** (work-hierarchy → four views CLI) | 1.2.0 | [dual-views/CHANGELOG.md](dual-views/CHANGELOG.md) |

## Latest release

### [v1.9.2 — 2026-10-08](https://github.com/ActArtech/obsidbrain/releases/tag/v1.9.2) — Fractal Index

- **Parallel labeled arrows** — multiple relationships between the same pair
  render as parallel labeled arrows instead of overwriting each other; a
  per-map legend replaces the per-pod dive chips.
- **Root-level brains** — `build-index` discovers root-level brains outside
  the vault's folder tree and skips the Excalidraw folder when scanning.
- **Navigate / toggle hardening** — deterministic graph refresh (dataview
  force-reload + ExcaliBrain rebuild, split-reopen, detach-before-disable);
  ExcaliBrain in-between setup verified live.
- **Fixes** — white pod previews (image transclusion instead of embeddable
  iframes); Sync installs the tested copy of the Fractal Index script;
  demo GIF v3.

Install/update: pull the repo and re-run the Fractal Sync command in your
vault. See the README for the three-script flow (Index / Sync / Navigate).

## Previous versions

Fractal Index history runs 1.0.0 → 1.9.2 (2026-10-06 → 2026-10-08); dual-views
history runs 1.0.0 → 1.2.0 (2026-10-06). See the component changelogs above
for every entry.
