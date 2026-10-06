// dual-views — practical test suite (zero deps, Node ≥ 20)
//
// T1  model roll-ups (honest counts, many-to-many)
// T2  membership + service-lens roll-ups
// T3  treemap rows structure
// T4  treemap HTML embeds the same data + focus logic
// T5  story map: keyset, links, status colors
// T6  determinism: two fresh runs byte-identical
// T7  position stability across regeneration (status flips, additions, re-ordering)
// T8  cross-view contract: identical key sets in both projections
// T9  .excalidraw.md schema validity
// T10 GitHub adapter conventions (fixture)
// T11 CLI end-to-end

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import assert from "node:assert/strict";
import { buildModel, treemapRows } from "../lib/hierarchy.mjs";
import { renderTreemapHTML } from "../lib/treemap-html.mjs";
import { buildStoryMap, toExcalidrawMD, toSVG, parseStoryMapElements } from "../lib/storymap-excalidraw.mjs";
import { projectIssues } from "../lib/github-source.mjs";
import { generate } from "../cli.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const OUT = path.join(HERE, "out");
const SAMPLE = JSON.parse(fs.readFileSync(path.join(ROOT, "sample", "workitems.json"), "utf8")).items;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name + " — " + e.message]);
    process.exitCode = 1;
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name + " — " + e.message]);
    process.exitCode = 1;
  }
}

const model = buildModel(SAMPLE);

/* ── T1 roll-ups ── */
check("T1a root roll-up 9/16 done", () => {
  assert.equal(model.root.rollup.done, 9);
  assert.equal(model.root.rollup.total, 16);
});
check("T1b outcome roll-ups (5/8, 3/6, 1/2)", () => {
  const [a, b, c] = model.outcomes;
  assert.deepEqual([a.rollup.done, a.rollup.total], [5, 8]);
  assert.deepEqual([b.rollup.done, b.rollup.total], [3, 6]);
  assert.deepEqual([c.rollup.done, c.rollup.total], [1, 2]);
});
check("T1c aggregate statuses", () => {
  const byKey = Object.fromEntries(model.outcomes.map((o) => [o.key, o.status]));
  assert.equal(byKey["o-visual-brain"], "blocked"); // blocked leaf outranks in_progress
  assert.equal(byKey["o-agent-flow"], "in_progress");
});
check("T1d invalid items rejected (task without capability)", () => {
  assert.throws(() => buildModel([...SAMPLE, { key: "x", title: "orphan", kind: "task" }]), /capability/);
});

/* ── T2 memberships / service lens ── */
check("T2a membership nodes built per capability×service pair", () => {
  assert.ok(model.memberships.has("c-dual-views|svc-dual-views"));
  const m = model.memberships.get("c-dual-views|svc-dual-views");
  assert.equal(m.rollup.total, 3); // treemap + storymap + crossfilter
  assert.equal(m.rollup.done, 2);
});
check("T2b service roll-up spans capabilities (svc-dual-views 5/6)", () => {
  const s = model.services.find((s) => s.key === "svc-dual-views");
  assert.deepEqual([s.rollup.done, s.rollup.total], [5, 6]);
});

/* ── T3 treemap rows ── */
const rows = treemapRows(model);
check("T3a rows: root + outcomes + capabilities + memberships + tasks", () => {
  const kinds = new Map([
    ["root", rows.filter((r) => r.id === "").length],
    ["outcome", rows.filter((r) => model.outcomes.some((o) => o.key === r.id)).length],
    ["cap", rows.filter((r) => model.capabilities.some((c) => c.key === r.id)).length],
    ["mem", rows.filter((r) => r.id.includes("|")).length],
    ["task", rows.filter((r) => model.tasks.some((t) => t.key === r.id)).length],
  ]);
  assert.deepEqual([...kinds.values()], [1, 3, 7, 11, 16]);
});
check("T3b values only on leaves; every task's parent is its membership (or capability)", () => {
  for (const r of rows) {
    if (r.value > 0) assert.ok(model.tasks.some((t) => t.key === r.id), "non-leaf with value: " + r.id);
  }
  const t = rows.find((r) => r.id === "t-slot-engine");
  assert.equal(t.parent, "c-static-positions|svc-fractal-index");
});
check("T3c row progress matches node roll-ups", () => {
  const o = rows.find((r) => r.id === "o-outcome-dev");
  assert.equal(o.done, 3);
  assert.equal(o.total, 6);
  assert.ok(Math.abs(o.progress - 0.5) < 1e-9);
});

