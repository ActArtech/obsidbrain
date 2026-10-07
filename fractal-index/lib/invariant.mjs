// Zero-overlap invariant: rectangle intersection among placed components.
// Touching edges are allowed (share an edge = gap of 0); any interior
// intersection throws with a precise diagnostic.

export function rectsIntersect(a, b, epsilon = 0.5) {
  return (
    a.x + a.w > b.x + epsilon && b.x + b.w > a.x + epsilon &&
    a.y + a.h > b.y + epsilon && b.y + b.h > a.y + epsilon
  );
}

export function assertNoOverlap(bounds) {
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      if (rectsIntersect(bounds[i], bounds[j])) {
        throw new Error(
          `layout overlap: [${bounds[i].label}] (${Math.round(bounds[i].x)},${Math.round(bounds[i].y)} ` +
          `${Math.round(bounds[i].w)}×${Math.round(bounds[i].h)}) intersects ` +
          `[${bounds[j].label}] (${Math.round(bounds[j].x)},${Math.round(bounds[j].y)} ` +
          `${Math.round(bounds[j].w)}×${Math.round(bounds[j].h)})`
        );
      }
    }
  }
}
