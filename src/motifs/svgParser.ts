import type { CompoundPolygon, CustomSvgMotifData, Point2D, PolygonRing } from '../engine/types';
import {
  computeBoundingRadius,
  computeCompoundArea,
  normalizeRingWinding,
} from '../engine/shoelace';

const ALLOWED_SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline']);

/**
 * Strictly sanitizes raw SVG markup by stripping scripts, foreignObject, event handlers,
 * external references, and non-geometry elements.
 */
function sanitizeSvgDocument(rawSvg: string): SVGSVGElement | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) return null;

  const root = doc.querySelector('svg');
  if (!root) return null;

  // Strip dangerous nodes
  const forbidden = root.querySelectorAll(
    'script, foreignObject, iframe, object, embed, image, use, style, link, a'
  );
  forbidden.forEach((el) => el.remove());

  // Strip event handlers & javascript: URIs
  const all = root.querySelectorAll('*');
  all.forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return root as unknown as SVGSVGElement;
}

/**
 * Splits a compound SVG path `d` attribute into independent subpaths starting at each M/m command,
 * preserving inner holes without drawing fake connecting lines across them.
 */
function splitSvgSubpaths(d: string): string[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return [];

  const subpaths: string[] = [];
  let current: string[] = [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';
  let i = 0;

  const flush = () => {
    if (current.length > 0) {
      subpaths.push(current.join(' '));
      current = [];
    }
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[a-zA-Z]$/.test(tok)) {
      cmd = tok;
      i++;
      if (cmd === 'Z' || cmd === 'z') {
        current.push('Z');
        curX = startX;
        curY = startY;
        continue;
      }
    }

    if (cmd === 'M' || cmd === 'm') {
      flush();
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (Number.isNaN(x) || Number.isNaN(y)) break;
      const absX = cmd === 'm' ? curX + x : x;
      const absY = cmd === 'm' ? curY + y : y;
      curX = absX;
      curY = absY;
      startX = absX;
      startY = absY;
      current.push('M', String(absX), String(absY));
      // Subsequent coordinate pairs after M/m are implicit L/l
      cmd = cmd === 'm' ? 'l' : 'L';
    } else if (cmd === 'L' || cmd === 'l' || cmd === 'T' || cmd === 't') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (Number.isNaN(x) || Number.isNaN(y)) break;
      const isRel = cmd === 'l' || cmd === 't';
      const absX = isRel ? curX + x : x;
      const absY = isRel ? curY + y : y;
      curX = absX;
      curY = absY;
      current.push(cmd.toUpperCase(), String(absX), String(absY));
    } else if (cmd === 'H' || cmd === 'h') {
      const x = parseFloat(tokens[i++]);
      if (Number.isNaN(x)) break;
      curX = cmd === 'h' ? curX + x : x;
      current.push('L', String(curX), String(curY));
    } else if (cmd === 'V' || cmd === 'v') {
      const y = parseFloat(tokens[i++]);
      if (Number.isNaN(y)) break;
      curY = cmd === 'v' ? curY + y : y;
      current.push('L', String(curX), String(curY));
    } else if (cmd === 'C' || cmd === 'c') {
      const nums = [0, 1, 2, 3, 4, 5].map(() => parseFloat(tokens[i++]));
      if (nums.some(Number.isNaN)) break;
      const isRel = cmd === 'c';
      const x1 = isRel ? curX + nums[0] : nums[0];
      const y1 = isRel ? curY + nums[1] : nums[1];
      const x2 = isRel ? curX + nums[2] : nums[2];
      const y2 = isRel ? curY + nums[3] : nums[3];
      const x = isRel ? curX + nums[4] : nums[4];
      const y = isRel ? curY + nums[5] : nums[5];
      curX = x;
      curY = y;
      current.push('C', String(x1), String(y1), String(x2), String(y2), String(x), String(y));
    } else if (cmd === 'S' || cmd === 's' || cmd === 'Q' || cmd === 'q') {
      const nums = [0, 1, 2, 3].map(() => parseFloat(tokens[i++]));
      if (nums.some(Number.isNaN)) break;
      const isRel = cmd === 's' || cmd === 'q';
      const x1 = isRel ? curX + nums[0] : nums[0];
      const y1 = isRel ? curY + nums[1] : nums[1];
      const x = isRel ? curX + nums[2] : nums[2];
      const y = isRel ? curY + nums[3] : nums[3];
      curX = x;
      curY = y;
      current.push(cmd.toUpperCase(), String(x1), String(y1), String(x), String(y));
    } else if (cmd === 'A' || cmd === 'a') {
      const rx = parseFloat(tokens[i++]);
      const ry = parseFloat(tokens[i++]);
      const rot = parseFloat(tokens[i++]);
      const laf = parseFloat(tokens[i++]);
      const sf = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if ([rx, ry, rot, laf, sf, x, y].some(Number.isNaN)) break;
      const absX = cmd === 'a' ? curX + x : x;
      const absY = cmd === 'a' ? curY + y : y;
      curX = absX;
      curY = absY;
      current.push('A', String(rx), String(ry), String(rot), String(laf), String(sf), String(absX), String(absY));
    } else {
      i++;
    }
  }

  flush();
  return subpaths;
}

