// Relationship taxonomy: inferred from link topology, not manual tagging.
// Each type has a distinct visual signature so the map reads as semantics,
// not just "stuff connected to stuff".

export const RELATIONSHIPS = {
  // mutual link (A→B AND B→A) — strongest bond
  resonates: {
    label: "⇄ resonates",
    strokeWidth: 2.5,
    strokeStyle: "solid",
    opacity: 100,
    roundness: 1,
    startArrowhead: "arrow",
    endArrowhead: "arrow",
    color: "#7c3aed", // rich purple
  },
  // same-folder link — peer collaboration
  peer: {
    label: "→ peer",
    strokeWidth: 1.5,
    strokeStyle: "solid",
    opacity: 100,
    roundness: 1,
    startArrowhead: null,
    endArrowhead: "arrow",
    color: "#8b5cf6", // purple
  },
  // pod-to-pod — cross-folder dependency bridge
  bridges: {
    label: "⇢ bridges",
    strokeWidth: 2,
    strokeStyle: "dashed",
    opacity: 70,
    roundness: 1,
    startArrowhead: null,
    endArrowhead: "arrow",
    color: "#2563eb", // blue
  },
  // pod-to-card — parent folder nourishes a file
  nourishes: {
    label: "↳ nourishes",
    strokeWidth: 1.5,
    strokeStyle: "dotted",
    opacity: 70,
    roundness: 1,
    startArrowhead: null,
    endArrowhead: "arrow",
    color: "#7c6f9e", // muted purple
  },
  // card-to-pod — file feeds into a folder
  feeds: {
    label: "↰ feeds",
    strokeWidth: 1,
    strokeStyle: "dotted",
    opacity: 50,
    roundness: 1,
    startArrowhead: null,
    endArrowhead: "arrow",
    color: "#a78bfa", // light purple
  },
};

/**
 * Classify a link edge based on endpoint topology.
 * Returns the relationship type key.
 */
export function classifyRelationship(srcEndpoint, dstEndpoint, isMutual) {
  if (isMutual) return "resonates";
  const srcIsPod = srcEndpoint.endsWith("/");
  const dstIsPod = dstEndpoint.endsWith("/");
  if (srcIsPod && dstIsPod) return "bridges";
  if (srcIsPod && !dstIsPod) return "nourishes";
  if (!srcIsPod && dstIsPod) return "feeds";
  return "peer";
}

/**
 * Compute a small perpendicular offset for parallel arrows
 * (prevents visual overlap when multiple edges share similar direction).
 */
export function parallelOffset(a, b, index, total) {
  if (total <= 1) return { dx: 0, dy: 0 };
  // spread arrows perpendicular to the a→b direction
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  const len = Math.hypot(dx, dy) || 1;
  const spread = 12; // px between parallel arrows
  const offset = (index - (total - 1) / 2) * spread;
  return {
    dx: (-dy / len) * offset,
    dy: (dx / len) * offset,
  };
}
