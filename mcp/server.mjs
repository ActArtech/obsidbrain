#!/usr/bin/env node
// obsidrain-mcp — Model Context Protocol server (stdio, newline-delimited
// JSON-RPC 2.0, zero dependencies) exposing the Obsidian brain to agents.
//
// Configure (Claude Desktop / Cursor / any MCP client):
//   { "mcpServers": { "obsidbrain": {
//       "command": "node",
//       "args": ["<repo>/mcp/server.mjs"],
//       "env": { "OBSIDIAN_CDP_PORT": "9333" } } } }
//
// Requirement: Obsidian must run with --remote-debugging-port=9333
// (the `status` tool returns the exact launch command when it is not).

import readline from "node:readline";
import { ObsidianCDP } from "./cdp.mjs";
import { TOOLS } from "./tools.mjs";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "obsidbrain-mcp", version: "0.1.0" };

const cdp = new ObsidianCDP();

function ok(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n"); }
function err(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"); }

async function callTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error("unknown tool: " + name + " (available: " + TOOLS.map((t) => t.name).join(", ") + ")");
  // tools may opt out of the Obsidian connection per-call (offline mode)
  if (!tool.skipConnect || !tool.skipConnect(args || {})) await cdp.ensure();
  return tool.run(cdp, args || {});
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let msg = null;
  try { msg = JSON.parse(text); } catch { return; }
  if (msg == null || msg.jsonrpc !== "2.0") return;

  // notifications (no id) get no response
  if (msg.id === undefined || msg.id === null) return;

  if (msg.method === "initialize") {
    ok(msg.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }
  if (msg.method === "ping") { ok(msg.id, {}); return; }
  if (msg.method === "tools/list") {
    ok(msg.id, {
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    });
    return;
  }
  if (msg.method === "tools/call") {
    const name = msg.params && msg.params.name;
    const args = (msg.params && msg.params.arguments) || {};
    callTool(name, args)
      .then((value) => ok(msg.id, { content: [{ type: "text", text: JSON.stringify(value, null, 1) }] }))
      .catch((e) => ok(msg.id, {
        content: [{ type: "text", text: String(e && e.message ? e.message : e) }],
        isError: true,
      }));
    return;
  }
  err(msg.id, -32601, "method not found: " + msg.method);
});

rl.on("close", () => { cdp.close(); process.exit(0); });
