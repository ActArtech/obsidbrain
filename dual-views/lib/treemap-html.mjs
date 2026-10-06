// Projection 1: functionality-progress treemap (self-contained HTML, Plotly CDN).
// Every tile carries the SAME key used in the story map — that's the cross-view
// contract. `?focus=<key>` dims everything outside the focused chain.

export function renderTreemapHTML(model, rows, { title = "Functionality Progress", storyMapHref = "story-map.excalidraw.md" } = {}) {
  const data = rows.map((r) => ({
    id: r.id || "",
    label: r.label,
    parent: r.parent ?? "",
    value: r.value,
    progress: r.progress,
    done: r.done ?? 0,
    total: r.total ?? 0,
    key: r.key,
  }));
  const overall = model.root.rollup;
  const payload = JSON.stringify({
    title,
    storyMapHref,
    overall: { done: overall.done, total: overall.total },
    data,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"></script>
<style>
  body { margin:0; font-family:'Segoe UI',Helvetica,Arial,sans-serif; background:#fafafa; }
  #bar { padding:10px 16px; display:flex; gap:18px; align-items:center; border-bottom:1px solid #e5e5e5; background:#fff; }
  #bar h1 { font-size:16px; margin:0; }
  #bar .progress { font-size:14px; color:#2e7d32; font-weight:600; }
  #bar a { font-size:13px; color:#2563eb; text-decoration:none; }
  #bar .spacer { flex:1; }
  #chain { font-size:12px; color:#666; padding:6px 16px; background:#fff; border-bottom:1px solid #eee; display:none; }
  #chart { width:100vw; height:calc(100vh - 74px); }
  .legend { display:flex; gap:10px; font-size:12px; color:#555; }
  .legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; }
</style>
</head>
<body>
<div id="bar">
  <h1>${esc(title)}</h1>
  <span class="progress" id="overall"></span>
  <span class="legend">
    <span><i style="background:#2e7d32"></i>done</span>
    <span><i style="background:#f59e0b"></i>in&nbsp;progress</span>
    <span><i style="background:#dc2626"></i>blocked</span>
    <span><i style="background:#9e9e9e"></i>todo</span>
  </span>
  <span class="spacer"></span>
  <input id="search" type="search" placeholder="filter tiles…" style="font-size:13px;padding:4px 8px;border:1px solid #ddd;border-radius:6px;width:180px"/>
  <a href="${esc(storyMapHref)}">story map (Excalidraw) →</a>
</div>
<div id="chain"></div>
<div id="chart"></div>
<script>
const MODEL = ${payload};
const byId = new Map(MODEL.data.map(d => [d.id, d]));
const parentOf = (id) => byId.get(id)?.parent ?? null;
const ancestry = (id) => { const out = []; let k = id; while (k) { out.unshift(k); k = parentOf(k); } return out; };
const descendants = (id) => { const out = []; const walk = (n) => { for (const d of MODEL.data) if (d.parent === n) { out.push(d.id); walk(d.id); } }; walk(id); return out; };

const focused = new URLSearchParams(location.search).get("focus");
const keep = focused ? new Set([...ancestry(focused), focused, ...descendants(focused)]) : null;
const colorOf = (d) => (keep && !keep.has(d.id) ? "#ececec" : ramp(d.progress));

function ramp(p) {
  // red → amber → green on rolled-up leaf progress
  const stops = [[0,[220,38,38]],[0.5,[245,158,11]],[1,[46,125,50]]];
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const [p0,c0] = stops[i-1], [p1,c1] = stops[i];
      const t = (p - p0) / (p1 - p0 || 1);
      const c = c0.map((v,j) => Math.round(v + t * (c1[j] - v)));
      return "rgb(" + c.join(",") + ")";
    }
  }
  return "rgb(46,125,50)";
}

document.getElementById("overall").textContent =
  MODEL.overall.done + " / " + MODEL.overall.total + " leaf tasks done (" +
  Math.round(100 * MODEL.overall.done / Math.max(1, MODEL.overall.total)) + "%)";

const trace = {
  type: "treemap",
  ids: MODEL.data.map(d => d.id),
  labels: MODEL.data.map(d => d.label),
  parents: MODEL.data.map(d => d.parent),
  values: MODEL.data.map(d => d.value),
  branchvalues: "remainder",
  marker: { colors: MODEL.data.map(colorOf), line: { width: 2 } },
  texttemplate: "%{label}",
  hovertemplate: "%{label} — %{customdata[0]} / %{customdata[1]} leaf tasks done · progress %{text}<extra></extra>",
  customdata: MODEL.data.map(d => [d.done, d.total]),
  pathbar: { visible: true },
  level: "",
  tiling: { packing: "squarify" },
  maxdepth: 3,
};

Plotly.newPlot("chart", [trace], {
  margin: { t: 30, l: 0, r: 0, b: 0 },
  font: { family: "Segoe UI, Helvetica, sans-serif", size: 13 },
  paper_bgcolor: "#fafafa",
}, { displayModeBar: false, responsive: true });

document.getElementById("chart").on("plotly_treemapclick", (ev) => {
  const pt = ev.points?.[0];
  if (!pt) return;
  const chain = ancestry(pt.id).map(id => byId.get(id)?.label).join(" → ");
  const el = document.getElementById("chain");
  el.style.display = "block";
  el.innerHTML = "<b>" + escHtml(chain) + "</b> &nbsp; " +
    "<a href='?focus=" + encodeURIComponent(pt.id) + "'>focus this subtree</a> · " +
    "<a href='" + location.pathname + "'>clear</a> · " +
    "<span style='color:#999'>story-map key: <code>" + escHtml(pt.id) + "</code></span>";
});
function escHtml(s){ const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }

/* live search: dim tiles whose label doesn't match (keep their ancestors lit) */
const searchBox = document.getElementById("search");
searchBox.addEventListener("input", () => {
  const q = searchBox.value.trim().toLowerCase();
  const matches = q ? new Set() : null;
  if (q) {
    for (const d of MODEL.data) {
      if (d.label.toLowerCase().includes(q)) {
        matches.add(d.id);
        for (const a of ancestry(d.id)) matches.add(a);
      }
    }
  }
  Plotly.restyle("chart", {
    "marker.colors": [MODEL.data.map(d => {
      if (matches && !matches.has(d.id)) return "#ececec";
      if (keep && !keep.has(d.id)) return "#ececec";
      return ramp(d.progress);
    })],
  });
});
</script>
</body>
</html>
`;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
