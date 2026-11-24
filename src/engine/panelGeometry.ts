import type { PanelShape, Point2D, PolygonRing } from './types';
import { normalizeRingWinding, signedRingArea } from './shoelace';

export const DEFAULT_CUSTOM_POLYGON: Point2D[] = [
  { x: 0.16, y: 0.06 },
  { x: 0.84, y: 0.06 },
  { x: 0.96, y: 0.52 },
  { x: 0.74, y: 0.94 },
  { x: 0.26, y: 0.94 },
  { x: 0.04, y: 0.52 },
];

export function isAnalyticPanelShape(shape: PanelShape): boolean {
  return shape === 'rect' || shape === 'rounded_rect' || shape === 'circle' || shape === 'capsule';
}

/**
 * Offsets a CCW polygon ring inward by `inset` mm using miter-clamped edge normals.
 * Supports both convex and concave polygons safely.
 */
export function insetPolygonRing(ring: PolygonRing, inset: number): PolygonRing {
  const n = ring.length;
  if (n < 3 || inset <= 1e-4) return ring;

  const origArea = signedRingArea(ring);
  const sign = origArea >= 0 ? 1 : -1;
  const miterLimit = 2.6;
  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const curr = ring[i];
    const next = ring[(i + 1) % n];

    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const len1 = Math.hypot(e1x, e1y);

    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const len2 = Math.hypot(e2x, e2y);

    if (len1 < 1e-6 || len2 < 1e-6) {
      result.push({ x: curr.x, y: curr.y });
      continue;
    }

    const n1x = (-e1y / len1) * sign;
    const n1y = (e1x / len1) * sign;
    const n2x = (-e2y / len2) * sign;
    const n2y = (e2x / len2) * sign;

    let bx = n1x + n2x;
    let by = n1y + n2y;
    const bLen = Math.hypot(bx, by);

    if (bLen < 1e-5) {
      result.push({ x: curr.x + n1x * inset, y: curr.y + n1y * inset });
      continue;
    }

    bx /= bLen;
    by /= bLen;
    const dot = Math.max(0.25, bx * n1x + by * n1y);
    const shift = inset * Math.min(miterLimit, 1 / dot);
    result.push({ x: curr.x + bx * shift, y: curr.y + by * shift });
  }

  const newArea = signedRingArea(result);
  if (Math.sign(newArea) !== Math.sign(origArea) || Math.abs(newArea) < Math.abs(origArea) * 0.02) {
    return ring;
  }
  return result;
}

/**
 * Checks whether a CCW polygon ring is convex.
 */
export function isConvexPolygon(ring: PolygonRing): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const c = ring[(i + 2) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-5) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (sign !== s) return false;
    }
  }
  return true;
}

/**
 * Ray-casting point-in-polygon test supporting arbitrary convex & concave polygons.
 */
export function pointInPolygon(x: number, y: number, ring: PolygonRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Exact signed distance from point (x, y) to an arbitrary closed polygon ring.
 * Negative = inside, Positive = outside.
 */
export function signedDistanceToPolygon(x: number, y: number, ring: PolygonRing): number {
  const n = ring.length;
  if (n < 3) return 1e6;

  let minDistSq = Infinity;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy;
    let dSq: number;
    if (lenSq < 1e-10) {
      const dx = x - a.x;
      const dy = y - a.y;
      dSq = dx * dx + dy * dy;
    } else {
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / lenSq));
      const px = a.x + t * vx;
      const py = a.y + t * vy;
      const dx = x - px;
      const dy = y - py;
      dSq = dx * dx + dy * dy;
    }
    if (dSq < minDistSq) minDistSq = dSq;
  }

  const dist = Math.sqrt(minDistSq);
  return pointInPolygon(x, y, ring) ? -dist : dist;
}

/**
 * Generates the exact closed outer outline of the panel (or inset safe margin zone)
 * as a CCW polygon in world millimeter coordinates.
 */
