import type { CompoundPolygon, Point2D, PolygonRing } from './types';
import { signedRingArea } from './shoelace';

/**
 * Offsets a single closed polygon ring along its inward normal by `offsetDistance`.
 * Positive `offsetDistance` shrinks a CCW (positive-area) outer ring inward
 * and expands a CW (negative-area) inner hole outward — accurately compensating laser kerf.
 */
function offsetSingleRing(ring: PolygonRing, offsetDistance: number): PolygonRing {
  const n = ring.length;
  if (n < 3 || Math.abs(offsetDistance) < 1e-6) return ring;

  // Determine orientation: positive area = CCW (inward normal is left of edge)
  const area = signedRingArea(ring);
  const sign = area >= 0 ? 1 : -1;
  // For an outer CCW ring, inward normal of edge (dx, dy) is (-dy, dx).
  // For a CW inner hole, laser burns into the hole boundary, so kerf expands the solid island
  // which means the hole cutout shrinks toward the hole center — wait:
  // A hole cutout in a sheet: the beam removes material outside the intended solid edge,
  // so to make the final hole match the CAD dimension, the laser path must be smaller (offset inward into the hole).
  // For a CW hole ring, (-dy, dx) * (-1) = (dy, -dx) points INTO the solid island (expanding the island = making the cutout narrower).
  const normalSign = sign;

  const result: Point2D[] = [];
  const miterLimit = 2.4;

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

    // Inward unit normals
    const n1x = (-e1y / len1) * normalSign;
    const n1y = (e1x / len1) * normalSign;

    const n2x = (-e2y / len2) * normalSign;
    const n2y = (e2x / len2) * normalSign;

    // Bisector direction
    let bx = n1x + n2x;
    let by = n1y + n2y;
    const bLen = Math.hypot(bx, by);

    if (bLen < 1e-5) {
      result.push({
        x: curr.x + n1x * offsetDistance,
        y: curr.y + n1y * offsetDistance,
      });
      continue;
    }

    bx /= bLen;
    by /= bLen;

    const dot = Math.max(0.25, bx * n1x + by * n1y);
    const miterScale = Math.min(miterLimit, 1 / dot);
    const shift = offsetDistance * miterScale;

    result.push({
      x: curr.x + bx * shift,
      y: curr.y + by * shift,
    });
  }

  // Prevent inverted / collapsed rings when kerf exceeds motif half-width
  const newArea = signedRingArea(result);
  if (Math.sign(newArea) !== Math.sign(area) || Math.abs(newArea) < Math.abs(area) * 0.04) {
    return ring;
  }

  return result;
}

/**
 * Applies laser kerf compensation (total kerf width in mm) to a compound polygon.
 * Shifts contours inward by kerf / 2 in world coordinates (so scaled by instance scale if applied at unit level,
 * or passed as world half-kerf divided by instance scale).
 */
export function applyKerfOffset(rings: CompoundPolygon, halfKerfMm: number): CompoundPolygon {
  if (halfKerfMm <= 1e-5) return rings;
  return rings.map((ring) => offsetSingleRing(ring, halfKerfMm));
}
