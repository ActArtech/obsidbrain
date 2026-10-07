// Mock ExcalidrawAutomate — records element creation the way the real EA does.
// The Fractal Index script runs against this in Node, exactly as the plugin's
// ScriptEngine would run it: new AsyncFunction("ea","utils", body).

export function createMockEA() {
  const ea = {
    // version gate (the real EA provides this; tests run against 2.28.1 behavior)
    verifyMinimumPluginVersion: (min) => true,
    // current style, mirrors EA.style / setStyle()
    style: {
      fontFamily: 1,
      fontSize: 20,
      strokeColor: "#1e1e1e",
      strokeStyle: "solid",
      fillStyle: "solid",
      backgroundColor: "transparent",
    },
    setStyle(patch) {
      Object.assign(ea.style, patch || {});
    },

    // scene = committed elements; buffer = elements created this run
    _scene: new Map(), // id -> element
    _buffer: new Map(), // id -> mutable element

    targetView: null, // set by harness: { file: TFile }
    plugin: null, // set by harness: the plugin mock (scriptEngine) for Sync tests

    getViewElements() {
      return [...ea._scene.values()].filter((el) => !el.isDeleted);
    },
    getElement(id) {
      return ea._buffer.get(id) || null;
    },
    copyViewElementsToEAforEditing(els) {
      for (const el of els) ea._buffer.set(el.id, { ...el });
      return els.map((el) => ea._buffer.get(el.id));
    },
    async addElementsToView() {
      for (const el of ea._buffer.values()) {
        if (el.isDeleted) ea._scene.delete(el.id);
        else ea._scene.set(el.id, el);
      }
      ea._buffer.clear();
    },

    /* ── element factories (mirror EA signatures) ── */
    _base(type) {
      return {
        type,
        id: "r" + Math.random().toString(36).slice(2, 10),
        x: 0, y: 0, width: 0, height: 0,
        angle: 0, strokeColor: ea.style.strokeColor,
        backgroundColor: ea.style.backgroundColor,
        fillStyle: ea.style.fillStyle, strokeWidth: 1,
        strokeStyle: ea.style.strokeStyle, roughness: 1,
        opacity: 100, groupIds: [], frameId: null,
        roundness: null, boundElements: null, locked: false,
        link: null, customData: null, isDeleted: false, seed: 1, version: 1,
      };
    },
    _measure(text, fontSize) {
      const lines = String(text).split("\n");
      const maxChars = Math.max(...lines.map((l) => l.length), 1);
      return {
        w: Math.ceil(maxChars * fontSize * 0.58),
        h: Math.ceil(lines.length * fontSize * 1.28),
      };
    },
    addText(topX, topY, text, formatting = {}, id) {
      const el = ea._base("text");
      el.id = id || el.id;
      el.x = topX; el.y = topY;
      el.text = String(text);
      el.fontSize = ea.style.fontSize;
      el.fontFamily = ea.style.fontFamily;
      el.textAlign = formatting.textAlign || "left";
      const { w, h } = ea._measure(el.text, el.fontSize);
      el.width = formatting.width || w;
      el.height = formatting.height || h;
      el.autoResize = formatting.autoResize ?? true;
      if (formatting.box) {
        const p = formatting.boxPadding ?? 30;
        const box = ea._base(formatting.box === true ? "rectangle" : formatting.box);
        box.x = topX - p; box.y = topY - p;
        box.width = el.width + 2 * p; box.height = el.height + 2 * p;
        box.strokeStyle = "solid";
        if (formatting.boxStrokeColor) box.strokeColor = formatting.boxStrokeColor;
        ea._buffer.set(box.id, box);
        el.boundElementBox = box.id;
        el.containerId = null;
      }
      ea._buffer.set(el.id, el);
      return el.id;
    },
    addToGroup(objectIds) {
      const gid = "g" + Math.random().toString(36).slice(2, 8);
      for (const id of objectIds) {
        const el = ea._buffer.get(id) || ea._scene.get(id);
        if (el) (el.groupIds = el.groupIds || []).push(gid);
      }
      return gid;
    },
    addRect(topX, topY, width, height) {
      const el = ea._base("rectangle");
      el.x = topX; el.y = topY; el.width = width; el.height = height;
      el.strokeStyle = ea.style.strokeStyle;
      ea._buffer.set(el.id, el);
      return el.id;
    },
    addFrame(topX, topY, width, height, name) {
      const el = ea._base("frame");
      el.x = topX; el.y = topY; el.width = width; el.height = height;
      el.name = name; el.strokeColor = "#8b5cf6"; el.roughness = 0;
      ea._buffer.set(el.id, el);
      return el.id;
    },
    addEmbeddable(topX, topY, width, height, url, file) {
      const el = ea._base("embeddable");
      el.x = topX; el.y = topY; el.width = width; el.height = height;
      el.link = file ? `[[${file.path}]]` : url || null;
      ea._buffer.set(el.id, el);
      return el.id;
    },
    addArrow(points, formatting = {}) {
      const el = ea._base("arrow");
      // real EA convention: points are RELATIVE to x/y (which sit at the first point)
      const x0 = points[0][0], y0 = points[0][1];
      el.x = x0; el.y = y0;
      el.points = points.map(([x, y]) => [x - x0, y - y0]);
      el.width = Math.abs(points[points.length - 1][0] - x0);
      el.height = Math.abs(points[points.length - 1][1] - y0);
      if (formatting.strokeColor) el.strokeColor = formatting.strokeColor;
      if (formatting.strokeStyle) el.strokeStyle = formatting.strokeStyle;
      el.startArrowhead = formatting.startArrowHead || null;
      el.endArrowhead = formatting.endArrowHead || "arrow";
      el.elbowed = !!formatting.elbowed;
      el.roundness = null; // caller may override for curves
      ea._buffer.set(el.id, el);
      return el.id;
    },
  };
  return ea;
}
