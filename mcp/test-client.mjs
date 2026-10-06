// Manual smoke client: speaks MCP to the running server against a LIVE Obsidian.
//   1) launch Obsidian with the debug port (see dev-tools/README.md)
//   2) node mcp/test-client.mjs status
//      node mcp/test-client.mjs list_brains
//      node mcp/test-client.mjs read_map Garden/_index.excalidraw.md
//      node mcp/test-client.mjs query_links Garden/Fields
//      node mcp/test-client.mjs generate_index Garden/attachments
//      node mcp/test-client.mjs dive "Garden/_index.excalidraw.md" "pod|Garden/Fields|embed"
//      node mcp/test-client.mjs sync_brain Garden/_index.excalidraw.md
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";
import readline from "node:readline";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const [methodArg, ...rest] = process.argv.slice(2);

const CALLS = {
  status: ["status", {}],
  list_brains: ["list_brains", {}],
  read_map: ["read_map", { path: rest[0] }],
  query_links: ["query_links", { folder: rest[0] || "" }],
  generate_index: ["generate_index", { folder: rest[0] || "", links: true }],
  dive: ["dive", { path: rest[0], key: rest[1] || "" }],
  sync_brain: ["sync_brain", { rootIndexPath: rest[0], links: true }],
  workviews: ["regenerate_workviews", { source: rest[0], out: rest[1], title: rest[2] || "Launchpad" }],
};

const [name, args] = CALLS[methodArg] || [];
if (!name) {
  console.error("usage: node test-client.mjs <" + Object.keys(CALLS).join("|") + "> [args...]");
  process.exit(1);
}

const p = spawn(process.execPath, [path.join(HERE, "server.mjs")], { stdio: ["pipe", "pipe", "inherit"] });
const rl = readline.createInterface({ input: p.stdout, terminal: false });
rl.on("line", (l) => {
  try {
    const m = JSON.parse(l);
    if (m.id === 2) {
      const text = m.result && m.result.content ? m.result.content[0].text : JSON.stringify(m, null, 1);
      console.log(m.result && m.result.isError ? "ERROR: " + text : text);
      p.kill();
      process.exit(0);
    }
  } catch {}
});
p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke" } } }) + "\n");
setTimeout(() => {
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) + "\n");
}, 300);
setTimeout(() => { console.error("timeout"); p.kill(); process.exit(1); }, 180000);
