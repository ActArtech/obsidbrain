// Filesystem-backed mock of the Obsidian vault API (the subset Fractal Index uses).
// The fixture is a real directory tree copied to a temp dir per test run.

import fs from "node:fs";
import path from "node:path";

const ROOT_MARKER = "/";

export class TAbstractFile {
  constructor(vault, relPath) {
    this.vault = vault;
    this.path = relPath === "" ? ROOT_MARKER : relPath;
    this.name = this.path === ROOT_MARKER ? "" : this.path.split("/").pop();
    this.parent = null;
  }
}
export class TFile extends TAbstractFile {
  constructor(vault, relPath) {
    super(vault, relPath);
    this.basename = this.name.replace(/\.[^.]+$/, "");
    this.extension = this.name.includes(".") ? this.name.split(".").pop() : "";
    this.stat = { mtime: 0, size: 0, ctime: 0 };
  }
}
export class TFolder extends TAbstractFile {
  constructor(vault, relPath) {
    super(vault, relPath);
    this.isRoot = this.path === ROOT_MARKER;
    if (this.isRoot) this.name = "";
  }
  get children() {
    return this.vault.getChildren(this);
  }
}

export class MockVault {
  constructor(rootDir) {
    this.rootDir = path.resolve(rootDir);
  }
  _abs(rel) {
    const clean = rel === ROOT_MARKER || rel === "" ? "" : rel.replace(/^\//, "");
    if (clean.includes("..")) throw new Error("bad path: " + rel);
    return path.join(this.rootDir, clean);
  }
  _rel(abs) {
    return path.relative(this.rootDir, abs).split(path.sep).join("/");
  }
  _wireParent(node) {
    if (node.path === ROOT_MARKER) {
      node.parent = null;
      return node;
    }
    const dir = node.path.split("/").slice(0, -1).join("/");
    const parentPath = dir === "" ? ROOT_MARKER : dir;
    const parent = new TFolder(this, parentPath);
    this._wireParent(parent); // real Obsidian wires the full ancestor chain
    node.parent = parent;
    return node;
  }
  getRoot() {
    return new TFolder(this, ROOT_MARKER);
  }
  getAbstractFileByPath(p) {
    const abs = this._abs(p);
    if (!fs.existsSync(abs)) return null;
    const rel = this._rel(abs);
    const st = fs.statSync(abs);
    const node = st.isDirectory() ? new TFolder(this, rel) : new TFile(this, rel);
    return this._wireParent(node);
  }
  getChildren(folder) {
    const abs = this._abs(folder.path);
    if (!fs.statSync(abs).isDirectory()) return [];
    const out = [];
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const rel = this._rel(path.join(abs, e.name));
      const node = e.isDirectory() ? new TFolder(this, rel) : new TFile(this, rel);
      node.parent = folder;
      out.push(node);
    }
    return out;
  }
  async read(file) {
    return fs.promises.readFile(this._abs(file.path), "utf8");
  }
  async create(p, data) {
    const abs = this._abs(p);
    if (fs.existsSync(abs)) throw new Error("file exists: " + p);
    await fs.promises.writeFile(abs, data, "utf8");
    return new TFile(this, this._rel(abs));
  }
  async modify(file, data) {
    await fs.promises.writeFile(this._abs(file.path), data, "utf8");
  }
  async rename(file, newPath) {
    const from = this._abs(file.path);
    const to = this._abs(newPath);
    fs.renameSync(from, to);
  }
  async trash(file) {
    fs.rmSync(this._abs(file.path), { recursive: true, force: true });
  }
}

// Mock Obsidian `app` global + `new Notice`
export function createMockApp(rootDir) {
  const vault = new MockVault(rootDir);
  const notices = [];
  const Notice = class {
    constructor(msg) {
      notices.push(String(msg));
    }
  };
  const app = {
    vault,
    notices,
    Notice,
    // link graph, set by tests: { "srcPath": { "targetPath": count } }
    metadataCache: { resolvedLinks: {} },
    // workspace/plugin scaffolding for Fractal Sync integration tests.
    // Tests wire `executeScript` themselves (see run-tests.mjs T28).
    _syncViews: new Map(), // indexPath -> fake view
    get workspace() {
      const self = this;
      return {
        openLinkText: async (path) => {
          const f = self.vault.getAbstractFileByPath(path);
          if (!f) throw new Error("no file: " + path);
          self._syncViews.set(path, {
            file: f,
            getScene: () => ({ elements: [] }),
            getViewElements: () => [],
            save: async () => {},
          });
        },
        getLeavesOfType: () => [...self._syncViews.entries()].map(([, v]) => ({ view: v })),
      };
    },
    plugins: {
      plugins: {
        "obsidian-excalidraw-plugin": { scriptEngine: { executeScript: null } },
      },
    },
  };
  return app;
}

export function mountGlobals(app) {
  globalThis.app = app;
  globalThis.Notice = app.Notice;
}

export function unmountGlobals() {
  delete globalThis.app;
  delete globalThis.Notice;
}
