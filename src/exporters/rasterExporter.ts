import type { PatternResult, PatternState } from '../engine/types';
import { resolveVisualColors } from './svgExporter';

const MAX_CANVAS_SIDE = 10000;
const MAX_CANVAS_PIXELS = 48_000_000;

export interface RasterExportResult {
  width: number;
  height: number;
  clamped: boolean;
}

/**
 * Exports a high-resolution PNG or WebP image using an offscreen Canvas 2D renderer
 * with automatic browser canvas dimension safety clamping.
 */
export async function exportRasterImage(
  state: PatternState,
  result: PatternResult,
  format: 'png' | 'webp',
  scaleFactor: 1 | 2 | 4
): Promise<RasterExportResult> {
  // Base pixel scale: target ~1.5 px/mm at 1x, scaling cleanly with 2x / 4x
  const basePxPerMm = 1400 / Math.max(state.panelW, state.panelH);
  let pxPerMm = basePxPerMm * scaleFactor;
  let width = Math.round(state.panelW * pxPerMm);
  let height = Math.round(state.panelH * pxPerMm);
  let clamped = false;

  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE) {
    const ratio = MAX_CANVAS_SIDE / Math.max(width, height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
    pxPerMm *= ratio;
    clamped = true;
  }

  if (width * height > MAX_CANVAS_PIXELS) {
    const ratio = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
    pxPerMm *= ratio;
    clamped = true;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.scale(pxPerMm, pxPerMm);
  const colors = resolveVisualColors(state);

  // Panel clip path & background
  ctx.beginPath();
  if (result.panelOutline.length >= 3) {
    ctx.moveTo(result.panelOutline[0].x, result.panelOutline[0].y);
    for (let i = 1; i < result.panelOutline.length; i++) {
      ctx.lineTo(result.panelOutline[i].x, result.panelOutline[i].y);
    }
    ctx.closePath();
  }

  if (!state.transparentBg) {
    if (state.studioMode === 'brushed_metal') {
      const grad = ctx.createLinearGradient(0, 0, state.panelW, state.panelH);
      grad.addColorStop(0, '#D8DCE2');
      grad.addColorStop(0.5, '#C5CAD2');
      grad.addColorStop(1, '#B8BEC7');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = colors.panelFill;
    }
    ctx.fill();
  }

  if (state.studioMode === 'cad_wireframe') {
    ctx.strokeStyle = colors.outlineStroke;
    ctx.lineWidth = Math.max(0.5, 1.2 / pxPerMm);
    ctx.stroke();
  }

  // Build cached Path2D for unit motif
  const basePath = new Path2D();
  for (const ring of result.baseRings) {
    if (ring.length < 3) continue;
    basePath.moveTo(ring[0].x, ring[0].y);
    for (let i = 1; i < ring.length; i++) {
      basePath.lineTo(ring[i].x, ring[i].y);
    }
    basePath.closePath();
  }

  const shouldFill =
    state.studioMode !== 'cad_wireframe' &&
    (state.renderStyle === 'fill' || state.renderStyle === 'fill_stroke');
  const shouldStroke =
    state.studioMode === 'cad_wireframe' ||
    state.renderStyle === 'stroke' ||
    state.renderStyle === 'fill_stroke';

  ctx.fillStyle = colors.holeFill;
  ctx.strokeStyle = colors.holeStroke;
  ctx.lineJoin = 'round';

  for (const inst of result.instances) {
    if (inst.clippedRings) {
      ctx.beginPath();
      for (const ring of inst.clippedRings) {
        if (ring.length < 3) continue;
        ctx.moveTo(ring[0].x, ring[0].y);
        for (let i = 1; i < ring.length; i++) {
          ctx.lineTo(ring[i].x, ring[i].y);
        }
        ctx.closePath();
      }
      if (shouldFill) ctx.fill('evenodd');
      if (shouldStroke) {
        ctx.lineWidth = state.studioMode === 'cad_wireframe' ? 0.6 : state.strokeWidth;
        ctx.stroke();
      }
    } else {
      ctx.save();
      ctx.translate(inst.x, inst.y);
      ctx.rotate(inst.angle);
      ctx.scale(inst.scale, inst.scale);
      if (shouldFill) ctx.fill(basePath, 'evenodd');
      if (shouldStroke) {
        const sw = state.studioMode === 'cad_wireframe' ? 0.6 : state.strokeWidth;
        ctx.lineWidth = sw / Math.max(0.1, inst.scale);
        ctx.stroke(basePath);
      }
      ctx.restore();
    }
  }

  const mime = format === 'webp' ? 'image/webp' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, 0.94)
  );
  if (!blob) throw new Error('Image export failed');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alpers-works-pattern-${state.panelW}x${state.panelH}mm-${scaleFactor}x.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { width, height, clamped };
}