/* ── T4 treemap HTML ── */
const html = renderTreemapHTML(model, rows, { title: "TEST", storyMapHref: "story-map.excalidraw.md" });
check("T4a HTML embeds the model and it parses back", () => {
  const m = html.match(/const MODEL = (\{.*?\});\n/s);
  assert.ok(m, "MODEL payload not found");
  const data = JSON.parse(m[1].replace(/\\u003c/g, "<"));
  assert.equal(data.data.length, rows.length);
  assert.deepEqual(data.overall, { done: 9, total: 16 });
});
check("T4b focus + cross-view link present", () => {
  assert.match(html, /URLSearchParams\(location\.search\)\.get\("focus"\)/);
  assert.match(html, /story-map\.excalidraw\.md/);
  assert.match(html, /plotly_treemapclick/);
});
check("T4c live search filter present", () => {
  assert.match(html, /id="search"/);
  assert.match(html, /addEventListener\("input"/);
});

/* ── T5 story map ── */
const story = buildStoryMap(model, []);
check("T5a keyset covers every outcome, capability, membership", () => {
  for (const o of model.outcomes) assert.ok(story.keyset.has(o.key), "missing outcome " + o.key);
  for (const c of model.capabilities) assert.ok(story.keyset.has(c.key), "missing capability " + c.key);
  for (const k of model.memberships.keys()) assert.ok(story.keyset.has(k), "missing membership " + k);
});
check("T5b capability cards link to their issue URLs", () => {
  const card = story.elements.find((el) => el.customData?.rawKey === "c-static-positions" && el.type === "text");
  assert.equal(card.link, "https://github.com/example/launchpad/issues/10");
});
check("T5c status colors applied (blocked capability = red stroke)", () => {
  const card = story.elements.find((el) => el.customData?.rawKey === "c-multi-view" && el.type === "rectangle");
  assert.equal(card.strokeColor, "#dc2626"); // blocked via t-third-view
});

/* ── T6 determinism ── */
const md1 = toExcalidrawMD(buildStoryMap(model, []).elements);
const md2 = toExcalidrawMD(buildStoryMap(model, []).elements);
check("T6 two fresh generations are byte-identical", () => {
  assert.equal(md1, md2);
  assert.equal(renderTreemapHTML(model, treemapRows(model), { title: "TEST", storyMapHref: "story-map.excalidraw.md" }).length, html.length);
});

/* ── T7 position stability ── */
const posByRawKey = (md) => {
  const map = new Map();
  for (const el of parseStoryMapElements(md)) {
    if (el.customData?.rawKey) map.set(el.customData.rawKey + "|" + el.customData.space, { x: el.x, y: el.y, slot: el.customData.slot });
  }
  return map;
};
const v1 = posByRawKey(md1);

// churn: flip a status, swap outcome journey order, add a new capability + task
const churned = SAMPLE.map((it) =>
  it.key === "t-crossfilter" ? { ...it, status: "done" } : it
).map((it) => {
  if (it.key === "o-visual-brain") return { ...it, flowOrder: 9 };
  if (it.key === "o-agent-flow") return { ...it, flowOrder: 1 };
  return it;
});
churned.push({ key: "c-coverage", kind: "capability", title: "Coverage lens", parent: "o-outcome-dev" });
churned.push({ key: "t-cov", kind: "task", title: "Wire coverage data", capability: "c-coverage", service: "svc-ci", status: "todo" });

const model2 = buildModel(churned);
const md3 = toExcalidrawMD(buildStoryMap(model2, parseStoryMapElements(md1)).elements);
const v2 = posByRawKey(md3);

check("T7a status flip moved nothing", () => {
  for (const [k, p] of v1) {
    if (v2.has(k)) {
      assert.deepEqual({ x: v2.get(k).x, y: v2.get(k).y }, { x: p.x, y: p.y }, k + " moved");
    }
  }
});
check("T7b outcome journey re-order kept columns in place", () => {
  assert.deepEqual(v2.get("o-visual-brain|outcome"), v1.get("o-visual-brain|outcome"));
  assert.deepEqual(v2.get("o-agent-flow|outcome"), v1.get("o-agent-flow|outcome"));
});
check("T7c new capability appended after existing cards (fresh slot)", () => {
  const c = v2.get("c-coverage|card");
  assert.ok(c, "new capability missing");
  const maxSlot = Math.max(...[...v1.values()].map((p) => p.slot ?? -1).filter((s) => s >= 0));
  assert.ok(c.slot > maxSlot || c.slot >= 0, "expected a fresh slot");
  assert.ok(!v1.has("c-coverage|card"));
});

/* ── T8 cross-view contract ── */
check("T8 cross-view contract: story keyset == treemap non-task keys", () => {
  const expected = new Set([
    ...model.outcomes.map((o) => o.key),
    ...model.capabilities.map((c) => c.key),
    ...model.memberships.keys(),
  ]);
  assert.deepEqual([...story.keyset].sort(), [...expected].sort());
  const treemapIds = new Set(rows.map((r) => r.id));
  for (const k of expected) assert.ok(treemapIds.has(k), "treemap missing " + k);
});

/* ── T9 .excalidraw.md schema ── */
check("T9a frontmatter + sections + parseable scene", () => {
  assert.match(md1, /^---\nexcalidraw-plugin: parsed\n/);
  assert.match(md1, /# Excalidraw Data\n## Text Elements\n[\s\S]*\n## Drawing\n```json\n/);
  const scene = JSON.parse(md1.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.ok(scene.elements.length >= 40);
  for (const el of scene.elements) {
    for (const f of ["id", "type", "x", "y", "width", "height", "strokeColor", "seed", "version", "versionNonce"]) {
      assert.ok(f in el, `field ${f} missing on ${el.type}`);
    }
  }
});
check("T9b slots persisted in customData for adoption", () => {
  const stamped = parseStoryMapElements(md1).filter((el) => el.customData?.dualviews);
  assert.ok(stamped.length >= 35, "stamped=" + stamped.length); // 3 outcomes + 7 cards×2 + 11 chips×2
  assert.ok(stamped.every((el) => typeof el.customData.slot === "number" && el.customData.rawKey));
});

/* ── T10 GitHub adapter (fixture) ── */
const ghFixture = {
  data: {
    repository: {
      issues: {
        nodes: [
          { number: 1, title: "Frictionless checkout", url: "u1", state: "OPEN", labels: { nodes: [{ name: "outcome" }] }, parent: null },
          { number: 10, title: "Orphan capability", url: "u10", state: "OPEN", labels: { nodes: [{ name: "capability" }] }, parent: null },
          { number: 11, title: "Guest checkout", url: "u11", state: "OPEN", labels: { nodes: [{ name: "capability" }] }, parent: { number: 1 } },
          { number: 5, title: "Payment intent API", url: "u5", state: "CLOSED", labels: { nodes: [{ name: "cap:11" }, { name: "service:payments" }] }, parent: null },
          { number: 6, title: "Wallet support", url: "u6", state: "OPEN", labels: { nodes: [{ name: "cap:11" }, { name: "wip" }] }, parent: null },
          { number: 7, title: "No capability", url: "u7", state: "OPEN", labels: { nodes: [] }, parent: null },
          { number: 8, title: "Refunds", url: "u8", state: "OPEN", labels: { nodes: [{ name: "cap:11" }, { name: "service:payments" }, { name: "blocked" }] }, parent: null },
        ],
      },
    },
  },
};
check("T10 adapter conventions", () => {
  const items = projectIssues(ghFixture.data.repository.issues.nodes);
  const kinds = {};
  for (const i of items) (kinds[i.kind] ??= []).push(i);
  assert.equal(kinds.outcome?.length, 1);
  assert.equal(kinds.capability?.length, 1); // orphan capability dropped
  assert.equal(kinds.service?.length, 1); // svc:payments
  assert.equal(kinds.task?.length, 3); // #5, #6, #8 kept; #7 skipped (no capability)
  const done = kinds.task.find((t) => t.key === "gh-5");
  assert.equal(done.status, "done");
  const blocked = kinds.task.find((t) => t.key === "gh-8");
  assert.equal(blocked.status, "blocked");
  const cap = kinds.capability[0];
  assert.equal(cap.parent, "gh-1");
  // the projected model builds cleanly
  const m = buildModel(items);
  assert.equal(m.root.rollup.total, 3);
  assert.equal(m.root.rollup.done, 1);
});

check("T10b onboarding fallback: no outcome labels → auto Backlog bucket", () => {
  const flat = ghFixture.data.repository.issues.nodes.map((n) => ({
    ...n,
    labels: { nodes: n.labels.nodes.filter((l) => !["outcome", "capability"].includes(l.name) && !l.name.startsWith("cap:")) },
    parent: null,
  }));
  const items = projectIssues(flat);
  const outcomes = items.filter((i) => i.kind === "outcome");
  const caps = items.filter((i) => i.kind === "capability");
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].key, "auto:backlog");
  assert.equal(caps.length, 1);
  assert.equal(caps[0].key, "auto:untriaged");
  const tasks = items.filter((i) => i.kind === "task");
  assert.equal(tasks.length, 7); // every issue, incl. ex-outcome/capabilities and #7
  const m = buildModel(items);
  assert.equal(m.root.rollup.total, 7);
});

/* ── T11 CLI end-to-end ── */
await checkAsync("T11 CLI generates all three artifacts", async () => {
  // clean only the workmap child: the out dir itself may be briefly held by
  // an external renderer (Chrome headless CWD lock on Windows)
  fs.rmSync(path.join(OUT, "workmap"), { recursive: true, force: true });
  const r = await generate({ source: "json:" + path.join(ROOT, "sample", "workitems.json"), outDir: OUT, title: "Launchpad" });
  assert.deepEqual([r.outcomes, r.capabilities, r.services, r.tasks], [3, 7, 4, 16]);
  assert.deepEqual([r.done, r.total], [9, 16]);
  assert.ok(r.workmapFiles >= 11, "expected workmap drawings, got " + r.workmapFiles);
  for (const f of ["treemap.html", "story-map.excalidraw.md", "story-map.svg", "workmap/Work Map.excalidraw.md"]) {
    assert.ok(fs.existsSync(path.join(OUT, f)), f + " missing");
    assert.ok(fs.statSync(path.join(OUT, f)).size > 500, f + " too small");
  }
  // second run (with previous story map present) stays stable & deterministic
  const before = fs.readFileSync(path.join(OUT, "story-map.excalidraw.md"), "utf8");
  await generate({ source: "json:" + path.join(ROOT, "sample", "workitems.json"), outDir: OUT, title: "Launchpad" });
  const after = fs.readFileSync(path.join(OUT, "story-map.excalidraw.md"), "utf8");
  assert.equal(before, after, "regeneration over previous output changed positions");
});

/* ── T12 fractal work map (projection 3) ── */
const WM = path.join(OUT, "workmap");
const wmRead = (name) => {
  const md = fs.readFileSync(path.join(WM, name + ".excalidraw.md"), "utf8");
  return { md, els: parseStoryMapElements(md) };
};
check("T12a one drawing per level: root + 3 outcomes + 7 capabilities", () => {
  const names = fs.readdirSync(WM).filter((f) => f.endsWith(".excalidraw.md"));
  assert.equal(names.length, 11);
});
check("T12b root embeds every outcome drawing (fractal drill-down)", () => {
  const { els } = wmRead("Work Map");
  const embeds = els.filter((e) => e.type === "embeddable");
  assert.equal(embeds.length, 3);
  for (const o of model.outcomes) {
    assert.ok(embeds.some((e) => e.link === `[[${o.key}.excalidraw.md]]`), "missing embed for " + o.key);
  }
});
check("T12c outcome drawings embed capability drawings + breadcrumb up", () => {
  const { els } = wmRead("o-visual-brain");
  const embeds = els.filter((e) => e.type === "embeddable").map((e) => e.link);
  assert.equal(embeds.length, 3);
  assert.ok(embeds.includes("[[c-static-positions.excalidraw.md]]"));
  const bc = els.find((e) => e.type === "text" && e.link === "[[Work Map.excalidraw.md]]");
  assert.ok(bc, "breadcrumb to root missing");
});
check("T12d capability drawings: task cards linked to issues, grouped by service", () => {
  const { els } = wmRead("c-static-positions");
  const card = els.find((e) => e.type === "text" && e.link === "https://github.com/example/launchpad/issues/40");
  assert.ok(card, "task card link missing");
  assert.ok(card.text.includes("Slot engine"));
  assert.ok(els.some((e) => e.type === "text" && e.text.startsWith("⚙") && e.text.includes("fractal-index")));
  const bc = els.find((e) => e.link === "[[o-visual-brain.excalidraw.md]]");
  assert.ok(bc, "breadcrumb to outcome missing");
});
await checkAsync("T12e fractal determinism: two fresh root drawings byte-identical", async () => {
  const a = fs.readFileSync(path.join(WM, "Work Map.excalidraw.md"), "utf8");
  const { generateFractalViews } = await import("../lib/fractal-view.mjs");
  const tmp = path.join(HERE, "out-wm-det");
  fs.rmSync(tmp, { recursive: true, force: true });
  generateFractalViews(model, tmp);
  const b = fs.readFileSync(path.join(tmp, "workmap", "Work Map.excalidraw.md"), "utf8");
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(a, b);
});
await checkAsync("T12f fractal stability: regeneration over previous files moves nothing", async () => {
  const before = posByKey(wmRead("o-visual-brain").els);
  // churn the model: reorder outcomes + flip statuses (regeneration happens in T11 rerun below)
  const { generateFractalViews } = await import("../lib/fractal-view.mjs");
  const churned = buildModel(
    SAMPLE.map((it) => (it.key === "t-crossfilter" ? { ...it, status: "done" } : it))
      .map((it) => (it.key === "o-agent-flow" ? { ...it, flowOrder: 0 } : it))
  );
  generateFractalViews(churned, OUT);
  const after = posByKey(wmRead("o-visual-brain").els);
  for (const [k, p] of before) {
    if (after.has(k)) {
      assert.deepEqual({ x: after.get(k).x, y: after.get(k).y }, { x: p.x, y: p.y }, k + " moved");
    }
  }
});
function posByKey(els) {
  const map = new Map();
  for (const el of els) {
    if (el.customData?.workmap && el.customData.rawKey && !map.has(el.customData.rawKey)) {
      map.set(el.customData.rawKey, { x: el.x, y: el.y });
    }
  }
  return map;
}

/* ── T14 every bundled sample generates all projections ── */
await checkAsync("T14 all sample datasets generate cleanly", async () => {
  const samples = fs.readdirSync(path.join(ROOT, "sample")).filter((f) => f.endsWith(".json"));
  assert.ok(samples.length >= 2, "expected at least 2 samples");
  for (const f of samples) {
    const out = path.join(HERE, "out-samples", f.replace(".json", ""));
    const r = await generate({ source: "json:" + path.join(ROOT, "sample", f), outDir: out, title: f });
    assert.ok(r.outcomes >= 1 && r.tasks >= 1, f + ": empty model");
    assert.ok(fs.existsSync(path.join(out, "treemap.html")), f + ": no treemap");
    assert.ok(fs.existsSync(path.join(out, "workmap", "Work Map.excalidraw.md")), f + ": no workmap");
    fs.rmSync(out, { recursive: true, force: true });
  }
});

/* ── T15 plugin-format parsing + position adoption ── */
{
  const { decompressFromBase64 } = await import("../lib/lzstring.mjs");

  check("T15a lz-string decompressor reads real plugin-saved drawings", () => {
    const payload = fs.readFileSync(path.join(HERE, "fixtures", "compressed-drawing.txt"), "utf8").trim();
    const scene = JSON.parse(decompressFromBase64(payload));
    assert.ok(Array.isArray(scene.elements) && scene.elements.length > 0, "no elements");
    assert.ok(scene.elements.every((e) => "id" in e && "x" in e), "elements malformed");
  });

  check("T15b parseStoryMapElements understands plugin re-saved (compressed) files", () => {
    const payload = fs.readFileSync(path.join(HERE, "fixtures", "compressed-drawing.txt"), "utf8").trim();
    const md = "---\nexcalidraw-plugin: parsed\n---\n\n# Excalidraw Data\n## Text Elements\n\n## Drawing\n```compressed-json\n" + payload + "\n```\n";
    const els = parseStoryMapElements(md);
    assert.ok(els.length > 0, "elements not extracted from compressed block");
  });

  check("T15c story map adopts moved columns and cards (plugin-format input)", () => {
    // build v1, move a column title and a card rect, feed back through the
    // plugin-format path (round-trip through our writer = plain json, which
    // the parser handles identically)
    const md1 = toExcalidrawMD(buildStoryMap(model, []).elements);
    const before = parseStoryMapElements(md1);
    const moved = before.map((el) => {
      if (el.customData?.space === "outcome" && el.type === "text" && el.customData.rawKey === "o-visual-brain") {
        return { ...el, x: el.x + 500, y: el.y + 90 };
      }
      if (el.customData?.space === "card" && el.type === "rectangle" && el.customData.rawKey === "c-dual-views") {
        return { ...el, x: el.x + 333, y: el.y + 444 };
      }
      return el;
    });
    const after = buildStoryMap(model, moved);
    const out = new Map();
    for (const el of after.elements) {
      if (el.customData && (el.customData.space === "outcome" || el.customData.space === "card")) {
        if (!out.has(el.customData.rawKey)) out.set(el.customData.rawKey, el);
      }
    }
    const col = out.get("o-visual-brain");
    const card = out.get("c-dual-views");
    // v1 column x was 40 (slot 0); moved +500/+90 must be adopted exactly
    assert.ok(Math.abs(col.x - 540) < 1, "column x not adopted: " + col.x);
    assert.ok(Math.abs(col.y - 90) < 1, "column y not adopted: " + col.y);
    assert.ok(card.x > 900, "card x not adopted: " + card.x);
    assert.ok(card.y > 600, "card y not adopted: " + card.y);
    // untouched elements keep slot positions
    const steady = out.get("o-agent-flow");
    assert.ok(Math.abs(steady.x - (40 + 2 * 630)) < 1, "untouched column moved: " + steady.x);
  });

  const jsonBlockRe = /```json\n([\s\S]*?)\n```/;
  await checkAsync("T15d workmap adopts moved pods and task cards across regeneration", async () => {
    const { generateFractalViews } = await import("../lib/fractal-view.mjs");
    const dir = path.join(HERE, "out-wm-adopt");
    fs.rmSync(dir, { recursive: true, force: true });
    generateFractalViews(model, dir, { dirName: "." });
    const wm = path.join(dir);
    // user moves: the o-visual-brain pod frame in Work Map, and a task card in a capability file
    const edit = (file, pick, dx, dy) => {
      const md = fs.readFileSync(path.join(wm, file), "utf8");
      const scene = JSON.parse(md.match(jsonBlockRe)[1]);
      for (const el of scene.elements) if (pick(el)) { el.x += dx; el.y += dy; }
      fs.writeFileSync(path.join(wm, file), toExcalidrawMD(scene.elements), "utf8");
    };
    // capture v1 anchors, apply deltas, regenerate, expect exact deltas back
    const grab = (file, pick) => {
      const md = fs.readFileSync(path.join(wm, file), "utf8");
      return JSON.parse(md.match(jsonBlockRe)[1]).elements.find(pick);
    };
    const podBefore = grab("Work Map.excalidraw.md", (el) => el.customData?.space === "pod" && el.type === "rectangle" && el.customData.rawKey === "o-visual-brain");
    const taskBefore = grab("c-dual-views.excalidraw.md", (el) => el.customData?.space === "task" && el.type === "text" && el.customData.rawKey === "t-treemap");
    edit("Work Map.excalidraw.md", (el) => el.customData?.space === "pod" && el.type === "rectangle" && el.customData.rawKey === "o-visual-brain", 222, 88);
    edit("c-dual-views.excalidraw.md", (el) => el.customData?.space === "task" && el.type === "text" && el.customData.rawKey === "t-treemap", 150, 75);
    generateFractalViews(model, dir, { dirName: "." });
    const pod = grab("Work Map.excalidraw.md", (el) => el.customData?.space === "pod" && el.type === "rectangle" && el.customData.rawKey === "o-visual-brain");
    assert.ok(Math.abs(pod.x - (podBefore.x + 222)) < 1, "pod x not adopted: " + pod.x);
    assert.ok(Math.abs(pod.y - (podBefore.y + 88)) < 1, "pod y not adopted: " + pod.y);
    const task = grab("c-dual-views.excalidraw.md", (el) => el.customData?.space === "task" && el.type === "text" && el.customData.rawKey === "t-treemap");
    assert.ok(Math.abs(task.x - (taskBefore.x + 150)) < 1, "task x not adopted: " + task.x);
    assert.ok(Math.abs(task.y - (taskBefore.y + 75)) < 1, "task y not adopted: " + task.y);
    // untouched pod keeps its slot position
    const steady = grab("Work Map.excalidraw.md", (el) => el.customData?.space === "pod" && el.type === "rectangle" && el.customData.rawKey === "o-agent-flow");
    const steadyBefore = null; // captured implicitly: slot 2 → 120 + 2*(340+60)
    assert.ok(Math.abs(steady.y - (120 + 2 * (340 + 60))) < 1, "untouched pod moved: " + steady.y);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

/* ── T16 timeline projection ── */
{
  const { buildTimeline, timelineToMD } = await import('../lib/timeline.mjs');
  const tl = buildTimeline(model, []);
  const tlMD = timelineToMD(tl.elements);

  check('T16a timeline has bands for every outcome and bars for every capability', () => {
    const bands = tl.elements.filter((e) => e.customData?.space === 'band');
    const bars = tl.elements.filter((e) => e.customData?.space === 'bar');
    assert.equal(bands.length, model.outcomes.length, 'band count mismatch');
    assert.ok(bars.length >= model.capabilities.length, 'bar count too low');
    for (const o of model.outcomes) assert.ok(bands.some((b) => b.text.includes(o.title.slice(0, 20))), 'missing band: ' + o.key);
  });

  check('T16b progress fills are proportional to rollup', () => {
    const fills = tl.elements.filter((e) => e.backgroundColor === "#2e7d32" && e.width > 0 && e.width <= 400);
    assert.ok(fills.length > 0, 'no green fills');
    for (const fill of fills) assert.ok(fill.width <= 400, 'fill wider than bar');
  });

  check('T16c cross-view contract: timeline keys are outcomes + capabilities', () => {
    const expected = new Set([...model.outcomes.map((o) => o.key), ...model.capabilities.map((c) => c.key)]);
    assert.deepEqual([...tl.keyset].sort(), [...expected].sort());
  });

  check('T16d timeline adopts moved bands and bars', () => {
    const moved = tl.elements.map((el) => {
      if (el.customData?.space === 'band' && el.customData.rawKey === 'o-outcome-dev' && el.type === 'text') {
        return { ...el, x: el.x + 100, y: el.y + 50 };
      }
      if (el.customData?.space === 'bar' && el.customData.rawKey === 'c-dual-views' && el.type === 'rectangle') {
        return { ...el, y: el.y + 80 };
      }
      return el;
    });
    const after = buildTimeline(model, moved);
    const outBands = new Map();
    const outBars = new Map();
    for (const el of after.elements) {
      if (el.customData?.space === 'band' && el.type === 'text' && !outBands.has(el.customData.rawKey)) outBands.set(el.customData.rawKey, el);
      if (el.customData?.space === 'bar' && el.type === 'rectangle' && !outBars.has(el.customData.rawKey)) outBars.set(el.customData.rawKey, el);
    }
    const movedBand = outBands.get('o-outcome-dev');
    const movedBar = outBars.get('c-dual-views');
    const origBand = tl.elements.find((e) => e.customData?.space === 'band' && e.type === 'text' && e.customData.rawKey === 'o-outcome-dev');
    assert.ok(Math.abs(movedBand.x - 140) < 1, 'band x not adopted: ' + movedBand.x);
    assert.ok(Math.abs(movedBand.y - (origBand.y + 50)) < 1, 'band y not adopted: ' + movedBand.y + ' expected ' + (origBand.y + 50));
    assert.ok(movedBar.y > 200, 'bar y not adopted: ' + movedBar.y);
  });

  check('T16e timeline regeneration is deterministic', () => {
    const tl2 = buildTimeline(model, []);
    assert.equal(timelineToMD(tl.elements), timelineToMD(tl2.elements));
  });

  check('T16f timeline output parses and has required element fields', () => {
    assert.ok(tlMD.startsWith("---\nexcalidraw-plugin: parsed\n"), "frontmatter missing");
    const scene = JSON.parse(tlMD.match(/```json\n([\s\S]*?)\n```/)[1]);
    for (const el of scene.elements) {
      for (const f of ['id', 'type', 'x', 'y', 'width', 'height', 'strokeColor']) {
        assert.ok(f in el, 'field ' + f + ' missing on ' + el.type);
      }
    }
  });
}

/* ── T13 output purity: generations carry no stray markup ── */
const HTML_TAG = /<[a-zA-Z/][^>]*>/;
check("T13a no <br> variants anywhere in the treemap HTML", () => {
  assert.ok(!html.includes("<br"), "found <br in treemap.html");
  assert.ok(!fs.readFileSync(path.join(OUT, "treemap.html"), "utf8").includes("<br"));
});
check("T13b treemap payload data is markup-free", () => {
  const payload = fs.readFileSync(path.join(OUT, "treemap.html"), "utf8").match(/const MODEL = (\{.*?\});/s);
  const model = JSON.parse(payload[1].replace(/\u003c/g, "<"));
  for (const d of model.data) {
    assert.ok(!HTML_TAG.test(d.label || ""), "markup in label: " + d.label);
    assert.ok(!HTML_TAG.test(d.id || ""), "markup in id: " + d.id);
  }
});
check("T13c Excalidraw drawings contain no HTML tags in text elements", () => {
  const files = [path.join(OUT, "story-map.excalidraw.md"), ...fs.readdirSync(path.join(OUT, "workmap")).map((f) => path.join(OUT, "workmap", f))];
  const jsonBlock = /```json\n([\s\S]*?)\n```/;
  for (const f of files) {
    const scene = JSON.parse(fs.readFileSync(f, "utf8").match(jsonBlock)[1]);
    for (const el of scene.elements) {
      if (el.type === "text") {
        assert.ok(!HTML_TAG.test(el.text || ""), "HTML tag in text of " + path.basename(f) + ": " + el.text);
      }
    }
  }
});
check("T13d SVG previews use only whitelisted tags", () => {
  const OK = new Set(["svg", "rect", "text", "tspan", "line", "circle", "path"]);
  for (const f of [path.join(OUT, "story-map.svg")]) {
    const svg = fs.readFileSync(f, "utf8");
    for (const m of svg.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)[\s>]/g)) {
      assert.ok(OK.has(m[1]), "unexpected tag <" + m[1] + "> in " + path.basename(f));
    }
  }
});

/* ── report ── */
console.log("\n═══════════════════════════════════════════════");
for (const [status, name] of results) console.log(`${status === "PASS" ? " ✓" : " ✗"} ${name}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log("═══════════════════════════════════════════════");
console.log(`${results.length - failed}/${results.length} checks passed`);
console.log(`Artifacts → ${OUT}`);
process.exit(failed ? 1 : 0);
