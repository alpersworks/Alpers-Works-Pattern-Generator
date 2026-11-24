import type { BuiltInMotifId, CompoundPolygon, PivotMode, Point2D, PolygonRing } from '../engine/types';
import { normalizeRingWinding } from '../engine/shoelace';

export interface BuiltInMotifDefinition {
  id: BuiltInMotifId;
  category: 'geometric' | 'architectural';
  rings: CompoundPolygon;
}

function makeCircleRing(radius: number, segments = 32): PolygonRing {
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return normalizeRingWinding(pts, true);
}

function makeRegularPolygon(sides: number, radius: number, startAngleRad = 0): PolygonRing {
  const pts: Point2D[] = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngleRad + (i / sides) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return normalizeRingWinding(pts, true);
}

function makeRoundedRectRing(w: number, h: number, r: number, arcSteps = 6): PolygonRing {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw, hh);
  const pts: Point2D[] = [];

  const corners = [
    { cx: hw - cr, cy: hh - cr, start: 0, end: Math.PI * 0.5 },
    { cx: -hw + cr, cy: hh - cr, start: Math.PI * 0.5, end: Math.PI },
    { cx: -hw + cr, cy: -hh + cr, start: Math.PI, end: Math.PI * 1.5 },
    { cx: hw - cr, cy: -hh + cr, start: Math.PI * 1.5, end: Math.PI * 2 },
  ];

  for (const c of corners) {
    for (let i = 0; i <= arcSteps; i++) {
      const a = c.start + (i / arcSteps) * (c.end - c.start);
      pts.push({ x: c.cx + Math.cos(a) * cr, y: c.cy + Math.sin(a) * cr });
    }
  }
  return normalizeRingWinding(pts, true);
}

function makeStar4Ring(outerR: number, innerR: number): PolygonRing {
  const pts: Point2D[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / 8) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return normalizeRingWinding(pts, true);
}

function makeChamferSlotRing(w: number, h: number, chamfer: number): PolygonRing {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const c = Math.min(chamfer, hw * 0.6, hh * 0.8);
  const pts: Point2D[] = [
    { x: -hw + c, y: -hh },
    { x: hw - c, y: -hh },
    { x: hw, y: -hh + c },
    { x: hw, y: hh - c },
    { x: hw - c, y: hh },
    { x: -hw + c, y: hh },
    { x: -hw, y: hh - c },
    { x: -hw, y: -hh + c },
  ];
  return normalizeRingWinding(pts, true);
}

function makeChevronRing(w: number, h: number): PolygonRing {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const tip = w * 0.24;
  const pts: Point2D[] = [
    { x: -hw, y: -hh },
    { x: hw - tip, y: -hh },
    { x: hw, y: 0 },
    { x: hw - tip, y: hh },
    { x: -hw, y: hh },
    { x: -hw + tip, y: 0 },
  ];
  return normalizeRingWinding(pts, true);
}

function makeTrapezoidRing(w: number, h: number): PolygonRing {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const taper = w * 0.16;
  const pts: Point2D[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh + taper * 0.35 },
    { x: hw, y: hh - taper * 0.35 },
    { x: -hw, y: hh },
  ];
  return normalizeRingWinding(pts, true);
}

export const BUILT_IN_MOTIFS: Record<BuiltInMotifId, BuiltInMotifDefinition> = {
  circle: {
    id: 'circle',
    category: 'geometric',
    rings: [makeCircleRing(9.5, 32)],
  },
  hexagon: {
    id: 'hexagon',
    category: 'geometric',
    rings: [makeRegularPolygon(6, 10.2, Math.PI / 6)],
  },
  square: {
    id: 'square',
    category: 'geometric',
    rings: [makeRoundedRectRing(15.5, 15.5, 0, 1)],
  },
  rounded_square: {
    id: 'rounded_square',
    category: 'geometric',
    rings: [makeRoundedRectRing(16.5, 16.5, 4.2, 6)],
  },
  diamond: {
    id: 'diamond',
    category: 'geometric',
    rings: [
      normalizeRingWinding(
        [
          { x: 0, y: -7.5 },
          { x: 11.5, y: 0 },
          { x: 0, y: 7.5 },
          { x: -11.5, y: 0 },
        ],
        true
      ),
    ],
  },
  star_4: {
    id: 'star_4',
    category: 'geometric',
    rings: [makeStar4Ring(10.5, 4.4)],
  },
  capsule_slot: {
    id: 'capsule_slot',
    category: 'architectural',
    rings: [makeRoundedRectRing(20, 9.5, 4.75, 8)],
  },
  chamfer_slot: {
    id: 'chamfer_slot',
    category: 'architectural',
    rings: [makeChamferSlotRing(22, 11, 3.2)],
  },
  chevron: {
    id: 'chevron',
    category: 'architectural',
    rings: [makeChevronRing(22, 10.5)],
  },
  trapezoid: {
    id: 'trapezoid',
    category: 'architectural',
    rings: [makeTrapezoidRing(21, 11)],
  },
};

export const BUILT_IN_MOTIF_LIST: BuiltInMotifId[] = [
  'circle',
  'hexagon',
  'square',
  'rounded_square',
  'diamond',
  'star_4',
  'capsule_slot',
  'chamfer_slot',
  'chevron',
  'trapezoid',
];

/**
 * Shift motif coordinates horizontally based on pivot mode (Left / Center / Right).
 */
export function applyPivotToRings(rings: CompoundPolygon, pivot: PivotMode): CompoundPolygon {
  if (pivot === 'center' || rings.length === 0) return rings;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
  }
  const shiftX = pivot === 'left' ? -minX : -maxX;
  return rings.map((ring) => ring.map((p) => ({ x: p.x + shiftX, y: p.y })));
}
