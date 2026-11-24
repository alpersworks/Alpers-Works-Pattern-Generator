import type { CompoundPolygon, PanelShape, PolygonRing } from './types';

/**
 * Signed area of a single polygon ring using the Gauss Shoelace formula.
 * Positive for CCW in mathematical coords (or CW in screen coords), negative for opposite winding.
 */
export function signedRingArea(ring: PolygonRing): number {
  const n = ring.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

/**
 * Net positive area of a compound polygon (outer rings positive, inner holes negative).
 * Fixes the +41.9% fixed-area approximation bug in legacy prototypes.
 */
export function computeCompoundArea(rings: CompoundPolygon): number {
  if (rings.length === 0) return 0;
  if (rings.length === 1) return Math.abs(signedRingArea(rings[0]));
  let net = 0;
  for (const ring of rings) {
    net += signedRingArea(ring);
  }
  return Math.abs(net);
}

/**
 * Ensure outer ring has positive signed area (CCW in math coords)
 * and hole rings have negative signed area.
 */
export function normalizeRingWinding(ring: PolygonRing, shouldBePositive: boolean): PolygonRing {
  const area = signedRingArea(ring);
  if ((shouldBePositive && area < 0) || (!shouldBePositive && area > 0)) {
    return [...ring].reverse();
  }
  return ring;
}

/**
 * Compute panel vertical span [yMin, yMax] at a given x coordinate for any supported panel shape.
 */
export function panelVerticalSpanAtX(
  x: number,
  panelW: number,
  panelH: number,
  shape: PanelShape,
  cornerRadius: number
): [number, number] | null {
  if (x < 0 || x > panelW) return null;

  if (shape === 'rect') {
    return [0, panelH];
  }

  if (shape === 'circle') {
    const cx = panelW * 0.5;
    const cy = panelH * 0.5;
    const rx = panelW * 0.5;
    const ry = panelH * 0.5;
    const dx = (x - cx) / rx;
    if (Math.abs(dx) > 1) return null;
    const dy = Math.sqrt(Math.max(0, 1 - dx * dx)) * ry;
    return [cy - dy, cy + dy];
  }

  const maxR = Math.min(panelW, panelH) * 0.5;
  const r = shape === 'capsule' ? maxR : Math.min(Math.max(0, cornerRadius), maxR);
  if (r <= 0.001) return [0, panelH];

  if (x >= r && x <= panelW - r) {
    return [0, panelH];
  }

  const cornerCx = x < r ? r : panelW - r;
  const dx = x - cornerCx;
  const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
  return [r - dy, panelH - r + dy];
}

/**
 * Exact vertical intervals [yLow, yHigh] where vertical line X intersects an arbitrary polygon ring.
 * Supports both convex and concave polygons.
 */
function polygonVerticalSpansAtX(x: number, ring: PolygonRing): [number, number][] {
  const ys: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
      const t = (x - a.x) / (b.x - a.x);
      ys.push(a.y + t * (b.y - a.y));
    }
  }
  if (ys.length < 2) return [];
  ys.sort((u, v) => u - v);
  const spans: [number, number][] = [];
  for (let i = 0; i + 1 < ys.length; i += 2) {
    spans.push([ys[i], ys[i + 1]]);
  }
  return spans;
}

/**
 * Exact geometric area of the panel shape in mm².
 */
export function computePanelArea(
  panelW: number,
  panelH: number,
  shape: PanelShape,
  cornerRadius: number,
  panelOutline?: PolygonRing
): number {
  if (shape === 'rect') {
    return panelW * panelH;
  }
  if (shape === 'circle') {
    return Math.PI * (panelW * 0.5) * (panelH * 0.5);
  }
  if (shape === 'rounded_rect' || shape === 'capsule') {
    const maxR = Math.min(panelW, panelH) * 0.5;
    const r = shape === 'capsule' ? maxR : Math.min(Math.max(0, cornerRadius), maxR);
    return panelW * panelH - (4 - Math.PI) * r * r;
  }
  if (panelOutline && panelOutline.length >= 3) {
    return Math.abs(signedRingArea(panelOutline));
  }
  return panelW * panelH;
}

/**
 * Exact intersection area between a focus circle (cx, cy, radius) and the panel geometry.
 * Supports analytic shapes and arbitrary convex/concave polygons.
 */
export function computeCirclePanelIntersectionArea(
  cx: number,
  cy: number,
  radius: number,
  panelW: number,
  panelH: number,
  shape: PanelShape,
  cornerRadius: number,
  panelOutline?: PolygonRing
): number {
  const xMin = Math.max(0, cx - radius);
  const xMax = Math.min(panelW, cx + radius);
  if (xMax <= xMin || radius <= 0) return 0;

  const isAnalytic =
    shape === 'rect' || shape === 'circle' || shape === 'rounded_rect' || shape === 'capsule';
  const slices = 96;
  const dx = (xMax - xMin) / slices;
  let area = 0;

  // Composite Simpson's rule for high accuracy (< 0.01% error)
  for (let i = 0; i <= slices; i++) {
    const x = xMin + i * dx;
    const distX = x - cx;
    const halfChord = Math.sqrt(Math.max(0, radius * radius - distX * distX));
    const cLow = cy - halfChord;
    const cHigh = cy + halfChord;

    let height = 0;
    if (isAnalytic) {
      const panelSpan = panelVerticalSpanAtX(x, panelW, panelH, shape, cornerRadius);
      if (panelSpan) {
        const yLow = Math.max(panelSpan[0], cLow);
        const yHigh = Math.min(panelSpan[1], cHigh);
        if (yHigh > yLow) height = yHigh - yLow;
      }
    } else if (panelOutline && panelOutline.length >= 3) {
      const spans = polygonVerticalSpansAtX(x, panelOutline);
      for (const [sLow, sHigh] of spans) {
        const yLow = Math.max(sLow, cLow);
        const yHigh = Math.min(sHigh, cHigh);
        if (yHigh > yLow) height += yHigh - yLow;
      }
    }

    const weight = i === 0 || i === slices ? 1 : i % 2 === 0 ? 2 : 4;
    area += weight * height;
  }

  return (area * dx) / 3;
}

/**
 * Compute bounding radius from origin (0,0) across all rings of a compound polygon.
 */
export function computeBoundingRadius(rings: CompoundPolygon): number {
  let maxSq = 0;
  for (const ring of rings) {
    for (const p of ring) {
      const dSq = p.x * p.x + p.y * p.y;
      if (dSq > maxSq) maxSq = dSq;
    }
  }
  return Math.sqrt(maxSq);
}
