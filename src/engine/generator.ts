import type {
  Attractor,
  CompoundPolygon,
  CustomSvgMotifData,
  ImageLuminanceGrid,
  PatternInstance,
  PatternResult,
  PatternState,
  Point2D,
} from './types';
import { BUILT_IN_MOTIFS, applyPivotToRings } from '../motifs/motifs';
import { applyKerfOffset } from './kerf';
import { createMulberry32 } from './mulberry32';
import {
  computeBoundingRadius,
  computeCirclePanelIntersectionArea,
  computeCompoundArea,
  computePanelArea,
} from './shoelace';
import {
  buildPanelOutline,
  clipRingToConvexBoundary,
  isAnalyticPanelShape,
  isConvexPolygon,
  signedDistanceToSafeBoundary,
} from './panelGeometry';
import { analyzeBridgesSpatialHash } from './spatialHash';
import { sampleImageModulation } from './imageMap';

const MAX_INSTANCES = 16000;

interface CandidatePoint {
  x: number;
  y: number;
  flowAngle: number;
}

/**
 * C¹ Continuous Adaptive Radial Edge Compression.
 * Derivative starts at 1.0 at center (r=0), transitions smoothly to k (edgeSpacingRatio) at r=R,
 * and stays constant at k for r > R with zero density discontinuity.
 */
export function warpPointC1(
  dx: number,
  dy: number,
  R: number,
  k: number
): { x: number; y: number } {
  if (Math.abs(k - 1) < 1e-4 || R <= 1) {
    return { x: dx, y: dy };
  }
  const r = Math.hypot(dx, dy);
  if (r < 1e-6) return { x: 0, y: 0 };

  let rPrime: number;
  if (r <= R) {
    rPrime = r - ((1 - k) / (2 * R)) * r * r;
  } else {
    rPrime = (R * (1 + k)) * 0.5 + k * (r - R);
  }
  const ratio = rPrime / r;
  return { x: dx * ratio, y: dy * ratio };
}

function hermiteSmoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { dist: number; dirX: number; dirY: number } {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-8) {
    const dx = px - ax;
    const dy = py - ay;
    const dist = Math.hypot(dx, dy);
    return { dist, dirX: dist > 1e-6 ? dx / dist : 1, dirY: dist > 1e-6 ? dy / dist : 0 };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  const cx = ax + t * vx;
  const cy = ay + t * vy;
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.hypot(dx, dy);
  return { dist, dirX: dist > 1e-6 ? dx / dist : 1, dirY: dist > 1e-6 ? dy / dist : 0 };
}

function evaluateAttractorField(
  x: number,
  y: number,
  attractors: Attractor[],
  panelW: number,
  panelH: number
): { influence: number; radialAngle: number; nearestDist: number } {
  if (attractors.length === 0) {
    const dx = x - panelW * 0.5;
    const dy = y - panelH * 0.5;
    return { influence: 0, radialAngle: Math.atan2(dy, dx), nearestDist: Math.hypot(dx, dy) };
  }

  let combinedInfluence = 0;
  let dominantDist = Infinity;
  let dominantAngle = 0;

  for (let i = 0; i < attractors.length; i++) {
    const a = attractors[i];
    const ax = a.x * panelW;
    const ay = a.y * panelH;
    let dist: number;
    let angle: number;

    if (a.type === 'line' && a.x2 !== undefined && a.y2 !== undefined) {
      const bx = a.x2 * panelW;
      const by = a.y2 * panelH;
      const seg = pointToSegmentDistance(x, y, ax, ay, bx, by);
      dist = seg.dist;
      angle = Math.atan2(seg.dirY, seg.dirX);
    } else {
      const dx = x - ax;
      const dy = y - ay;
      dist = Math.hypot(dx, dy);
      angle = Math.atan2(dy, dx);
    }

    if (dist < dominantDist) {
      dominantDist = dist;
      dominantAngle = angle;
    }

    const r = Math.max(10, a.radius);
    const norm = dist / r;
    let factor = 0;
    if (a.falloff === 'linear') {
      factor = Math.max(0, 1 - norm);
    } else if (a.falloff === 'gaussian') {
      factor = Math.exp(-norm * norm * 2.2);
    } else {
      // Smoothstep (default Hermite 3t^2 - 2t^3)
      factor = 1 - hermiteSmoothstep(norm);
    }

    const weighted = factor * a.weight;
    if (weighted > combinedInfluence) {
      combinedInfluence = weighted;
    }
  }

  return {
    influence: Math.max(0, Math.min(1.5, combinedInfluence)),
    radialAngle: dominantAngle,
    nearestDist: dominantDist,
  };
}

