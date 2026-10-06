// Persistent CDP connection to a running Obsidian (WebSocket framing from
// dev-tools/ws-cdp.mjs, packaged as a reusable class). See dev-tools/README.md
// for the pitfalls encoded here.

import http from "node:http";
import crypto from "node:crypto";

export class ObsidianCDP {
  constructor(port = Number(process.env.OBSIDIAN_CDP_PORT || 9333)) {
    this.port = port;
    this.sock = null;
    this.buf = Buffer.alloc(0);
    this.cur = "";
    this.nextId = 1;
    this.pending = new Map();
    this.wsUrl = null;
  }

  /** fetch the page target and open the WebSocket; throws with guidance when down */
  async connect(timeoutMs = 5000) {
    const list = await this.#fetchJson(`/json/list`, timeoutMs);
    const page = (Array.isArray(list) ? list : []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (!page) throw new Error("no debuggable page target in Obsidian");
    this.wsUrl = page.webSocketDebuggerUrl;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket connect timeout")), timeoutMs);
      const key = crypto.randomBytes(16).toString("base64");
      const u = new URL(this.wsUrl);
      const req = http.request({
        host: "127.0.0.1", port: u.port, path: u.pathname,
        headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Key": key, "Sec-WebSocket-Version": "13" },
      });
      req.end();
      req.on("upgrade", (res, socket) => {
        clearTimeout(timer);
        this.sock = socket;
        socket.on("data", (d) => { this.buf = Buffer.concat([this.buf, d]); this.#parse(); });
        socket.on("error", () => this.#failAll("socket error"));
        socket.on("close", () => this.#failAll("socket closed"));
        resolve();
      });
      req.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
  }

  #fetchJson(path, timeoutMs) {
    return new Promise((resolve, reject) => {
      const req = http.get({ host: "127.0.0.1", port: this.port, path, timeout: timeoutMs }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch { reject(new Error("non-JSON from debug port")); }
        });
      });
      req.on("timeout", () => { req.destroy(); reject(this.#downError()); });
      req.on("error", () => reject(this.#downError()));
    });
  }

  #downError() {
    return new Error(
      "Obsidian is not reachable on port " + this.port +
      ". Launch it with a debugging port first, e.g. (PowerShell):\n" +
      "  Start-Process \"$env:LOCALAPPDATA\\Obsidian\\Obsidian.exe\" -ArgumentList '--remote-debugging-port=" + this.port + "'"
    );
  }

  get connected() { return !!this.sock && !this.sock.destroyed; }

  async ensure() {
    if (this.connected) return;
    await this.connect();
  }

  #call(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error("CDP not connected"));
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.#sendText(JSON.stringify({ id, method, params }));
    });
  }

  /** evaluate an expression in the app; returns the JSON value or throws with the remote exception */
  async evalIn(expression, timeoutMs = 120000) {
    const r = await this.#call("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true, timeout: timeoutMs,
    });
    if (r.error) throw new Error("CDP error: " + JSON.stringify(r.error).slice(0, 300));
    const res = r.result || {};
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error("remote exception: " + ((d.exception && d.exception.description) || d.text || "").slice(0, 500));
    }
    return res.result && res.result.value;
  }

  #failAll(msg) {
    for (const p of this.pending.values()) p.reject(new Error(msg));
    this.pending.clear();
  }

  #sendText(str) {
    const payload = Buffer.from(str, "utf8");
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x81, len | 0x80]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126 | 0x80; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127 | 0x80; header.writeBigUInt64BE(BigInt(len), 2); }
    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
    this.sock.write(Buffer.concat([header, mask, masked]));
  }

  #parse() {
    while (true) {
      if (this.buf.length < 2) return;
      const op = this.buf[0] & 0x0f;
      const masked = (this.buf[1] & 0x80) !== 0;
      let len = this.buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const maskLen = masked ? 4 : 0;
      if (this.buf.length < off + maskLen + len) return;
      let payload = this.buf.subarray(off + maskLen, off + maskLen + len);
      if (masked) {
        const m = this.buf.subarray(off, off + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ m[i % 4];
        payload = out;
      }
      this.buf = this.buf.subarray(off + maskLen + len);
      if (op === 0x1 || op === 0x0) {
        this.cur += payload.toString("utf8");
        if (op === 0x1) {
          let msg = null;
          try { msg = JSON.parse(this.cur); } catch { msg = null; }
          this.cur = "";
          if (msg && msg.id && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            p.resolve(msg);
          }
        }
      } else if (op === 0x9) {
        const hdr = Buffer.from([0x8a, 0x80]);
        this.sock.write(Buffer.concat([hdr, crypto.randomBytes(4)]));
      } else if (op === 0x8) {
        this.#failAll("server closed connection");
      }
    }
  }

  close() {
    if (this.sock) this.sock.destroy();
  }
}
