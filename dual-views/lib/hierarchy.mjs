// Core data model: single source of truth hierarchy + honest roll-ups.
//
// Design (per the architecture review):
//   - Three enforced anchors: outcome (JTBD), capability, and leaf task.
//   - Services are NOT a tree level: a task references a capability AND a
//     service (many-to-many mapping table), never a 8-deep parent chain.
//   - Progress roll-up is unweighted count of done leaves / total leaves.
//     Status comes from real signals (issue state), not manual boards.

export const STATUS_ORDER = ["todo", "in_progress", "blocked", "done"];
export const STATUS_COLORS = {
  done: "#2e7d32",
  in_progress: "#f59e0b",
  blocked: "#dc2626",
  todo: "#9e9e9e",
};

export function normalizeStatus(s) {
  if (s === "done" || s === "in_progress" || s === "blocked") return s;
  return "todo";
}

/**
 * Build the projection-ready model from raw work items.
 * Items:
 *   { key, title, kind: "outcome"|"capability"|"service"|"task",
 *     parent?: key (capability → outcome; optional),
 *     capability?: key (task → capability), service?: key (task → service),
 *     status?, size?, url?, flowOrder? }
 *
 * Returns { root, nodes } where nodes is a Map key → node with:
 *   { key, title, kind, status, size, url, children[], parents[],
 *     rollup: {done, total, progress} }
 */
export function buildModel(items) {
  const byKey = new Map();
  for (const it of items) {
    if (!it.key || !it.title) throw new Error("every item needs key and title");
    if (byKey.has(it.key)) throw new Error("duplicate key: " + it.key);
    byKey.set(it.key, {
      key: it.key,
      title: String(it.title),
      kind: it.kind || "task",
      status: normalizeStatus(it.status),
      size: Number.isFinite(it.size) && it.size > 0 ? it.size : 1,
      url: it.url || null,
      parent: it.parent || null,
      capability: it.capability || null,
      service: it.service || null,
      flowOrder: Number.isFinite(it.flowOrder) ? it.flowOrder : Number.MAX_SAFE_INTEGER,
      children: [],
    });
  }

  // structural parents: capability → outcome
  for (const n of byKey.values()) {
    if (n.kind === "capability" && n.parent) {
      const p = byKey.get(n.parent);
      if (!p) throw new Error(`capability ${n.key}: unknown parent ${n.parent}`);
      if (p.kind !== "outcome") throw new Error(`capability ${n.key}: parent must be an outcome, got ${p.key}`);
    }
    if (n.kind === "task") {
      if (n.capability && !byKey.has(n.capability)) throw new Error(`task ${n.key}: unknown capability ${n.capability}`);
      if (n.service && !byKey.has(n.service)) throw new Error(`task ${n.key}: unknown service ${n.service}`);
      if (!n.capability) throw new Error(`task ${n.key}: leaf tasks must reference a capability (the outcome anchor)`);
    }
  }

  // derived membership: capability ↔ service through tasks (the mapping table)
  const root = { key: "__root__", title: "All outcomes", kind: "root", children: [], rollup: null };

  const outcomes = [...byKey.values()].filter((n) => n.kind === "outcome").sort(
    (a, b) => a.flowOrder - b.flowOrder || a.title.localeCompare(b.title)
  );
  const capabilities = [...byKey.values()].filter((n) => n.kind === "capability");
  const services = [...byKey.values()].filter((n) => n.kind === "service");
  const tasks = [...byKey.values()].filter((n) => n.kind === "task");

  // capability → tasks (sorted for determinism)
  for (const c of capabilities) {
    c.tasks = tasks.filter((t) => t.capability === c.key).sort(taskSort);
  }
  // synthetic capability×service membership nodes: key `cap+svc`
  const memberships = new Map(); // "cap|svc" → node
  for (const t of tasks) {
    if (!t.service) continue;
    const mk = t.capability + "|" + t.service;
    if (!memberships.has(mk)) {
      memberships.set(mk, {
        key: mk,
        title: byKey.get(t.service).title,
        kind: "membership",
        capabilityKey: t.capability,
        serviceKey: t.service,
        tasks: [],
      });
    }
    memberships.get(mk).tasks.push(t);
  }
  for (const m of memberships.values()) m.tasks.sort(taskSort);

  // tree: root → outcome → capability → membership → task
  const orphans = capabilities.filter((c) => !c.parent);
  for (const c of orphans) c.parent = null;
  for (const o of outcomes) o.children = capabilities.filter((c) => c.parent === o.key).sort(byTitle);
  root.children = outcomes;

  for (const c of capabilities) {
    c.memberships = [...memberships.values()].filter((m) => m.capabilityKey === c.key).sort(byKeyFn);
    c.children = c.memberships;
    c.directTasks = c.tasks.filter((t) => !t.service);
  }

  // roll-ups: unweighted done-leaves / total-leaves
  const rollupOfTasks = (ts) => {
    const done = ts.filter((t) => t.status === "done").length;
    return { done, total: ts.length, progress: ts.length ? done / ts.length : 0 };
  };
  for (const m of memberships.values()) m.rollup = rollupOfTasks(m.tasks);
  for (const c of capabilities) c.rollup = rollupOfTasks(c.tasks);
  for (const o of outcomes) {
    o.rollup = rollupOfTasks(o.children.flatMap((c) => c.tasks));
    o.allTasks = o.children.flatMap((c) => c.tasks);
  }
  root.rollup = rollupOfTasks(tasks);

  // service rollups (code-tree lens): across ALL capabilities it serves
  for (const s of services) {
    s.rollup = rollupOfTasks(tasks.filter((t) => t.service === s.key));
  }

  // aggregate status for chips/cards: worst of children if not done
  const aggStatus = (ts) => {
    if (!ts.length) return "todo";
    if (ts.every((t) => t.status === "done")) return "done";
    if (ts.some((t) => t.status === "blocked")) return "blocked";
    if (ts.some((t) => t.status === "in_progress")) return "in_progress";
    return "todo";
  };
  for (const m of memberships.values()) m.status = aggStatus(m.tasks);
  for (const c of capabilities) c.status = aggStatus(c.tasks);
  for (const o of outcomes) o.status = aggStatus(o.allTasks);
  for (const s of services) s.status = aggStatus(tasks.filter((t) => t.service === s.key));

  return { root, byKey, outcomes, capabilities, services, tasks, memberships };
}
const taskSort = (a, b) => a.title.localeCompare(b.title);
const byTitle = (a, b) => a.title.localeCompare(b.title);
const byKeyFn = (a, b) => (a.key < b.key ? -1 : 1);
const cOf = (t, byKey) => (t.capability ? byKey.get(t.capability) : null);

