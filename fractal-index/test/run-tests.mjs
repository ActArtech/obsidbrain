// Fractal Index — practical test harness.
//
// Runs the REAL ea-script (extracted from ea-scripts/Fractal Index.md, compiled
// exactly like the plugin's ScriptEngine: new AsyncFunction("ea","utils", body))
// against a mock ExcalidrawAutomate + a real on-disk fixture vault.
//
// Scenarios:
//   T1 fresh generation (folder + sub-index creation)
//   T2 determinism (two fresh runs → identical layout)
//   T3 static positions under vault churn (add/delete/move + folder rename)
//   T4 fractal recursion across levels (root → Areas → Projects)
//   T5 serialized .excalidraw.md is structurally valid

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import assert from "node:assert/strict";
import { createMockEA } from "./mock-ea.mjs";
import { MockVault, TFile, TFolder, createMockApp, mountGlobals, unmountGlobals } from "./mock-vault.mjs";
import { toExcalidrawMD, toSVG, sceneElements } from "./serialize.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SCRIPT = fs.readFileSync(path.join(HERE, "..", "ea-scripts", "Fractal Index.md"), "utf8");
const FIXTURE = path.join(HERE, "fixture-vault");
const TMP = path.join(HERE, "tmp-vault");
const OUT = path.join(HERE, "out");
fs.rmSync(TMP, { recursive: true, force: true });
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(FIXTURE, TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

/* compile the script exactly like ScriptEngine.compileScript() */
function stripYamlFrontmatter(src) {
  return src.replace(/^---\n[\s\S]*?\n---\n/, "");
}
const AsyncFunction = (async () => {}).constructor;
const compiled = new AsyncFunction("ea", "utils", stripYamlFrontmatter(SCRIPT));

function makeUtils(suggesterChoice) {
  // accept a single answer or a queue: [scope, drawLinks]
  const queue = Array.isArray(suggesterChoice) ? [...suggesterChoice] : [suggesterChoice];
  return {
    suggester: async (display, items) => queue.length > 1 ? queue.shift() : queue[0],
    inputPrompt: async () => "",
    scriptFile: null,
    executionSource: "test",
  };
}

/* run the script "inside" a given index drawing file */
async function runScript(app, ea, indexPath, choice = ["self+create", false]) {
  const queue = typeof choice === "string" ? [choice, false] : choice;
  const file = app.vault.getAbstractFileByPath(indexPath);
  assert.ok(file, "index drawing must exist: " + indexPath);
  ea.targetView = { file, _loaded: true };
  ea._buffer.clear();
  await compiled(ea, makeUtils(queue));
}

const results = [];
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ' — ' + e.message]);
    process.exitCode = 1;
  }
}
function check(name, fn) {
  try {
    fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name + " — " + e.message]);
    process.exitCode = 1;
  }
}

/* node signature = layout identity: type + text/link + geometry */
function signature(ea) {
  return sceneElements(ea)
    .map((el) => [el.type, el.text || el.link || el.name || "", Math.round(el.x), Math.round(el.y), Math.round(el.width), Math.round(el.height)].join("|"))
    .sort()
    .join("\n");
}
function nodeByPath(ea, p) {
  return sceneElements(ea).find((el) => el.customData?.key === "file|" + p || el.customData?.key === "pod|" + p + "|label");
}
const pos = (el) => ({ x: Math.round(el.x), y: Math.round(el.y) });

/* ─────────────────────────── T1: fresh generation ─────────────────────── */
const app1 = createMockApp(TMP);
mountGlobals(app1);
const ea1 = createMockEA();
await runScript(app1, ea1, "Brain/_index.excalidraw.md");

const brainEls = sceneElements(ea1);
const fileCards = brainEls.filter((el) => el.customData?.kind === "file");
const podLabels = brainEls.filter((el) => el.customData?.kind === "pod-label");
const embeds = brainEls.filter((el) => el.customData?.kind === "embed");

check("T1a root index has a file card for README.md", () => {
  assert.equal(fileCards.filter((el) => el.customData.basename === "README.md").length, 1);
});
check("T1b three subfolder pods (Areas, Notes, attachments)", () => {
  assert.deepEqual(podLabels.map((el) => el.customData.basename).sort(), ["Areas", "Notes", "attachments"]);
});
check("T1c 'create sub-indexes' created 3 _index drawings on disk", () => {
  for (const p of ["Brain/Areas/_index.excalidraw.md", "Brain/Notes/_index.excalidraw.md", "Brain/attachments/_index.excalidraw.md"]) {
    assert.ok(fs.existsSync(path.join(TMP, p)), "missing " + p);
  }
});
check("T1d every pod embeds its sub-index drawing (fractal preview)", () => {
  assert.equal(embeds.length, 3);
  assert.ok(embeds.every((el) => /^\[\[Brain\/.+\/_index\.excalidraw\.md\]\]$/.test(el.link || "")));
});
check("T1e file cards carry wiki links to their files", () => {
  const readme = fileCards.find((el) => el.customData.basename === "README.md");
  assert.equal(readme.link, "[[Brain/README.md]]");
});
check("T1f no duplicate element ids in scene", () => {
  const ids = brainEls.map((el) => el.id);
  assert.equal(new Set(ids).size, ids.length);
});
unmountGlobals();

/* ─────────────────────────── T2: determinism ──────────────────────────── */
const app2 = createMockApp(TMP);
mountGlobals(app2);
const ea2a = createMockEA();
await runScript(app2, ea2a, "Brain/_index.excalidraw.md");
const ea2b = createMockEA();
await runScript(app2, ea2b, "Brain/_index.excalidraw.md");
check("T2 two independent fresh runs produce identical layouts", () => {
  assert.equal(signature(ea2a), signature(ea2b));
});
unmountGlobals();

/* ─────────────────── T3: static positions under churn ─────────────────── */
const app3 = createMockApp(TMP);
mountGlobals(app3);

// 3.1: generate Areas level (2 files: Health.md, Finance.md)
const eaA = createMockEA();
await runScript(app3, eaA, "Brain/Areas/_index.excalidraw.md");
const health1 = pos(nodeByPath(eaA, "Brain/Areas/Health.md"));
const finance1 = pos(nodeByPath(eaA, "Brain/Areas/Finance.md"));