function pointInRing(pt: Point2D, ring: PolygonRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Universal SVG motif importer supporting <path>, <rect>, <circle>, <ellipse>,
 * <polygon>, and <polyline>, preserving compound holes and normalizing to ~20mm baseline.
 */
export function parseCustomSvgMotif(rawSvg: string, fileName: string): CustomSvgMotifData | null {
  const sanitized = sanitizeSvgDocument(rawSvg);
  if (!sanitized) return null;

  // Mount temporarily offscreen so browser SVGGeometryElement computes exact curves & transforms
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  host.setAttribute('width', '500');
  host.setAttribute('height', '500');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '-99999px';
  host.style.visibility = 'hidden';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const rawRings: PolygonRing[] = [];

  try {
    const clone = document.importNode(sanitized, true);
    host.appendChild(clone);

    const elements = clone.querySelectorAll('*');
    elements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_SHAPES.has(tag)) return;

      const geomEl = el as unknown as SVGGeometryElement;
      const ctm = geomEl.getCTM?.();
      const applyCtm = (x: number, y: number): Point2D => {
        if (!ctm) return { x, y };
        return {
          x: ctm.a * x + ctm.c * y + ctm.e,
          y: ctm.b * x + ctm.d * y + ctm.f,
        };
      };

      if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const subpaths = splitSvgSubpaths(d);
        for (const sub of subpaths) {
          const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          tempPath.setAttribute('d', sub);
          host.appendChild(tempPath);
          const totalLen = tempPath.getTotalLength();
          if (totalLen > 0.01) {
            const samples = Math.min(72, Math.max(16, Math.round(totalLen * 0.6)));
            const ring: PolygonRing = [];
            for (let i = 0; i < samples; i++) {
              const p = tempPath.getPointAtLength((i / samples) * totalLen);
              ring.push(applyCtm(p.x, p.y));
            }
            if (ring.length >= 3) rawRings.push(ring);
          }
          tempPath.remove();
        }
      } else if (tag === 'polygon' || tag === 'polyline') {
        const ptsAttr = (el.getAttribute('points') || '').trim();
        const nums = ptsAttr.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
        if (nums && nums.length >= 6) {
          const ring: PolygonRing = [];
          for (let i = 0; i + 1 < nums.length; i += 2) {
            ring.push(applyCtm(parseFloat(nums[i]), parseFloat(nums[i + 1])));
          }
          if (ring.length >= 3) rawRings.push(ring);
        }
      } else if (typeof geomEl.getTotalLength === 'function') {
        const totalLen = geomEl.getTotalLength();
        if (totalLen > 0.01) {
          const samples = tag === 'rect' ? 24 : 36;
          const ring: PolygonRing = [];
          for (let i = 0; i < samples; i++) {
            const p = geomEl.getPointAtLength((i / samples) * totalLen);
            ring.push(applyCtm(p.x, p.y));
          }
          if (ring.length >= 3) rawRings.push(ring);
        }
      }
    });
  } finally {
    host.remove();
  }

  if (rawRings.length === 0) return null;

  // Normalize bounding box to center at (0,0) and max dimension = 20 mm
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rawRings) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const span = Math.max(width, height);
  if (span < 1e-5) return null;

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const scale = 20 / span;

  const centered: CompoundPolygon = rawRings.map((ring) =>
    ring.map((p) => ({
      x: (p.x - cx) * scale,
      y: (p.y - cy) * scale,
    }))
  );

  // Assign evenodd nesting parity: rings enclosed by an odd number of other rings are holes (CW negative)
  const oriented: CompoundPolygon = centered.map((ring, idx) => {
    const sample = ring[0];
    let depth = 0;
    for (let j = 0; j < centered.length; j++) {
      if (j === idx) continue;
      if (pointInRing(sample, centered[j])) depth++;
    }
    const isOuter = depth % 2 === 0;
    return normalizeRingWinding(ring, isOuter);
  });

  // Sort largest outer ring first for spatial hash outer-hull lookup
  oriented.sort((a, b) => Math.abs(computeCompoundArea([b])) - Math.abs(computeCompoundArea([a])));

  return {
    name: fileName.replace(/\.svg$/i, ''),
    rings: oriented,
    unitArea: computeCompoundArea(oriented),
    boundingRadius: computeBoundingRadius(oriented),
  };
}

export interface CustomPanelSvgData {
  name: string;
  /** Normalized [0..1] outer boundary polygon points */
  points: Point2D[];
  /** Natural width / height aspect ratio of the uploaded SVG */
  aspect: number;
}

/**
 * Parses a sanitized SVG file into a normalized [0..1] outer panel boundary polygon.
 * Selects the largest closed contour and preserves its natural aspect ratio.
 */
export function parseCustomPanelSvg(rawSvg: string, fileName: string): CustomPanelSvgData | null {
  const motif = parseCustomSvgMotif(rawSvg, fileName);
  if (!motif || motif.rings.length === 0) return null;

  // Largest outer contour is already sorted first by parseCustomSvgMotif
  const outer = motif.rings[0];
  if (outer.length < 3) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outer) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 1e-4 || h < 1e-4) return null;

  // Resample if excessively dense so 60 FPS SDF stays fast
  const maxPts = 84;
  const step = outer.length > maxPts ? Math.ceil(outer.length / maxPts) : 1;
  const points: Point2D[] = [];
  for (let i = 0; i < outer.length; i += step) {
    const p = outer[i];
    points.push({
      x: Number(((p.x - minX) / w).toFixed(4)),
      y: Number(((p.y - minY) / h).toFixed(4)),
    });
  }

  return {
    name: motif.name,
    points: normalizeRingWinding(points, true),
    aspect: w / h,
  };
}
