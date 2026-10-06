// Offline tests for obsidrain-mcp: protocol handshake, tools/list, graceful
// degradation when Obsidian is NOT running. Zero dependencies.
//   node mcp/run-tests.mjs

import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";
import readline from "node:readline";
import assert from "node:assert/strict";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const results = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => results.push(["PASS", name]))
    .catch((e) => { results.push(["FAIL", name + " — " + e.message]); process.exitCode = 1; });
}

function startServer() {
  // point at a port with nothing listening → tools must degrade gracefully
  const p = spawn(process.execPath, [path.join(HERE, "server.mjs")], {
    env: { ...process.env, OBSIDIAN_CDP_PORT: "39999" },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const rl = readline.createInterface({ input: p.stdout, terminal: false });
  const pending = new Map();
  let nextId = 1;
  const send = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  rl.on("line", (l) => {
    try {
      const m = JSON.parse(l);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    } catch {}
  });
  return { p, send, kill: () => p.kill() };
}

const srv = startServer();

await check("M1 initialize handshake", async () => {
  const r = await srv.send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test" } });
  assert.equal(r.result.protocolVersion, "2024-11-05");
  assert.ok(r.result.capabilities.tools);
  assert.equal(r.result.serverInfo.name, "obsidbrain-mcp");
});

await check("M2 tools/list exposes the brain toolkit", async () => {
  const r = await srv.send("tools/list", {});
  const names = r.result.tools.map((t) => t.name);
  for (const expected of ["status", "list_brains", "read_map", "query_links", "generate_index", "sync_brain", "dive", "regenerate_workviews"]) {
    assert.ok(names.includes(expected), "missing tool: " + expected);
  }
  for (const t of r.result.tools) assert.ok(t.description && t.inputSchema, "schema missing on " + t.name);
});

await check("M3 status degrades gracefully when Obsidian is down", async () => {
  const r = await srv.send("tools/call", { name: "status", arguments: {} });
  assert.ok(r.result.isError, "expected structured error");
  const text = r.result.content[0].text;
  assert.match(text, /not reachable/i);
  assert.match(text, /remote-debugging-port/); // tells the agent HOW to fix it
});

await check("M4 unknown tool -> structured error, not a crash", async () => {
  const r = await srv.send("tools/call", { name: "nope", arguments: {} });
  assert.ok(r.result.isError);
  assert.match(r.result.content[0].text, /unknown tool/);
  // server still alive:
  const ping = await srv.send("ping", {});
  assert.ok(ping.result);
});

srv.kill();
await new Promise((r) => setTimeout(r, 200));

console.log("\n═══════════════════════════════════════════════");
for (const [s, n] of results) console.log((s === "PASS" ? " ✓ " : " ✗ ") + n);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log("═══════════════════════════════════════════════");
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