// 3.2: churn — new file, deleted file, moved file (same basename), folder rename
fs.writeFileSync(path.join(TMP, "Brain/Areas/Insurance.md"), "new");
fs.rmSync(path.join(TMP, "Brain/Areas/Health.md"));
fs.mkdirSync(path.join(TMP, "Brain/Areas/Archive"), { recursive: true });
fs.copyFileSync(path.join(TMP, "Brain/Notes/Idea - static graphs.md"), path.join(TMP, "Brain/Areas/Idea - static graphs.md"));
fs.renameSync(path.join(TMP, "Brain/Areas"), path.join(TMP, "Brain/Zones"));
fs.renameSync(path.join(TMP, "Brain/Zones/_index.excalidraw.md"), path.join(TMP, "Brain/Zones/_index-moved.excalidraw.md"));
fs.renameSync(path.join(TMP, "Brain/Zones/_index-moved.excalidraw.md"), path.join(TMP, "Brain/Zones/_index.excalidraw.md"));

await runScript(app3, eaA, "Brain/Zones/_index.excalidraw.md");
const zonesEls = sceneElements(eaA);
const byKey = (k) => zonesEls.find((el) => el.customData?.key === k);

check("T3a folder renamed Areas→Zones: Finance.md node did NOT move", () => {
  const f = byKey("file|Brain/Zones/Finance.md");
  assert.ok(f, "Finance node missing after rename");
  assert.deepEqual(pos(f), finance1);
});
check("T3b moved-in file (no prior history in this index) got a fresh slot", () => {
  const n = byKey("file|Brain/Zones/Idea - static graphs.md");
  assert.ok(n);
  // pods and files have separate slot spaces; Finance adopted file-slot 1, so Idea is fresh slot 2
  assert.equal(n.customData.slot, 2, "expected fresh file slot 2, got " + n.customData.slot);
});
check("T3c deleted file (Health.md) is gone from the scene", () => {
  assert.ok(!zonesEls.some((el) => el.customData?.key === "file|Brain/Areas/Health.md" || el.customData?.key === "file|Brain/Zones/Health.md"));
});
check("T3d new file (Insurance.md) got a slot but existing nodes kept theirs", () => {
  const i = byKey("file|Brain/Zones/Insurance.md");
  const f = byKey("file|Brain/Zones/Finance.md");
  assert.ok(i, "Insurance node missing");
  assert.deepEqual(pos(f), finance1);
  assert.equal(i.customData.slot, 3, "expected fresh file slot 3, got " + i.customData.slot);
});
function deepEqualPos(a, b) { return a.x === b.x && a.y === b.y; }

// 3.3: seed a Brain-level scene with previous state, then churn at Brain level
const eaB = createMockEA();
eaB._scene = new Map(ea1._scene); // pretend Brain index was saved before
fs.writeFileSync(path.join(TMP, "Brain/Morning Pages.md"), "new note");
await runScript(app3, eaB, "Brain/_index.excalidraw.md");
const brainEls2 = sceneElements(eaB);
const zonesPod = brainEls2.find((el) => el.customData?.key === "pod|Brain/Zones|label");
const notesPodBefore = brainEls.find((el) => el.customData?.key === "pod|Brain/Notes|label");
const notesPodAfter = brainEls2.find((el) => el.customData?.key === "pod|Brain/Notes|label");
check("T3f untouched pods (Notes) kept exact positions; renamed pod present", () => {
  assert.ok(notesPodBefore && notesPodAfter && zonesPod, "pods missing");
  assert.deepEqual(pos(notesPodAfter), pos(notesPodBefore));
});
check("T3g new note appended without moving the README card", () => {
  const r1 = pos(brainEls.find((el) => el.customData?.key === "file|Brain/README.md"));
  const r2 = pos(brainEls2.find((el) => el.customData?.key === "file|Brain/README.md"));
  assert.deepEqual(r1, r2);
  assert.ok(brainEls2.some((el) => el.customData?.key === "file|Brain/Morning Pages.md"));
});

check("T3h TD file grid starts to the right of pods", () => {
  const r = brainEls2.find((el) => el.customData?.key === "file|Brain/README.md");
  assert.ok(Math.abs(r.x - 480) < 1, "files start at x=480, got " + r.x);
});
unmountGlobals();

/* ─────────────────────── T4: fractal recursion ────────────────────────── */
const app4 = createMockApp(TMP);
mountGlobals(app4);
const eaP = createMockEA();
await runScript(app4, eaP, "Brain/Zones/Projects/_index.excalidraw.md", "self+create");
check("T4a deepest level (Projects) generated with file cards", () => {
  const els = sceneElements(eaP);
  assert.ok(els.some((el) => el.customData?.basename === "Website Redesign.md"));
  assert.ok(els.some((el) => el.customData?.basename === "Launchpad.md"));
});
check("T4b breadcrumb link appears when parent index exists", () => {
  assert.ok(sceneElements(eaP).some((el) => el.customData?.kind === "breadcrumb" && /Zones/.test(el.link || el.text || "")));
});
unmountGlobals();

/* ─────────────────────── T5: artifact validation ──────────────────────── */
const md = toExcalidrawMD(eaB, "Brain");
const svg = toSVG(eaB);
fs.writeFileSync(path.join(OUT, "Brain _index.excalidraw.md"), md);
fs.writeFileSync(path.join(OUT, "Areas _index.excalidraw.md"), toExcalidrawMD(eaA, "Areas"));
fs.writeFileSync(path.join(OUT, "preview.svg"), svg);