/**
 * Generate raw candidate points in panel millimeter space for all 8 topologies,
 * applying C¹ continuous radial edge compression around the primary attractor.
 */
function generateCandidates(state: PatternState): CandidatePoint[] {
  const {
    panelW,
    panelH,
    topology,
    pitch,
    transitionRadius,
    edgeSpacingRatio,
    waveAmplitude,
    waveFrequency,
    vortexTwist,
    attractors,
  } = state;

  const safePitch = Math.max(5, pitch);
  const primary = attractors[0] ?? {
    id: 'default',
    type: 'point' as const,
    x: 0.5,
    y: 0.5,
    radius: transitionRadius,
    weight: 1,
    falloff: 'smoothstep' as const,
  };

  const fx = primary.x * panelW;
  const fy = primary.y * panelH;

  // Compute max distance from focus to any panel corner
  const maxCornerDist = Math.max(
    Math.hypot(fx, fy),
    Math.hypot(panelW - fx, fy),
    Math.hypot(fx, panelH - fy),
    Math.hypot(panelW - fx, panelH - fy)
  );

  // When edgeSpacingRatio < 1, points are pulled inward, so we must generate unwarped lattice farther out
  const k = Math.max(0.35, Math.min(1.35, edgeSpacingRatio));
  const R = Math.max(20, transitionRadius);
  const invExtentFactor = k < 1 ? 1 / k : 1;
  const unwarpedRadius = maxCornerDist * invExtentFactor + safePitch * 3;

  const candidates: CandidatePoint[] = [];

  const pushWarped = (ux: number, uy: number, flowAngle: number) => {
    const warped = warpPointC1(ux, uy, R, k);
    const wx = fx + warped.x;
    const wy = fy + warped.y;
    // Quick bounding cull with generous margin for clipping/complete modes
    const pad = safePitch * 2.5;
    if (wx >= -pad && wx <= panelW + pad && wy >= -pad && wy <= panelH + pad) {
      candidates.push({ x: wx, y: wy, flowAngle });
    }
  };

  if (topology === 'hexagonal') {
    const dxStep = safePitch;
    const dyStep = safePitch * (Math.sqrt(3) * 0.5);
    const cols = Math.ceil(unwarpedRadius / dxStep) + 1;
    const rows = Math.ceil(unwarpedRadius / dyStep) + 1;

    for (let r = -rows; r <= rows; r++) {
      const xOffset = (Math.abs(r) % 2) * (dxStep * 0.5);
      const uy = r * dyStep;
      for (let c = -cols; c <= cols; c++) {
        const ux = c * dxStep + xOffset;
        pushWarped(ux, uy, 0);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'square_grid') {
    const step = safePitch;
    const cols = Math.ceil(unwarpedRadius / step) + 1;
    const rows = Math.ceil(unwarpedRadius / step) + 1;

    for (let r = -rows; r <= rows; r++) {
      const uy = r * step;
      for (let c = -cols; c <= cols; c++) {
        pushWarped(c * step, uy, 0);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'staggered_matrix') {
    const dxStep = safePitch * 1.1;
    const dyStep = safePitch * 0.78;
    const cols = Math.ceil(unwarpedRadius / dxStep) + 1;
    const rows = Math.ceil(unwarpedRadius / dyStep) + 1;

    for (let r = -rows; r <= rows; r++) {
      const xOffset = ((r % 3) + 3) % 3 * (dxStep / 3);
      const uy = r * dyStep;
      for (let c = -cols; c <= cols; c++) {
        pushWarped(c * dxStep + xOffset, uy, 0);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'diamond_matrix') {
    // 45-degree parametric G-Matrix lattice
    const dxStep = safePitch * 1.25;
    const dyStep = safePitch * 0.72;
    const cols = Math.ceil(unwarpedRadius / dxStep) + 1;
    const rows = Math.ceil(unwarpedRadius / dyStep) + 1;

    for (let r = -rows; r <= rows; r++) {
      const xOffset = (Math.abs(r) % 2) * (dxStep * 0.5);
      const uy = r * dyStep;
      for (let c = -cols; c <= cols; c++) {
        const ux = c * dxStep + xOffset;
        const flowAngle = (r % 2 === 0 ? 1 : -1) * (Math.PI / 6);
        pushWarped(ux, uy, flowAngle);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'wave_flow') {
    const dxStep = safePitch;
    const dyStep = safePitch * 0.92;
    const cols = Math.ceil(unwarpedRadius / dxStep) + 2;
    const rows = Math.ceil(unwarpedRadius / dyStep) + 2;
    const freq = (Math.PI * 2 * Math.max(0.2, waveFrequency)) / Math.max(120, panelW);
    const amp = waveAmplitude;

    for (let r = -rows; r <= rows; r++) {
      const baseY = r * dyStep;
      for (let c = -cols; c <= cols; c++) {
        const ux = c * dxStep + (Math.abs(r) % 2) * (dxStep * 0.5);
        const phase = (fx + ux) * freq;
        const uy = baseY + Math.sin(phase) * amp;
        const slope = Math.cos(phase) * amp * freq;
        const flowAngle = Math.atan(slope);
        pushWarped(ux, uy, flowAngle);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'vortex') {
    const ringStep = safePitch * 0.95;
    const maxRings = Math.ceil(unwarpedRadius / ringStep) + 1;
    // Center point
    pushWarped(0, 0, 0);

    for (let ring = 1; ring <= maxRings; ring++) {
      const radius = ring * ringStep;
      const circumference = 2 * Math.PI * radius;
      const count = Math.max(6, Math.round(circumference / safePitch));
      const twistOffset = (radius / Math.max(100, R)) * vortexTwist;

      for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2 + twistOffset;
        const ux = Math.cos(theta) * radius;
        const uy = Math.sin(theta) * radius;
        const tangentAngle = theta + Math.PI * 0.5 + Math.atan(vortexTwist * 0.25);
        pushWarped(ux, uy, tangentAngle);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'fibonacci') {
    // Dynamic point count derived from panel corner distance — fixes the 1600-point hard cap bug!
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const cScale = safePitch * 0.56;
    const neededN = Math.min(
      MAX_INSTANCES,
      Math.ceil((unwarpedRadius / cScale) * (unwarpedRadius / cScale)) + 12
    );

    for (let n = 0; n < neededN; n++) {
      const r = cScale * Math.sqrt(n);
      const theta = n * goldenAngle;
      const ux = Math.cos(theta) * r;
      const uy = Math.sin(theta) * r;
      pushWarped(ux, uy, theta + Math.PI * 0.5);
      if (candidates.length >= MAX_INSTANCES) return candidates;
    }
  } else if (topology === 'concentric_radial') {
    const ringStep = safePitch;
    const maxRings = Math.ceil(unwarpedRadius / ringStep) + 1;
    pushWarped(0, 0, 0);

    for (let ring = 1; ring <= maxRings; ring++) {
      const radius = ring * ringStep;
      const circumference = 2 * Math.PI * radius;
      const count = Math.max(6, Math.round(circumference / safePitch));
      const halfPhase = ring % 2 === 1 ? Math.PI / count : 0;

      for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2 + halfPhase;
        const ux = Math.cos(theta) * radius;
        const uy = Math.sin(theta) * radius;
        pushWarped(ux, uy, theta);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'diagonal_stripes') {
    const laneStep = safePitch * 1.15;
    const alongStep = safePitch * 0.88;
    const diagCos = Math.SQRT1_2;
    const diagSin = Math.SQRT1_2;
    const cols = Math.ceil(unwarpedRadius / alongStep) + 2;
    const rows = Math.ceil(unwarpedRadius / laneStep) + 2;

    for (let r = -rows; r <= rows; r++) {
      const shift = (Math.abs(r) % 2) * (alongStep * 0.5);
      const localY = r * laneStep;
      for (let c = -cols; c <= cols; c++) {
        const localX = c * alongStep + shift;
        const ux = localX * diagCos - localY * diagSin;
        const uy = localX * diagSin + localY * diagCos;
        pushWarped(ux, uy, Math.PI * 0.25);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'sine_interference') {
    const dxStep = safePitch;
    const dyStep = safePitch;
    const cols = Math.ceil(unwarpedRadius / dxStep) + 2;
    const rows = Math.ceil(unwarpedRadius / dyStep) + 2;
    const freqX = (Math.PI * 2 * Math.max(0.4, waveFrequency)) / Math.max(160, panelW);
    const freqY = (Math.PI * 2 * Math.max(0.4, waveFrequency * 0.85)) / Math.max(160, panelH);
    const amp = Math.max(8, waveAmplitude * 0.65);

    for (let r = -rows; r <= rows; r++) {
      const baseY = r * dyStep;
      for (let c = -cols; c <= cols; c++) {
        const baseX = c * dxStep;
        const px = fx + baseX;
        const py = fy + baseY;
        const ux = baseX + Math.sin(py * freqY) * amp;
        const uy = baseY + Math.sin(px * freqX) * amp;
        const flowAngle = Math.atan2(Math.cos(px * freqX) * amp * freqX, 1 + Math.cos(py * freqY) * amp * freqY);
        pushWarped(ux, uy, flowAngle);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'sunburst_rays') {
    const ringStep = safePitch * 1.02;
    const maxRings = Math.ceil(unwarpedRadius / ringStep) + 1;
    const spokeCount = Math.max(12, Math.min(72, Math.round((2 * Math.PI * Math.max(120, R)) / (safePitch * 1.35))));
    pushWarped(0, 0, 0);

    for (let ring = 1; ring <= maxRings; ring++) {
      const radius = ring * ringStep;
      // Subdivide rays cleanly as radius grows so outer rays stay balanced
      const mult = radius > R * 1.4 ? 2 : 1;
      const count = spokeCount * mult;
      for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2;
        const ux = Math.cos(theta) * radius;
        const uy = Math.sin(theta) * radius;
        pushWarped(ux, uy, theta);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  } else if (topology === 'organic_voronoi') {
    const dxStep = safePitch * 1.04;
    const dyStep = safePitch * 0.9;
    const cols = Math.ceil(unwarpedRadius / dxStep) + 1;
    const rows = Math.ceil(unwarpedRadius / dyStep) + 1;
    const cellRand = createMulberry32((state.seed ^ 0x9e3779b9) >>> 0);

    for (let r = -rows; r <= rows; r++) {
      const xOffset = (Math.abs(r) % 2) * (dxStep * 0.5);
      const baseY = r * dyStep;
      for (let c = -cols; c <= cols; c++) {
        const jx = (cellRand() * 2 - 1) * safePitch * 0.34;
        const jy = (cellRand() * 2 - 1) * safePitch * 0.34;
        const angle = cellRand() * Math.PI * 2;
        pushWarped(c * dxStep + xOffset + jx, baseY + jy, angle);
        if (candidates.length >= MAX_INSTANCES) return candidates;
      }
    }
  }

  return candidates;
}

function transformRingsToWorld(
  baseRings: CompoundPolygon,
  x: number,
  y: number,
  angle: number,
  scale: number
): CompoundPolygon {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return baseRings.map((ring) =>
    ring.map((p) => {
      const sx = p.x * scale;
      const sy = p.y * scale;
      return {
        x: x + sx * cos - sy * sin,
        y: y + sx * sin + sy * cos,
      };
    })
  );
}

/**
 * Pure TypeScript parametric pattern generator.
 * Produces DOM-independent instance transforms, exact Shoelace OAR, and Spatial Hash DFM metrics.
 */
export function generatePattern(
  state: PatternState,
  customMotif: CustomSvgMotifData | null,
  imageGrid: ImageLuminanceGrid | null
): PatternResult {
  const t0 = performance.now();

  // 1. Resolve base motif rings, apply pivot & laser kerf compensation
  let rawRings: CompoundPolygon;
  if (state.motifId === 'custom_svg' && customMotif && customMotif.rings.length > 0) {
    rawRings = customMotif.rings;
  } else {
    const fallbackId =
      state.motifId === 'custom_svg' ? 'circle' : state.motifId;
    rawRings = BUILT_IN_MOTIFS[fallbackId].rings;
  }

  const pivotedRings = applyPivotToRings(rawRings, state.pivot);
  // Apply half-kerf inward offset scaled against average centerScale so preview & export reflect kerf directly
  const unitHalfKerf = state.kerf > 0 ? (state.kerf * 0.5) / Math.max(0.25, state.centerScale) : 0;
  const baseRings = unitHalfKerf > 0 ? applyKerfOffset(pivotedRings, unitHalfKerf) : pivotedRings;

  const unitArea = computeCompoundArea(baseRings);
  const unitBoundingRadius = computeBoundingRadius(baseRings);

  // 2. Build panel outline and inset safe-margin boundary polygon
  const panelOutline = buildPanelOutline(
    state.panelW,
    state.panelH,
    state.panelShape,
    state.cornerRadius,
    0,
    state.customPanelPoints
  );
  const needsSafeOutline =
    state.edgeClipMode === 'boundary_clip' || !isAnalyticPanelShape(state.panelShape);
  const safeBoundaryOutline = needsSafeOutline
    ? buildPanelOutline(
        state.panelW,
        state.panelH,
        state.panelShape,
        state.cornerRadius,
        state.margin,
        state.customPanelPoints
      )
    : panelOutline;
  const safeBoundaryIsConvex =
    state.edgeClipMode === 'boundary_clip' ? isConvexPolygon(safeBoundaryOutline) : true;

  // 3. Generate topology candidates with C1 adaptive radial warp
  const candidates = generateCandidates(state);
  const rand = createMulberry32(state.seed);
  const baseAngleRad = (state.baseAngle * Math.PI) / 180;

  const primaryAttractor = state.attractors[0] ?? {
    id: 'primary',
    type: 'point' as const,
    x: 0.5,
    y: 0.5,
    radius: state.transitionRadius,
    weight: 1,
    falloff: 'smoothstep' as const,
  };
  const focusCx = primaryAttractor.x * state.panelW;
  const focusCy = primaryAttractor.y * state.panelH;
  const focusRadius = Math.max(20, primaryAttractor.radius);

  const instances: PatternInstance[] = [];
  let totalHoleArea = 0;
  let focusHoleArea = 0;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];

    // Deterministic organic jitter
    let px = cand.x;
    let py = cand.y;
    let scaleJitter = 1;
    if (state.jitter > 0.001) {
      const jx = (rand() * 2 - 1) * state.pitch * state.jitter * 0.45;
      const jy = (rand() * 2 - 1) * state.pitch * state.jitter * 0.45;
      px += jx;
      py += jy;
      scaleJitter = 1 + (rand() * 2 - 1) * state.jitter * 0.35;
    }

    // Evaluate multi-attractor field
    const field = evaluateAttractorField(px, py, state.attractors, state.panelW, state.panelH);
    const t = Math.min(1, field.influence);

    // Continuity mode: infinite lattice interpolates between ambientScale and centerScale;
    // isolated_island fades cleanly to 0 outside attractor influence.
    let scale: number;
    if (state.continuityMode === 'isolated_island') {
      if (t <= 0.015) continue;
      scale = state.centerScale * t * scaleJitter;
    } else {
      const targetMin = state.ambientScale;
      const targetMax = state.centerScale;
      scale = (targetMin + (targetMax - targetMin) * t) * scaleJitter;
    }

    // Orientation calculation
    let angle = baseAngleRad;
    if (state.orientationMode === 'flow') {
      angle += cand.flowAngle;
    } else if (state.orientationMode === 'radial') {
      angle += field.radialAngle;
    }

    // Halftone image brightness modulation
    if (state.imageMap.enabled && imageGrid) {
      const u = px / Math.max(1, state.panelW);
      const v = py / Math.max(1, state.panelH);
      const mod = sampleImageModulation(imageGrid, u, v, state.imageMap);
      const str = state.imageMap.strength;
      if (state.imageMap.target === 'scale' || state.imageMap.target === 'both') {
        const modScale = state.centerScale * (0.08 + mod * 1.12);
        scale = scale * (1 - str) + modScale * str;
      }
      if (state.imageMap.target === 'angle' || state.imageMap.target === 'both') {
        angle += (mod - 0.5) * Math.PI * str;
      }
    }

    if (scale < 0.04) continue;
    const effRadius = unitBoundingRadius * scale;

    // Boundary check according to edgeClipMode
    const sdf = signedDistanceToSafeBoundary(
      px,
      py,
      state.panelW,
      state.panelH,
      state.panelShape,
      state.cornerRadius,
      state.margin,
      safeBoundaryOutline
    );

    let clippedRings: CompoundPolygon | undefined;
    let instanceArea = unitArea * scale * scale;

    if (state.edgeClipMode === 'center') {
      if (sdf > 0) continue;
    } else if (state.edgeClipMode === 'complete') {
      // Entire motif bounding circle must fit cleanly inside safe margin
      if (sdf + effRadius > 0) continue;
    } else if (state.edgeClipMode === 'boundary_clip') {
      if (sdf - effRadius > 0) continue; // completely outside
      if (sdf + effRadius > 0) {
        if (!safeBoundaryIsConvex) {
          // For concave custom panels, keep only shapes cleanly inside safe margin
          continue;
        }
        // Intersects convex safe boundary: clip polygon cleanly with Sutherland-Hodgman
        const worldRings = transformRingsToWorld(baseRings, px, py, angle, scale);
        const clipped: CompoundPolygon = [];
        for (const ring of worldRings) {
          const out = clipRingToConvexBoundary(ring, safeBoundaryOutline);
          if (out.length >= 3) clipped.push(out);
        }
        if (clipped.length === 0) continue;
        clippedRings = clipped;
        instanceArea = computeCompoundArea(clipped);
        if (instanceArea < 0.5) continue;
      }
    }

    totalHoleArea += instanceArea;

    // Accumulate Focus Zone OAR if inside primary focus circle
    if (Math.hypot(px - focusCx, py - focusCy) <= focusRadius) {
      focusHoleArea += instanceArea;
    }

    instances.push({
      id: instances.length,
      x: px,
      y: py,
      angle,
      scale,
      boundingRadius: effRadius,
      isColliding: false,
      isThinBridge: false,
      clippedRings,
    });
  }

  // 4. Spatial Hash bridge width & collision detection
  const bridge = analyzeBridgesSpatialHash(instances, baseRings, state.materialThickness);

  // 5. Exact OAR calculations (Full Panel & Clipped Focus Circle-Panel Intersection)
  const panelArea = computePanelArea(
    state.panelW,
    state.panelH,
    state.panelShape,
    state.cornerRadius,
    panelOutline
  );
  const focusClippedArea = computeCirclePanelIntersectionArea(
    focusCx,
    focusCy,
    focusRadius,
    state.panelW,
    state.panelH,
    state.panelShape,
    state.cornerRadius,
    panelOutline
  );

  const panelOarPercent = panelArea > 0 ? Math.min(100, (totalHoleArea / panelArea) * 100) : 0;
  const focusOarPercent =
    focusClippedArea > 0 ? Math.min(100, (focusHoleArea / focusClippedArea) * 100) : panelOarPercent;

  return {
    instances,
    baseRings,
    unitArea,
    unitBoundingRadius,
    panelOutline,
    metrics: {
      instanceCount: instances.length,
      focusOarPercent: Number(focusOarPercent.toFixed(1)),
      panelOarPercent: Number(panelOarPercent.toFixed(1)),
      minBridgeMm: bridge.minBridgeMm,
      collisionCount: bridge.collisionCount,
      thinBridgeCount: bridge.thinBridgeCount,
      panelAreaMm2: Math.round(panelArea),
      totalHoleAreaMm2: Math.round(totalHoleArea),
      computedMs: Number((performance.now() - t0).toFixed(1)),
    },
  };
}