export function buildPanelOutline(
  panelW: number,
  panelH: number,
  shape: PanelShape,
  cornerRadius: number,
  inset = 0,
  customPanelPoints?: Point2D[]
): PolygonRing {
  const w = Math.max(2, panelW - inset * 2);
  const h = Math.max(2, panelH - inset * 2);
  const ox = inset;
  const oy = inset;

  if (shape === 'rect') {
    return normalizeRingWinding(
      [
        { x: ox, y: oy },
        { x: ox + w, y: oy },
        { x: ox + w, y: oy + h },
        { x: ox, y: oy + h },
      ],
      true
    );
  }

  if (shape === 'circle') {
    const cx = panelW * 0.5;
    const cy = panelH * 0.5;
    const rx = w * 0.5;
    const ry = h * 0.5;
    const segs = 72;
    const pts: Point2D[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return normalizeRingWinding(pts, true);
  }

  if (shape === 'rounded_rect' || shape === 'capsule') {
    const maxR = Math.min(w, h) * 0.5;
    const r = shape === 'capsule' ? maxR : Math.min(Math.max(0, cornerRadius - inset), maxR);
    if (r <= 0.5) {
      return normalizeRingWinding(
        [
          { x: ox, y: oy },
          { x: ox + w, y: oy },
          { x: ox + w, y: oy + h },
          { x: ox, y: oy + h },
        ],
        true
      );
    }

    const arcSteps = 12;
    const pts: Point2D[] = [];
    const corners = [
      { cx: ox + w - r, cy: oy + h - r, start: 0, end: Math.PI * 0.5 },
      { cx: ox + r, cy: oy + h - r, start: Math.PI * 0.5, end: Math.PI },
      { cx: ox + r, cy: oy + r, start: Math.PI, end: Math.PI * 1.5 },
      { cx: ox + w - r, cy: oy + r, start: Math.PI * 1.5, end: Math.PI * 2 },
    ];

    for (const c of corners) {
      for (let i = 0; i <= arcSteps; i++) {
        const a = c.start + (i / arcSteps) * (c.end - c.start);
        pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
      }
    }
    return normalizeRingWinding(pts, true);
  }

  // Polygon-based architectural & custom shapes
  let basePoly: PolygonRing;

  if (shape === 'triangle') {
    basePoly = [
      { x: panelW * 0.5, y: 0 },
      { x: panelW, y: panelH },
      { x: 0, y: panelH },
    ];
  } else if (shape === 'hexagon') {
    basePoly = [
      { x: panelW * 0.25, y: 0 },
      { x: panelW * 0.75, y: 0 },
      { x: panelW, y: panelH * 0.5 },
      { x: panelW * 0.75, y: panelH },
      { x: panelW * 0.25, y: panelH },
      { x: 0, y: panelH * 0.5 },
    ];
  } else if (shape === 'octagon') {
    const c = 0.2929;
    basePoly = [
      { x: panelW * c, y: 0 },
      { x: panelW * (1 - c), y: 0 },
      { x: panelW, y: panelH * c },
      { x: panelW, y: panelH * (1 - c) },
      { x: panelW * (1 - c), y: panelH },
      { x: panelW * c, y: panelH },
      { x: 0, y: panelH * (1 - c) },
      { x: 0, y: panelH * c },
    ];
  } else if (shape === 'arch') {
    const rx = panelW * 0.5;
    const ry = Math.min(panelW * 0.5, panelH * 0.55);
    const arcSteps = 32;
    const pts: Point2D[] = [{ x: 0, y: panelH }];
    for (let i = 0; i <= arcSteps; i++) {
      const a = Math.PI + (i / arcSteps) * Math.PI; // PI -> 2*PI (left to right over top)
      pts.push({
        x: rx + Math.cos(a) * rx,
        y: ry + Math.sin(a) * ry,
      });
    }
    pts.push({ x: panelW, y: panelH });
    basePoly = pts;
  } else if (shape === 'l_shape') {
    basePoly = [
      { x: 0, y: 0 },
      { x: panelW * 0.46, y: 0 },
      { x: panelW * 0.46, y: panelH * 0.52 },
      { x: panelW, y: panelH * 0.52 },
      { x: panelW, y: panelH },
      { x: 0, y: panelH },
    ];
  } else {
    // custom_polygon or custom_svg
    const src =
      customPanelPoints && customPanelPoints.length >= 3
        ? customPanelPoints
        : DEFAULT_CUSTOM_POLYGON;
    basePoly = src.map((p) => ({
      x: p.x * panelW,
      y: p.y * panelH,
    }));
  }

  const normalized = normalizeRingWinding(basePoly, true);
  return inset > 0.01 ? insetPolygonRing(normalized, inset) : normalized;
}

/**
 * Signed distance from point (x, y) to the inset panel boundary.
 * Negative = strictly inside the safe region; Positive = outside.
 */
export function signedDistanceToSafeBoundary(
  x: number,
  y: number,
  panelW: number,
  panelH: number,
  shape: PanelShape,
  cornerRadius: number,
  margin: number,
  safeBoundaryOutline?: PolygonRing
): number {
  if (!isAnalyticPanelShape(shape) && safeBoundaryOutline && safeBoundaryOutline.length >= 3) {
    return signedDistanceToPolygon(x, y, safeBoundaryOutline);
  }

  const cx = panelW * 0.5;
  const cy = panelH * 0.5;
  const hw = Math.max(0.5, panelW * 0.5 - margin);
  const hh = Math.max(0.5, panelH * 0.5 - margin);
  const px = Math.abs(x - cx);
  const py = Math.abs(y - cy);

  if (shape === 'rect') {
    const qx = px - hw;
    const qy = py - hh;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
  }

  if (shape === 'circle') {
    // Handle both circle and ellipse cleanly
    if (Math.abs(hw - hh) < 0.01) {
      return Math.hypot(px, py) - hw;
    }
    const nx = px / hw;
    const ny = py / hh;
    const k = Math.hypot(nx, ny);
    if (k < 1e-6) return -Math.min(hw, hh);
    const scale = (k - 1) / k;
    return Math.hypot(px * scale, py * scale) * (k >= 1 ? 1 : -1);
  }

  const maxR = Math.min(hw, hh);
  const r = shape === 'capsule' ? maxR : Math.min(Math.max(0, cornerRadius - margin), maxR);
  const qx = px - (hw - r);
  const qy = py - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Sutherland-Hodgman polygon clipping of a subject ring against a convex CCW clip boundary.
 * Used for `edgeClipMode === 'boundary_clip'` so cutouts slice cleanly along the margin edge.
 */
export function clipRingToConvexBoundary(
  subject: PolygonRing,
  clipBoundary: PolygonRing
): PolygonRing {
  let output = subject;
  const clipCount = clipBoundary.length;
  if (output.length < 3 || clipCount < 3) return [];

  for (let i = 0; i < clipCount; i++) {
    const a = clipBoundary[i];
    const b = clipBoundary[(i + 1) % clipCount];
    const input = output;
    output = [];
    if (input.length === 0) break;

    const edgeDx = b.x - a.x;
    const edgeDy = b.y - a.y;

    const isInside = (p: Point2D) => edgeDx * (p.y - a.y) - edgeDy * (p.x - a.x) >= -1e-6;

    const intersect = (p1: Point2D, p2: Point2D): Point2D => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const denom = edgeDx * dy - edgeDy * dx;
      if (Math.abs(denom) < 1e-10) return p2;
      const t = (edgeDx * (a.y - p1.y) - edgeDy * (a.x - p1.x)) / denom;
      return {
        x: p1.x + t * dx,
        y: p1.y + t * dy,
      };
    };

    let s = input[input.length - 1];
    let sInside = isInside(s);

    for (let j = 0; j < input.length; j++) {
      const e = input[j];
      const eInside = isInside(e);

      if (eInside) {
        if (!sInside) {
          output.push(intersect(s, e));
        }
        output.push(e);
      } else if (sInside) {
        output.push(intersect(s, e));
      }

      s = e;
      sInside = eInside;
    }
  }

  return output.length >= 3 ? output : [];
}