check("T5a .excalidraw.md has plugin frontmatter + sections", () => {
  assert.match(md, /^---\nexcalidraw-plugin: parsed\n/);
  assert.match(md, /# Excalidraw Data\n## Text Elements\n[\s\S]*\n## Drawing\n```json\n/);
});
check("T5b embedded scene JSON parses and elements are well-formed", () => {
  const json = md.match(/```json\n([\s\S]*?)\n```/)[1];
  const scene = JSON.parse(json);
  assert.ok(Array.isArray(scene.elements) && scene.elements.length > 10);
  for (const el of scene.elements) {
    for (const f of ["id", "type", "x", "y", "width", "height", "strokeColor", "seed", "version", "versionNonce"])
      assert.ok(f in el, `field ${f} missing on ${el.type}`);
  }
  const texts = scene.elements.filter((el) => el.type === "text");
  assert.ok(texts.every((t) => "fontSize" in t && "fontFamily" in t && "originalText" in t));
});
check("T5c SVG preview contains the expected labels", () => {
  for (const label of ["Brain", "Zones", "Notes", "attachments", "README"])
    assert.ok(svg.includes(label), "SVG missing " + label);
});

/* === T21/T22 ExcaliBrain dimension: note-link arrows === */
{
  // fresh demo folder: A.md <-> B.md mutual, A -> sub/S.md, sub/S.md -> B.md
  fs.mkdirSync(path.join(TMP, "LinksDemo/sub"), { recursive: true });
  fs.mkdirSync(path.join(TMP, "LinksDemo/sub3"), { recursive: true });
  fs.mkdirSync(path.join(TMP, "LinksDemo/sub4"), { recursive: true });
  fs.writeFileSync(path.join(TMP, "LinksDemo/sub3/S3.md"), "# S3");
  fs.writeFileSync(path.join(TMP, "LinksDemo/sub4/S4.md"), "# S4");
  fs.mkdirSync(path.join(TMP, "LinksDemo/sub2"), { recursive: true });
  fs.writeFileSync(path.join(TMP, "LinksDemo/sub2/S2.md"), "[[../sub/S]] cross-folder dependency");
  fs.writeFileSync(path.join(TMP, "LinksDemo/A.md"), "[[B]] [[sub/S]]");
  fs.writeFileSync(path.join(TMP, "LinksDemo/B.md"), "[[A]]");
  fs.writeFileSync(path.join(TMP, "LinksDemo/sub/S.md"), "[[../B]]");
  const tpl = fs.readFileSync(path.join(FIXTURE, "Brain/_index.excalidraw.md"), "utf8");
  fs.writeFileSync(path.join(TMP, "LinksDemo/_index.excalidraw.md"), tpl);
  const appL = createMockApp(TMP);
  mountGlobals(appL);
  appL.metadataCache.resolvedLinks = {
    "LinksDemo/A.md": { "LinksDemo/B.md": 1, "LinksDemo/sub/S.md": 1 },
    "LinksDemo/B.md": { "LinksDemo/A.md": 1 },
    "LinksDemo/sub/S.md": { "LinksDemo/B.md": 1 },
    "LinksDemo/sub2/S2.md": { "LinksDemo/sub/S.md": 1 },
  };
  const eaL = createMockEA();
  await runScript(appL, eaL, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
  const links = sceneElements(eaL).filter((el) => el.customData?.kind === "link");

  check("T21a mutual A<->B collapsed into ONE double-headed arrow", () => {
    const ab = links.filter((l) =>
      (l.customData.key === "link|LinksDemo/A.md=>LinksDemo/B.md" || l.customData.key === "link|LinksDemo/B.md=>LinksDemo/A.md"));
    assert.equal(ab.length, 1, "expected 1 arrow, got " + ab.length);
    assert.equal(ab[0].startArrowhead, "arrow");
    assert.equal(ab[0].endArrowhead, "arrow");
  });
  check("T21b file -> subfolder edge drawn as card -> pod arrow", () => {
    assert.ok(links.some((l) => l.customData.key === "link|LinksDemo/A.md=>LinksDemo/sub/"));
  });
  check("T21c subfolder -> file edge drawn (cross-level relationship)", () => {
    assert.ok(links.some((l) => l.customData.key === "link|LinksDemo/sub/=>LinksDemo/B.md"));
  });
  check("T21g pod -> pod edge drawn (cross-folder dependency)", () => {
    assert.ok(links.some((l) => l.customData.key === "link|LinksDemo/sub2/=>LinksDemo/sub/"), "pod-to-pod edge missing");
  });
  check("T21d arrow endpoints sit on card/pod boundaries (no center-to-center)", () => {
    const cards = new Map(sceneElements(eaL).filter((el) => el.customData?.kind === "file")
      .map((el) => [el.customData.basename, { x: el.x - 10, y: el.y - 10, w: el.width + 20, h: el.height + 20 }]));
    const a = cards.get("A.md"), b = cards.get("B.md");
    const arrow = links.find((l) => l.customData.key.includes("A.md=>LinksDemo/B.md") || l.customData.key === "link|LinksDemo/B.md=>LinksDemo/A.md");
    assert.ok(a && b && arrow, "geometry missing");
    // start point must be ON A's boundary (within tolerance), not at its center
    const onEdge = (p, r) => Math.abs(p.x - r.x) < 2 || Math.abs(p.x - (r.x + r.w)) < 2 || Math.abs(p.y - r.y) < 2 || Math.abs(p.y - (r.y + r.h)) < 2;
    assert.ok(onEdge({ x: arrow.points[0][0], y: arrow.points[0][1] }, a), "start not on A boundary");
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    assert.ok(Math.hypot(arrow.points[0][0] - cx, arrow.points[0][1] - cy) > a.w / 4, "start too close to center");
  });
  check("T21e purity holds with links enabled (no markup introduced)", () => {
    for (const el of sceneElements(eaL)) {
      if (el.type === "text") assert.ok(!/<[a-zA-Z\/][^>]*>/.test(el.text || ""), "markup leaked: " + el.text);
    }
  });

  // T22: link regeneration is deterministic and does not move cards
  const sig1 = signature(eaL);
  const posBefore = sceneElements(eaL).filter((el) => el.customData?.kind === "file")
    .map((el) => [el.customData.key, Math.round(el.x), Math.round(el.y)]);
  const eaL2 = createMockEA();
  eaL2._scene = new Map(eaL._scene);
  appL.metadataCache.resolvedLinks["LinksDemo/A.md"]["LinksDemo/B.md"] = 3; // weight change
  await runScript(appL, eaL2, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
  const posAfter = sceneElements(eaL2).filter((el) => el.customData?.kind === "file")
    .map((el) => [el.customData.key, Math.round(el.x), Math.round(el.y)]);
  check("T22 link weight changes do not move cards and keep arrow count stable", () => {
    assert.deepEqual(posAfter, posBefore);
    const links2 = sceneElements(eaL2).filter((el) => el.customData?.kind === "link");
    assert.equal(links2.length, links.length);
  });
  unmountGlobals();
}

/* === T24/T25 dive interaction + fractal visuals === */
{
  // T24: every pod carries the recursion motif and the dive affordance
  const els24 = brainEls2 !== undefined ? brainEls2 : sceneElements(ea1);
  const vis = sceneElements(ea1).concat(brainEls2 || []);
  check("T24 pods have concentric motifs and dive-hint chips", () => {
    const pods = vis.filter((el) => el.customData?.kind === "pod-label");
    const motifs = vis.filter((el) => el.customData?.kind === "pod-motif");
    const dives = vis.filter((el) => el.customData?.kind === "dive-hint");
    assert.ok(pods.length >= 6, "expected pods, got " + pods.length);
    assert.equal(motifs.length, pods.length, "one motif per pod");
    assert.equal(dives.length, pods.length, "one dive chip per pod");
    assert.ok(dives.every((d) => d.text.includes("dive")), "chip text");
    assert.ok(motifs.every((m) => m.strokeStyle === "dashed"), "motif dashed");
  });

  // T25: Fractal Navigate hook — dive, surface, native, escape hatch
  const NAV = fs.readFileSync(path.join(HERE, "..", "ea-scripts", "Fractal Navigate.md"), "utf8");
  const stripFm = (src) => src.replace(/^---\n[\s\S]*?\n---\n/, "");
  check("T25a navigate script compiles", () => {
    new Function("ea", "utils", "Notice", stripFm(NAV));
  });
  await checkAsync("T25b hook logic: dive → surface → native (unit via captured hook)", async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const NavEA = class {
      constructor() { this.onLinkClickHook = null; }
      verifyMinimumPluginVersion(min) { return true; }
    };
    const navEA = new NavEA();
    const calls = [];
    const view = {
      getViewElements: () => [
        { customData: { fractalIndex: true, key: "pod|Brain/Areas|embed", kind: "embed" }, isDeleted: false, id: "e1" },
        { customData: { fractalIndex: true, key: "pod|Brain/Areas|label", kind: "pod-label" }, isDeleted: false, id: "l1" },
        { customData: { fractalIndex: true, key: "file|Brain/README.md", kind: "file" }, isDeleted: false, id: "f1" },
      ],
      zoomToElementId: (id, grp) => calls.push(["dive", id, grp]),
      getExcalidrawAPI: () => ({ scrollToContent: (el, opts) => calls.push(["dive-scroll", el.id]) }),
      zoomToFit: () => calls.push(["surface"]),
    };
    const fn = new Function("ea", "utils", "Notice", "return " + wrapBody(NAV));
    fn(navEA, {}, function () {});
    const hook = navEA.onLinkClickHook;
    assert.ok(typeof hook === "function", "hook registered");
    const labelEl = view.getViewElements()[1];
    const fileEl = view.getViewElements()[2];
    // 1. dive: click pod label → scrollToContent on the EMBED, native cancelled
    assert.equal(hook(labelEl, "[[x]]", {}, view, navEA), false);
    await sleep(120); // the dive is deferred past the click handler
    assert.deepEqual(calls[0], ["dive", "e1", false]); // plugin zoomToElementId preferred
    // 2. surface: click the same pod again → zoomToFit, native cancelled
    assert.equal(hook(labelEl, "[[x]]", {}, view, navEA), false);
    await sleep(120); // surface is deferred too
    assert.equal(calls[1][0], "surface");
    // 3. native: file card click passes through
    assert.equal(hook(fileEl, "[[y]]", {}, view, navEA), true);
    assert.equal(calls.length, 2);
    // 4. escape hatch: ctrl+click on a pod stays native
    assert.equal(hook(labelEl, "[[x]]", { ctrlKey: true }, view, navEA), true);
    assert.equal(calls.length, 2);
    // 5. unknown element (no customData) → native
    assert.equal(hook({ customData: null }, "[[z]]", {}, view, navEA), true);
  });
  function wrapBody(mdSrc) {
    return "(function(){" + stripFm(mdSrc) + "})()";
  }
}

/* === T27 live arrow tracker (custom binding engine) === */
{
  const NAV2 = fs.readFileSync(path.join(HERE, "..", "ea-scripts", "Fractal Navigate.md"), "utf8");
  const strip2 = (src) => src.replace(/^---\n[\s\S]*?\n---\n/, "");
  await checkAsync("T27 tracker: re-anchors moved cards' arrows, converges, respects drag", async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    class NavEA { verifyMinimumPluginVersion(min) { return true; } }
    const navEA = new NavEA();
    const fn = new Function("ea", "utils", "Notice", "return (function(){" + strip2(NAV2) + "})()");
    fn(navEA, {}, function () {});
    const sceneHook = navEA.onSceneChangeHook;
    assert.ok(sceneHook && sceneHook.trackElements === true, "scene hook registered with trackElements");

    const mk = (id, key, kind, extra) => ({
      id, isDeleted: false, points: [[0, 0], [1, 1]], x: 0, y: 0, width: 1, height: 1,
      customData: { fractalIndex: true, key, kind },
      ...extra,
    });
    const elements = [
      mk("title", "title|LinksDemo", "title", { customData: { fractalIndex: true, kind: "title", direction: "LR" } }),
      mk("a", "file|LinksDemo/A.md", "file", { x: 500, y: 200, width: 100, height: 26 }),
      mk("b", "file|LinksDemo/B.md", "file", { x: 1000, y: 200, width: 100, height: 26 }),
      mk("lbl", "pod|LinksDemo/sub|label", "pod-label", { x: 20, y: 520, width: 200, height: 30 }),
      mk("lnk", "link|LinksDemo/A.md=>LinksDemo/B.md", "link", {}),
      mk("stub", "pod|LinksDemo/sub|arrow", "arrow", {}),
      mk("spine", "spine|LinksDemo", "spine", {}),
    ];
    const writes = [];
    const hookView = {
      excalidrawAPI: {
        updateScene: ({ elements }) => writes.push(elements),
      },
    };
    const fire = (els, selected = {}) => sceneHook.callback(els, { selectedElementIds: selected }, {}, hookView, {});
    const lastArrow = (id) => {
      const w = writes[writes.length - 1] || [];
      return w.find((e) => e.id === id) || null;
    };

    // 1. re-anchor: fire with stale arrows
    fire(elements);
    await sleep(300);
    assert.equal(writes.length, 1, "expected one flush, got " + writes.length);
    const lnk = lastArrow("lnk");
    const stub = lastArrow("stub");
    assert.ok(lnk, "link arrow not updated");
    const abs = (e) => (e.points || []).map((p) => [p[0] + e.x, p[1] + e.y]);
    const lp = abs(lnk);
    assert.ok(Math.abs(lp[0][0] - 610) < 1.5, "link start on A right edge (610), got " + lp[0][0]);
    assert.ok(Math.abs(lp[1][0] - 990) < 1.5, "link end on B left edge (990), got " + lp[1][0]);
    const sp = abs(stub);
    // LR layout: vertical stub at pod centerX, from the horizontal spine to pod top
    assert.ok(stub && Math.abs(sp[1][1] - 502) < 1.5, "stub drops to pod top (502), got " + (sp && sp[1] && sp[1][1]));
    assert.ok(Math.abs(sp[1][0] - 194) < 1.5, "stub at pod centerX (194), got " + (sp && sp[1] && sp[1][0]));
    assert.deepEqual(abs(lastArrow("spine")), [[0, 120], [194, 120]], "LR spine stays horizontal");

    // 2. convergence: fire again with the UPDATED arrows -> no further writes
    const updated = writes[0]; // the scene the tracker itself wrote
    fire(updated);
    await sleep(300);
    assert.equal(writes.length, 1, "tracker must be a no-op when endpoints unchanged (writes=" + writes.length + ")");

    // 3. hands off while the user drags that arrow (base = converged scene)
    const movedAgain = updated.map((e) => (e.id === "a" ? { ...e, x: 800, y: 900 } : e));
    fire(movedAgain, { lnk: true });
    await sleep(300);
    assert.equal(writes.length, 1, "must not rewrite an arrow the user is dragging");
    fire(movedAgain, {});
    await sleep(300);
    assert.equal(writes.length, 2, "re-anchors once the drag is over");
    const lnk2 = lastArrow("lnk");
    const p2 = abs(lnk2)[0]; // A rect = (790, 890, 120, 46)
    const onBoundary = Math.abs(p2[0] - 790) < 1.5 || Math.abs(p2[0] - 910) < 1.5 || Math.abs(p2[1] - 890) < 1.5 || Math.abs(p2[1] - 936) < 1.5;
    assert.ok(onBoundary, "re-anchored onto moved A boundary, got " + JSON.stringify(p2));
    const tdScene = writes[1].map((e) => e.id === "title" ? { ...e, customData: { ...e.customData, direction: "TD" } } : e);
    fire(tdScene);
    await sleep(300);
    assert.equal(writes.length, 3, "switching to TD re-anchors structural arrows");
    assert.deepEqual(abs(lastArrow("stub")), [[-40, 538], [16, 538]], "TD stub stays horizontal");
    assert.deepEqual(abs(lastArrow("spine")), [[-40, 40], [-40, 538]], "TD spine stays vertical");
  });
}

/* === T26 manual moves are adopted as truth on regeneration === */
{
  const app26 = createMockApp(TMP);
  mountGlobals(app26);
  app26.metadataCache.resolvedLinks = {
    "LinksDemo/A.md": { "LinksDemo/B.md": 1 },
    "LinksDemo/B.md": { "LinksDemo/A.md": 1 },
  };
  const ea26 = createMockEA();
  await runScript(app26, ea26, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
  const before = sceneElements(ea26);
  const cardA = before.find((el) => el.customData?.key === "file|LinksDemo/A.md");
  assert.ok(cardA, "card A missing");
  const origX = cardA.x, origY = cardA.y;

  // simulate a MANUAL MOVE of card A in the saved scene
  cardA.x += 320; cardA.y += 140;
  await runScript(app26, ea26, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
  const after = sceneElements(ea26);
  const cardA2 = after.find((el) => el.customData?.key === "file|LinksDemo/A.md");
  const cardB2 = after.find((el) => el.customData?.key === "file|LinksDemo/B.md");
  const cardB1 = before.find((el) => el.customData?.key === "file|LinksDemo/B.md");

  check("T26a moved card keeps its moved position after regeneration", () => {
    assert.equal(cardA2.x, origX + 320, "A.x should be adopted, got " + cardA2.x);
    assert.equal(cardA2.y, origY + 140, "A.y should be adopted");
  });
  check("T26b untouched cards keep their positions", () => {
    assert.equal(cardB2.x, cardB1.x);
    assert.equal(cardB2.y, cardB1.y);
  });
  check("T26c link arrow re-anchored to the moved card", () => {
    const arrow = after.find((el) => el.customData?.kind === "link");
    assert.ok(arrow, "link arrow missing");
    const aRect = { x: cardA2.x - 10, y: cardA2.y - 10, w: cardA2.width + 20, h: cardA2.height + 20 };
    const onA = Math.abs(arrow.points[0][0] - aRect.x) < 2 || Math.abs(arrow.points[0][0] - (aRect.x + aRect.w)) < 2 ||
                Math.abs(arrow.points[0][1] - aRect.y) < 2 || Math.abs(arrow.points[0][1] - (aRect.y + aRect.h)) < 2;
    assert.ok(onA, "arrow endpoint not on moved A boundary");
  });
  check("T26d pods are grouped (move one pod element moves the pod)", () => {
    const pods = after.filter((el) => ["frame", "pod-motif", "pod-label", "embed", "dive-hint"].includes(el.customData?.kind));
    assert.ok(pods.length >= 4, "pod elements missing");
    assert.ok(pods.every((el) => (el.groupIds || []).length > 0), "pod elements not grouped");
  });
  unmountGlobals();
}

/* === T23 example installers produce well-formed demo brains === */
{
  const { installDemo } = await import("../examples/install-demo.mjs");
  const EXROOT = path.join(HERE, "..");
  const demoTmp = path.join(HERE, "tmp-examples");
  fs.rmSync(demoTmp, { recursive: true, force: true });
  for (const demo of ["research-brain", "project-hub", "knowledge-garden"]) {
    check("T23 " + demo + ": installer runs and creates the documented tree", () => {
      const result = installDemo(demo, demoTmp);
      assert.ok(result.indexes > 0, "no _index templates created");
      const manifest = JSON.parse(fs.readFileSync(path.join(EXROOT, "examples", demo, "manifest.json"), "utf8"));
      for (const rel of Object.keys(manifest.files)) {
        assert.ok(fs.existsSync(path.join(demoTmp, manifest.root, rel)), "missing file " + rel);
      }
      for (const idx of manifest.indexes) {
        assert.ok(fs.existsSync(path.join(demoTmp, manifest.root, idx, "_index.excalidraw.md")), "missing index at " + idx);
      }
    });
  }
  check("T23 research-brain: link topology seeds are present in the notes", () => {
    const rl = fs.readFileSync(path.join(demoTmp, "Research/Inbox/Reading List.md"), "utf8");
    assert.ok((rl.match(/\[\[/g) || []).length >= 4, "Reading List must fan out to 4+ notes");
    const neuro = fs.readFileSync(path.join(demoTmp, "Research/Fields/Neuroscience.md"), "utf8");
    const cx = fs.readFileSync(path.join(demoTmp, "Research/Fields/Complexity Science.md"), "utf8");
    assert.ok(neuro.includes("[[Complexity Science]]") && cx.includes("[[Neuroscience]]"), "mutual pair missing");
  });
  check("T23 project-hub: cross-project dependency links present", () => {
    const api = fs.readFileSync(path.join(demoTmp, "Projects/Mobile App/API Contract.md"), "utf8");
    assert.ok(api.includes("Design System"), "Mobile -> Website dependency missing");
    const brief = fs.readFileSync(path.join(demoTmp, "Projects/Website Redesign/Brief.md"), "utf8");
    assert.ok(brief.includes("Component Library"), "Website -> Shared dependency missing");
  });
  check("T23g knowledge-garden: showcase scale and topology are real", () => {
    const garden = path.join(demoTmp, "Garden");
    const notes = fs.readdirSync(path.join(garden, "Fields", "Topics"), { recursive: true });
    assert.ok(notes.length >= 10, "Topics should have 10 cards");
    const welcome = fs.readFileSync(path.join(garden, "Welcome.md"), "utf8");
    assert.ok((welcome.match(/\[\[/g) || []).length >= 6, "Welcome must be a hub (6+ links)");
    const total = fs.readdirSync(garden, { recursive: true }).filter((f) => f.endsWith(".md") && !f.endsWith("_index.excalidraw.md"));
    assert.ok(total.length >= 50, "garden should have 50+ notes, got " + total.length);
    const source = fs.readFileSync(path.join(garden, "Sources", "Thinking in Systems.md"), "utf8");
    assert.ok(source.includes("[[Garden/People/Donella Meadows]]") && source.includes("[[Garden/Fields/Systems Thinking]]"), "literature note must link people and field");
  });
  fs.rmSync(demoTmp, { recursive: true, force: true });
}

/* === T20 output purity: no stray markup in generations === */
check("T20a generated drawings contain no HTML tags in text elements", () => {
  const HTML_TAG = /<[a-zA-Z\/][^>]*>/;
  const sceneOf = (md) => JSON.parse(md.match(/```json\n([\s\S]*?)\n```/)[1]);
  for (const f of fs.readdirSync(OUT)) {
    if (!f.endsWith(".excalidraw.md")) continue;
    const scene = sceneOf(fs.readFileSync(path.join(OUT, f), "utf8"));
    for (const el of scene.elements) {
      if (el.type === "text") assert.ok(!HTML_TAG.test(el.text || ""), "HTML in " + f + ": " + el.text);
    }
  }
});
check("T20b SVG preview uses only whitelisted tags", () => {
  const OK = new Set(["svg", "rect", "text", "tspan", "line", "circle", "path"]);
  const svg = fs.readFileSync(path.join(OUT, "preview.svg"), "utf8");
  for (const m of svg.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)[\s>]/g)) {
    assert.ok(OK.has(m[1]), "unexpected tag <" + m[1] + ">");
  }
});

/* === T29 ELK fallback + "ELK proposes, slots dispose" contract === */
{
  check("T29a offline fallback: grid positions, no ELK crash, deterministic", () => {
    assert.ok(typeof document === "undefined", "test env should have no document");
    const cards = sceneElements(ea1).filter((el) => el.customData?.kind === "file");
    assert.ok(cards.length > 0, "no file cards generated");
    const xs = cards.map((c) => c.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const gap = xs[i] - xs[i - 1];
      if (gap < 50) throw new Error("non-grid gap " + gap + " ELK leaked into fallback?");
    }
  });

  await checkAsync("T29b first-run positions persist through regeneration (adoption from cold start)", async () => {
    const fresh = createMockEA();
    const freshApp = createMockApp(TMP);
    mountGlobals(freshApp);
    await runScript(freshApp, fresh, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
    const first = sceneElements(fresh).filter((el) => el.customData?.kind === "file");
    assert.ok(first.length > 0, "no cards on first run");
    const firstPos = first.map((el) => [el.customData.key, Math.round(el.x), Math.round(el.y)]);
    const second = createMockEA();
    second._scene = new Map(fresh._scene);
    await runScript(freshApp, second, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
    const after = sceneElements(second).filter((el) => el.customData?.kind === "file");
    for (const [key, x, y] of firstPos) {
      const el = after.find((e) => e.customData.key === key);
      assert.ok(el, "card disappeared: " + key);
      assert.equal(Math.round(el.x), x, "x moved for " + key);
      assert.equal(Math.round(el.y), y, "y moved for " + key);
    }
    unmountGlobals();
  });
}

/* === T30 elbowed structural arrows === */
{
  check("T30 spine and stubs use elbowed routing; link arrows do not", () => {
    const spine = sceneElements(ea1).filter((el) => el.customData?.kind === "spine");
    const stubs = sceneElements(ea1).filter((el) => el.customData?.kind === "arrow");
    assert.ok(spine.length >= 1, "no spine");
    assert.ok(stubs.length >= 1, "no stub arrows");
    assert.ok(spine.every((el) => el.elbowed === true), "spine not elbowed");
    assert.ok(stubs.every((el) => el.elbowed === true), "stubs not elbowed");
    // link arrows are relationships (direct routing), NOT hierarchy (elbowed)
    const linkEls = sceneElements(ea1).filter((el) => el.customData?.kind === "link");
    assert.ok(linkEls.every((el) => !el.elbowed), "link arrows should NOT be elbowed");
  });
}

/* === T31 direction config (TD/LR) === */
{
  const app31 = createMockApp(TMP);
  mountGlobals(app31);
  app31.metadataCache.resolvedLinks = {};

  await checkAsync("T31a LR: pods side-by-side, files below", async () => {
    const ea31 = createMockEA();
    await runScript(app31, ea31, "LinksDemo/_index.excalidraw.md", ["self+create", true, "LR"]);
    const pods = sceneElements(ea31).filter((el) => el.customData?.kind === "pod-label");
    assert.ok(pods.length >= 2, "need 2+ pods for LR test");
    const ys = pods.map((p) => p.y);
    assert.ok(ys.every((y) => y === ys[0]), "LR pods should share y, got: " + JSON.stringify(ys));
    assert.ok(pods[1].x > pods[0].x, "LR pods should have increasing x");
    const files = sceneElements(ea31).filter((el) => el.customData?.kind === "file");
    if (files.length) {
      assert.ok(files[0].y > ys[0] + 300, "files should be below pods in LR");
    }
  });

  await checkAsync("T31b direction persists on regeneration (stored in title customData)", async () => {
    const ea31b = createMockEA();
    await runScript(app31, ea31b, "LinksDemo/_index.excalidraw.md", ["self+create", true, "LR"]);
    const ea31c = createMockEA();
    ea31c._scene = new Map(ea31b._scene);
    await runScript(app31, ea31c, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
    const title = sceneElements(ea31c).find((el) => el.customData?.kind === "title");
    assert.ok(title, "no title");
    assert.equal(title.customData.direction, "LR", "direction not preserved: " + title.customData.direction);
    const pods = sceneElements(ea31c).filter((el) => el.customData?.kind === "pod-label");
    if (pods.length >= 2) {
      assert.ok(pods.every((p) => p.y === pods[0].y), "regen should keep LR layout");
    }
  });

  await checkAsync("T31c TD pods stack vertically", async () => {
    const ea31d = createMockEA();
    await runScript(app31, ea31d, "LinksDemo/_index.excalidraw.md", ["self+create", true, "TD"]);
    const pods = sceneElements(ea31d).filter((el) => el.customData?.kind === "pod-label").sort((a, b) => a.y - b.y);
    assert.ok(pods.length >= 4, "need 4 pods");
    assert.ok(pods.every((p) => p.x < 100), "TD pods stay left of file cards");
    assert.ok(pods.every((p, i) => i === 0 || p.y > pods[i - 1].y), "TD pods stack vertically");
  });

  unmountGlobals();
}

/* === T32 relationship-aware curved arrows === */
{
  const app32 = createMockApp(TMP);
  mountGlobals(app32);
  app32.metadataCache.resolvedLinks = {
    "LinksDemo/A.md": { "LinksDemo/B.md": 1, "LinksDemo/sub/S.md": 1 },
    "LinksDemo/B.md": { "LinksDemo/A.md": 1 },
    "LinksDemo/sub/S.md": { "LinksDemo/B.md": 1 },
    "LinksDemo/sub2/S2.md": { "LinksDemo/sub/S.md": 1 },
  };
  const ea32 = createMockEA();
  await runScript(app32, ea32, "LinksDemo/_index.excalidraw.md", ["self+create", true]);
  const links = sceneElements(ea32).filter((el) => el.customData?.kind === "link");

  check("T32a relationships classified: mutual, peer, bridges, nourishes, feeds", () => {
    assert.ok(links.length >= 4, "need 4+ links for classification, got " + links.length);
    const rels = links.map((l) => l.customData?.rel);
    assert.ok(rels.includes("resonates"), "missing resonates (mutual): " + JSON.stringify(rels));
    assert.ok(rels.includes("bridges"), "missing bridges (pod-to-pod): " + JSON.stringify(rels));
    assert.ok(rels.includes("nourishes") || rels.includes("feeds"), "missing pod-card rel: " + JSON.stringify(rels));
  });

  check("T32b all link arrows are curved (roundness type 1 = Bezier)", () => {
    assert.ok(links.every((l) => l.roundness && l.roundness.type === 1), "arrows not curved");
  });

  check("T32c visual hierarchy: resonates thickest, feeds thinnest", () => {
    const byRel = new Map();
    for (const l of links) byRel.set(l.customData?.rel, l);
    const res = byRel.get("resonates");
    const peer = byRel.get("peer");
    if (res && peer) assert.ok(res.strokeWidth > peer.strokeWidth, "resonates should be thicker: " + res.strokeWidth + " vs " + peer.strokeWidth);
    const feeds = byRel.get("feeds") || byRel.get("nourishes");
    if (feeds && peer) assert.ok(feeds.strokeWidth <= peer.strokeWidth, "feeds should be thin");
  });

  check("T32d distinct stroke styles per relationship type", () => {
    const styles = new Set(links.map((l) => l.strokeStyle));
    assert.ok(styles.size >= 2, "all same strokeStyle: " + [...styles]);
    const colors = new Set(links.map((l) => l.strokeColor));
    assert.ok(colors.size >= 2, "all same color: " + [...colors]);
  });

  check("T32e resonates arrows have double heads (start+end)", () => {
    const res = links.filter((l) => l.customData?.rel === "resonates");
    assert.ok(res.length > 0, "no resonates arrows");
    assert.ok(res.every((l) => l.startArrowhead === "arrow" && l.endArrowhead === "arrow"), "not double-headed");
  });

  unmountGlobals();
}

/* === T33 component system: zero-overlap invariant on generated maps === */
{
  const { execFileSync } = await import("node:child_process");
  await checkAsync("T33 zero-overlap: every demo brain rebuilds clean through the component solver", async () => {
    const tmpVault = path.join(HERE, "tmp-overlap");
    fs.rmSync(tmpVault, { recursive: true, force: true });
    // install all three demo brains into one vault
    for (const demo of ["research-brain", "project-hub", "knowledge-garden"]) {
      execFileSync("node", [path.join(HERE, "..", "examples", "install-demo.mjs"), demo, tmpVault], { stdio: "ignore" });
    }
    // rebuild through the component system
    execFileSync("node", [path.join(HERE, "..", "build-index.mjs"), tmpVault], { stdio: "pipe" });
    // invariant: pod frames, card boxes pairwise disjoint; cards vs pods disjoint
    const intersect = (a, b) =>
      a.x + a.width > b.x + 1 && b.x + b.width > a.x + 1 &&
      a.y + a.height > b.y + 1 && b.y + b.height > a.y + 1;
    let checked = 0;
    for (const f of fs.readdirSync(tmpVault, { recursive: true })) {
      if (!String(f).endsWith("_index.excalidraw.md")) continue;
      const md = fs.readFileSync(path.join(tmpVault, String(f)), "utf8");
      const scene = JSON.parse(md.match(/```json\n([\s\S]*?)\n```/)[1]);
      const els = scene.elements.filter((e) => !e.isDeleted);
      const podFrames = els.filter((e) => e.customData?.kind === "frame");
      const cardBoxes = els.filter((e) => e.customData?.kind === "file-box");
      for (let i = 0; i < podFrames.length; i++)
        for (let j = i + 1; j < podFrames.length; j++)
          assert.ok(!intersect(podFrames[i], podFrames[j]), `pod frames overlap in ${f}`);
      for (let i = 0; i < cardBoxes.length; i++)
        for (let j = i + 1; j < cardBoxes.length; j++)
          assert.ok(!intersect(cardBoxes[i], cardBoxes[j]), `card boxes overlap in ${f}`);
      for (const c of cardBoxes)
        for (const p of podFrames)
          assert.ok(!intersect(c, p), `card box intersects pod frame in ${f}`);
      checked++;
    }
    assert.ok(checked >= 12, "expected 12+ maps, got " + checked);
    fs.rmSync(tmpVault, { recursive: true, force: true });
  });
}

/* ────────────────────────────── report ────────────────────────────────── */
/* === T28 Fractal Sync: one command regenerates the whole brain === */
{
  const INDEX_SRC = fs.readFileSync(path.join(HERE, "..", "ea-scripts", "Fractal Index.md"), "utf8");
  const SYNC_SRC = fs.readFileSync(path.join(HERE, "..", "ea-scripts", "Fractal Sync.md"), "utf8");
  const stripAll = (src) => src.replace(/^---\n[\s\S]*?\n---\n/, "");

  fs.mkdirSync(path.join(TMP, "Excalidraw/Scripts"), { recursive: true });
  fs.copyFileSync(path.join(HERE, "..", "ea-scripts", "Fractal Index.md"), path.join(TMP, "Excalidraw/Scripts/Fractal Index.md"));
  fs.copyFileSync(path.join(HERE, "..", "ea-scripts", "Fractal Sync.md"), path.join(TMP, "Excalidraw/Scripts/Fractal Sync.md"));

  const appS = createMockApp(TMP);
  mountGlobals(appS);
  appS.metadataCache.resolvedLinks = {
    "LinksDemo/A.md": { "LinksDemo/B.md": 1 },
    "LinksDemo/B.md": { "LinksDemo/A.md": 1 },
  };
  // sync now executes levels DIRECTLY on the plugin's global EA (ea.setView),
  // so the mock plugin exposes a full mock EA with a setView that re-points it
  const pluginEA = createMockEA();
  const scenes = new Map(); // per-view scenes (real EA scopes scenes per view)
  pluginEA.setView = function (view) {
    this.targetView = view;
    if (!scenes.has(view.file.path)) scenes.set(view.file.path, new Map());
    this._scene = scenes.get(view.file.path);
    return view;
  };
  appS.plugins.plugins["obsidian-excalidraw-plugin"].ea = pluginEA;

  await checkAsync("T28 one Sync run generates every level of the brain", async () => {
    assert.ok(fs.existsSync(path.join(TMP, "LinksDemo/_index.excalidraw.md")), "LinksDemo root index missing");
    const eaSync = createMockEA();
    eaSync.plugin = appS.plugins.plugins["obsidian-excalidraw-plugin"];
    const rootFile = appS.vault.getAbstractFileByPath("LinksDemo/_index.excalidraw.md");
    eaSync.targetView = { file: rootFile, getScene: () => ({}) };
    const titleOf = (folder) => {
      const scene = scenes.get(folder + "/_index.excalidraw.md");
      return scene && [...scene.values()].find((el) => el.customData?.kind === "title" && el.customData.key === "title|" + folder);
    };
    // the real MCP/tooling flow presets options via the global flag
    globalThis.__fractalSyncOptions = { scope: "self+create", links: true };
    const utils = {
      suggester: async () => undefined,
      scriptFile: appS.vault.getAbstractFileByPath("Excalidraw/Scripts/Fractal Sync.md"),
    };
    const compiledSync = new (async () => {}).constructor("ea", "utils", stripAll(SYNC_SRC));
    await compiledSync(eaSync, utils);
    await new Promise((r) => setTimeout(r, 200));

    const folders = ["LinksDemo", "LinksDemo/sub", "LinksDemo/sub2", "LinksDemo/sub3", "LinksDemo/sub4"];
    for (const f of folders) {
      assert.ok(titleOf(f), "level not generated: " + f);
    }
    const subScene = scenes.get("LinksDemo/sub/_index.excalidraw.md");
    assert.ok(
      subScene && [...subScene.values()].some((el) => el.customData?.basename === "S.md"),
      "S.md card missing in sub"
    );
    assert.strictEqual(globalThis.__fractalSyncOptions, null, "sync flag must be cleared");
    assert.ok(appS.notices.some((n) => n.includes("maps updated")), "summary notice missing");
  });
  unmountGlobals();
}

console.log("\n═══════════════════════════════════════════════");
for (const [status, name] of results) console.log(`${status === "PASS" ? " ✓" : " ✗"} ${name}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log("═══════════════════════════════════════════════");
console.log(`${results.length - failed}/${results.length} checks passed`);
console.log(`Artifacts → ${OUT}{Brain _index.excalidraw.md, Areas _index.excalidraw.md, preview.svg}`);
if (failed) {
  console.log("\nNotices captured during runs:");
  process.exit(1);
}