/**
 * Flatten the tree for the treemap projection.
 * Returns rows: {id,label,parent,value,colorKey} — same keys in every projection.
 */
export function treemapRows(model) {
  const rows = [{ id: "", label: model.root.title, parent: null, value: 0, key: model.root.key }];
  const walk = (node, parentId) => {
    for (const ch of node.children || []) {
      rows.push({ id: ch.key, label: ch.title, parent: parentId, value: 0, key: ch.key });
      walk(ch, ch.key);
    }
  };
  walk(model.root, "");
  // memberships are walked above; hang tasks beneath them (or beneath capability)
  for (const m of model.memberships.values()) {
    for (const t of m.tasks) {
      rows.push({ id: t.key, label: t.title, parent: m.key, value: t.size, key: t.key });
    }
  }
  for (const c of model.capabilities) {
    for (const t of c.directTasks) {
      rows.push({ id: t.key, label: t.title, parent: c.key, value: t.size, key: t.key });
    }
  }
  // progress colors per row key
  const progressOf = new Map([[model.root.key, model.root.rollup]]);
  for (const o of model.outcomes) progressOf.set(o.key, o.rollup);
  for (const c of model.capabilities) progressOf.set(c.key, c.rollup);
  for (const m of model.memberships.values()) progressOf.set(m.key, m.rollup);
  for (const t of model.tasks) progressOf.set(t.key, { done: t.status === "done" ? 1 : 0, total: 1, progress: t.status === "done" ? 1 : 0 });
  return rows.map((r) => {
    const ro = progressOf.get(r.key);
    return { ...r, progress: ro?.progress ?? 0, done: ro?.done ?? 0, total: ro?.total ?? 0 };
  });
}
