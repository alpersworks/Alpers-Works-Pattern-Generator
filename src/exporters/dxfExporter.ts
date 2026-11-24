import {
  Colors,
  DxfWriter,
  LWPolylineFlags,
  Units,
  point2d,
  point3d,
} from '@tarikjabiri/dxf';
import type { PatternResult, PatternState, Point2D, PolygonRing } from '../engine/types';

export interface DxfExportOptions {
  legacyR12: boolean;
  includeOutline: boolean;
  includeAlignmentMarks: boolean;
}

function transformRingCad(
  ring: PolygonRing,
  x: number,
  y: number,
  angle: number,
  scale: number,
  panelH: number
): Point2D[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return ring.map((p) => {
    const sx = p.x * scale;
    const sy = p.y * scale;
    const wx = x + sx * cos - sy * sin;
    const wy = y + sx * sin + sy * cos;
    // Flip Y to match standard CAD Cartesian coordinates (Y-up)
    return { x: Number(wx.toFixed(4)), y: Number((panelH - wy).toFixed(4)) };
  });
}

function flipRingCad(ring: PolygonRing, panelH: number): Point2D[] {
  return ring.map((p) => ({
    x: Number(p.x.toFixed(4)),
    y: Number((panelH - p.y).toFixed(4)),
  }));
}

/**
 * Generates a standard AutoCAD AC1015+ DXF using @tarikjabiri/dxf with
 * explicit metric headers ($INSUNITS = 4 mm, $MEASUREMENT = 1 metric) and separated layers.
 */
function buildStandardDxf(
  state: PatternState,
  result: PatternResult,
  options: DxfExportOptions
): string {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  dxf.setVariable('$MEASUREMENT', { 70: 1 });
  dxf.setVariable('$EXTMIN', { 10: 0, 20: 0, 30: 0 });
  dxf.setVariable('$EXTMAX', { 10: state.panelW, 20: state.panelH, 30: 0 });

  dxf.addLayer('HOLES', Colors.Red, 'Continuous');
  dxf.addLayer('PANEL_OUTLINE', Colors.Blue, 'Continuous');
  if (options.includeAlignmentMarks) {
    dxf.addLayer('ALIGNMENT_MARKS', Colors.Green, 'Continuous');
  }

  // Layer 1: HOLES
  dxf.setCurrentLayerName('HOLES');
  for (const inst of result.instances) {
    if (inst.clippedRings) {
      for (const ring of inst.clippedRings) {
        if (ring.length < 3) continue;
        const pts = flipRingCad(ring, state.panelH).map((p) => ({ point: point2d(p.x, p.y) }));
        dxf.addLWPolyline(pts, { flags: LWPolylineFlags.Closed, layerName: 'HOLES' });
      }
    } else {
      for (const ring of result.baseRings) {
        if (ring.length < 3) continue;
        const pts = transformRingCad(
          ring,
          inst.x,
          inst.y,
          inst.angle,
          inst.scale,
          state.panelH
        ).map((p) => ({ point: point2d(p.x, p.y) }));
        dxf.addLWPolyline(pts, { flags: LWPolylineFlags.Closed, layerName: 'HOLES' });
      }
    }
  }

  // Layer 2: PANEL_OUTLINE
  if (options.includeOutline && result.panelOutline.length >= 3) {
    dxf.setCurrentLayerName('PANEL_OUTLINE');
    const outlinePts = flipRingCad(result.panelOutline, state.panelH).map((p) => ({
      point: point2d(p.x, p.y),
    }));
    dxf.addLWPolyline(outlinePts, { flags: LWPolylineFlags.Closed, layerName: 'PANEL_OUTLINE' });
  }

  // Layer 3: ALIGNMENT_MARKS (center crosshair & origin registration)
  if (options.includeAlignmentMarks) {
    dxf.setCurrentLayerName('ALIGNMENT_MARKS');
    const cx = state.panelW * 0.5;
    const cy = state.panelH * 0.5;
    const arm = Math.min(20, Math.min(state.panelW, state.panelH) * 0.04);
    dxf.addLine(point3d(cx - arm, cy, 0), point3d(cx + arm, cy, 0), {
      layerName: 'ALIGNMENT_MARKS',
    });
    dxf.addLine(point3d(cx, cy - arm, 0), point3d(cx, cy + arm, 0), {
      layerName: 'ALIGNMENT_MARKS',
    });
  }

  return dxf.stringify();
}

/**
 * Generates a strict legacy AutoCAD R12 (AC1009) DXF using POLYLINE / VERTEX / SEQEND
 * for older CNC punch presses and legacy CAM controllers.
 */
function buildLegacyR12Dxf(
  state: PatternState,
  result: PatternResult,
  options: DxfExportOptions
): string {
  const lines: string[] = [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$MEASUREMENT', '70', '1',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
  ];

  const writeClosedPoly = (pts: Point2D[], layer: string, color: number) => {
    lines.push('0', 'POLYLINE', '8', layer, '62', String(color), '66', '1', '70', '1');
    for (const p of pts) {
      lines.push('0', 'VERTEX', '8', layer, '10', String(p.x), '20', String(p.y), '30', '0');
    }
    lines.push('0', 'SEQEND', '8', layer);
  };

  for (const inst of result.instances) {
    if (inst.clippedRings) {
      for (const ring of inst.clippedRings) {
        if (ring.length >= 3) writeClosedPoly(flipRingCad(ring, state.panelH), 'HOLES', 1);
      }
    } else {
      for (const ring of result.baseRings) {
        if (ring.length >= 3) {
          writeClosedPoly(
            transformRingCad(ring, inst.x, inst.y, inst.angle, inst.scale, state.panelH),
            'HOLES',
            1
          );
        }
      }
    }
  }

  if (options.includeOutline && result.panelOutline.length >= 3) {
    writeClosedPoly(flipRingCad(result.panelOutline, state.panelH), 'PANEL_OUTLINE', 5);
  }

  if (options.includeAlignmentMarks) {
    const cx = state.panelW * 0.5;
    const cy = state.panelH * 0.5;
    const arm = Math.min(20, Math.min(state.panelW, state.panelH) * 0.04);
    lines.push(
      '0', 'LINE', '8', 'ALIGNMENT_MARKS', '62', '3',
      '10', String(cx - arm), '20', String(cy), '30', '0',
      '11', String(cx + arm), '21', String(cy), '31', '0',
      '0', 'LINE', '8', 'ALIGNMENT_MARKS', '62', '3',
      '10', String(cx), '20', String(cy - arm), '30', '0',
      '11', String(cx), '21', String(cy + arm), '31', '0'
    );
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

export function buildDxf(
  state: PatternState,
  result: PatternResult,
  options: DxfExportOptions = {
    legacyR12: false,
    includeOutline: true,
    includeAlignmentMarks: false,
  }
): string {
  if (options.legacyR12) {
    return buildLegacyR12Dxf(state, result, options);
  }
  return buildStandardDxf(state, result, options);
}
