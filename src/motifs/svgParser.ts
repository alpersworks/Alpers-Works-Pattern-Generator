import type { CompoundPolygon, CustomSvgMotifData, Point2D, PolygonRing } from '../engine/types';
import {
  computeBoundingRadius,
  computeCompoundArea,
  normalizeRingWinding,
} from '../engine/shoelace';

const ALLOWED_SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);

/**
 * Strictly sanitizes raw SVG markup by stripping scripts, foreignObject, defs/clipPaths,
 * event handlers, external references, and non-geometry elements.
 */
function sanitizeSvgDocument(rawSvg: string): SVGSVGElement | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) return null;

  const root = doc.querySelector('svg');
  if (!root) return null;

  // Strip dangerous nodes AND non-rendered definition containers (clipPath, mask, defs, symbol)
  // so clipPath <rect> elements are never mistakenly rendered as solid shapes.
  const forbidden = root.querySelectorAll(
    'script, foreignObject, iframe, object, embed, image, use, style, link, a, defs, clipPath, mask, symbol, marker, pattern, title, desc, metadata'
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

interface ParsedSegment {
  kind: 'line' | 'curve';
  /** Absolute start point */
  x0: number;
  y0: number;
  /** Absolute end point */
  x1: number;
  y1: number;
  /** Absolute single-segment SVG `d` string for curves (M x0 y0 <cmd> ...) */
  curveD?: string;
}

interface ParsedSubpath {
  segments: ParsedSegment[];
  closed: boolean;
}

/**
 * W3C SVG 1.1 / SVG 2 spec-compliant path `d` parser.
 * Properly handles:
 * - Compact arc flags without spaces (e.g. `a150 150 0 10-300 0` or `a70,70,0,01140,0`)
 * - Compact chained decimals (e.g. `1.5.5` -> `1.5`, `0.5`)
 * - Implicit repeated commands (`M` -> `L`, `m` -> `l`)
 * - Smooth cubic (`S`/`s`) and smooth quadratic (`T`/`t`) reflection control points
 * - Multiple subpaths preserving inner holes independently
 */
export function parseSvgPathToSubpaths(d: string): ParsedSubpath[] {
  const len = d.length;
  let pos = 0;

  const skipSeparators = () => {
    while (pos < len) {
      const ch = d.charCodeAt(pos);
      // space, tab, LF, CR, comma
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 44) {
        pos++;
      } else {
        break;
      }
    }
  };

  const isCommandChar = (ch: string) => /^[a-zA-Z]$/.test(ch);

  const hasMoreNumbers = (): boolean => {
    skipSeparators();
    if (pos >= len) return false;
    const ch = d[pos];
    return ch === '+' || ch === '-' || ch === '.' || (ch >= '0' && ch <= '9');
  };

  const readNumber = (): number => {
    skipSeparators();
    const start = pos;
    if (pos < len && (d[pos] === '+' || d[pos] === '-')) pos++;
    let hasDigits = false;
    while (pos < len && d[pos] >= '0' && d[pos] <= '9') {
      pos++;
      hasDigits = true;
    }
    if (pos < len && d[pos] === '.') {
      pos++;
      while (pos < len && d[pos] >= '0' && d[pos] <= '9') {
        pos++;
        hasDigits = true;
      }
    }
    if (hasDigits && pos < len && (d[pos] === 'e' || d[pos] === 'E')) {
      const expPos = pos;
      pos++;
      if (pos < len && (d[pos] === '+' || d[pos] === '-')) pos++;
      let expDigits = false;
      while (pos < len && d[pos] >= '0' && d[pos] <= '9') {
        pos++;
        expDigits = true;
      }
      if (!expDigits) pos = expPos;
    }
    if (pos === start) return NaN;
    return parseFloat(d.slice(start, pos));
  };

  // Arc flags in SVG grammar are strictly single-character '0' or '1' (may have no delimiter after them!)
  const readFlag = (): number => {
    skipSeparators();
    if (pos >= len) return NaN;
    const ch = d[pos];
    if (ch === '0' || ch === '1') {
      pos++;
      return ch === '1' ? 1 : 0;
    }
    return NaN;
  };

  const subpaths: ParsedSubpath[] = [];
  let current: ParsedSubpath | null = null;
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  let lastCmd = '';
  let cmd = '';

  const flush = () => {
    if (current && current.segments.length > 0) {
      subpaths.push(current);
    }
    current = null;
  };

  while (pos < len) {
    skipSeparators();
    if (pos >= len) break;

    if (isCommandChar(d[pos])) {
      cmd = d[pos++];
    } else if (!cmd) {
      pos++;
      continue;
    }

    if (cmd === 'Z' || cmd === 'z') {
      if (current) {
        if (Math.hypot(curX - startX, curY - startY) > 1e-4) {
          current.segments.push({ kind: 'line', x0: curX, y0: curY, x1: startX, y1: startY });
        }
        current.closed = true;
        flush();
      }
      curX = startX;
      curY = startY;
      lastCmd = cmd;
      cmd = '';
      continue;
    }

    if (cmd === 'M' || cmd === 'm') {
      flush();
      const x = readNumber();
      const y = readNumber();
      if (Number.isNaN(x) || Number.isNaN(y)) break;
      curX = cmd === 'm' ? curX + x : x;
      curY = cmd === 'm' ? curY + y : y;
      startX = curX;
      startY = curY;
      current = { segments: [], closed: false };
      lastCmd = cmd;
      // Subsequent coordinate pairs after M/m are implicit L/l
      cmd = cmd === 'm' ? 'l' : 'L';
      continue;
    }

    if (!current) {
      current = { segments: [], closed: false };
      startX = curX;
      startY = curY;
    }

    if (cmd === 'L' || cmd === 'l') {
      const x = readNumber();
      const y = readNumber();
      if (Number.isNaN(x) || Number.isNaN(y)) break;
      const nx = cmd === 'l' ? curX + x : x;
      const ny = cmd === 'l' ? curY + y : y;
      current.segments.push({ kind: 'line', x0: curX, y0: curY, x1: nx, y1: ny });
      curX = nx;
      curY = ny;
      lastCmd = cmd;
    } else if (cmd === 'H' || cmd === 'h') {
      const x = readNumber();
      if (Number.isNaN(x)) break;
      const nx = cmd === 'h' ? curX + x : x;
      current.segments.push({ kind: 'line', x0: curX, y0: curY, x1: nx, y1: curY });
      curX = nx;
      lastCmd = cmd;
    } else if (cmd === 'V' || cmd === 'v') {
      const y = readNumber();
      if (Number.isNaN(y)) break;
      const ny = cmd === 'v' ? curY + y : y;
      current.segments.push({ kind: 'line', x0: curX, y0: curY, x1: curX, y1: ny });
      curY = ny;
      lastCmd = cmd;
    } else if (cmd === 'C' || cmd === 'c') {
      const x1 = readNumber();
      const y1 = readNumber();
      const x2 = readNumber();
      const y2 = readNumber();
      const x = readNumber();
      const y = readNumber();
      if ([x1, y1, x2, y2, x, y].some(Number.isNaN)) break;
      const isRel = cmd === 'c';
      const ax1 = isRel ? curX + x1 : x1;
      const ay1 = isRel ? curY + y1 : y1;
      const ax2 = isRel ? curX + x2 : x2;
      const ay2 = isRel ? curY + y2 : y2;
      const ax = isRel ? curX + x : x;
      const ay = isRel ? curY + y : y;
      current.segments.push({
        kind: 'curve',
        x0: curX,
        y0: curY,
        x1: ax,
        y1: ay,
        curveD: `M${curX} ${curY}C${ax1} ${ay1} ${ax2} ${ay2} ${ax} ${ay}`,
      });
      lastCtrlX = ax2;
      lastCtrlY = ay2;
      curX = ax;
      curY = ay;
      lastCmd = cmd;
    } else if (cmd === 'S' || cmd === 's') {
      const x2 = readNumber();
      const y2 = readNumber();
      const x = readNumber();
      const y = readNumber();
      if ([x2, y2, x, y].some(Number.isNaN)) break;
      const isRel = cmd === 's';
      const prevCubic = lastCmd === 'C' || lastCmd === 'c' || lastCmd === 'S' || lastCmd === 's';
      const ax1 = prevCubic ? 2 * curX - lastCtrlX : curX;
      const ay1 = prevCubic ? 2 * curY - lastCtrlY : curY;
      const ax2 = isRel ? curX + x2 : x2;
      const ay2 = isRel ? curY + y2 : y2;
      const ax = isRel ? curX + x : x;
      const ay = isRel ? curY + y : y;
      current.segments.push({
        kind: 'curve',
        x0: curX,
        y0: curY,
        x1: ax,
        y1: ay,
        curveD: `M${curX} ${curY}C${ax1} ${ay1} ${ax2} ${ay2} ${ax} ${ay}`,
      });
      lastCtrlX = ax2;
      lastCtrlY = ay2;
      curX = ax;
      curY = ay;
      lastCmd = cmd;
    } else if (cmd === 'Q' || cmd === 'q') {
      const x1 = readNumber();
      const y1 = readNumber();
      const x = readNumber();
      const y = readNumber();
      if ([x1, y1, x, y].some(Number.isNaN)) break;
      const isRel = cmd === 'q';
      const ax1 = isRel ? curX + x1 : x1;
      const ay1 = isRel ? curY + y1 : y1;
      const ax = isRel ? curX + x : x;
      const ay = isRel ? curY + y : y;
      current.segments.push({
        kind: 'curve',
        x0: curX,
        y0: curY,
        x1: ax,
        y1: ay,
        curveD: `M${curX} ${curY}Q${ax1} ${ay1} ${ax} ${ay}`,
      });
      lastCtrlX = ax1;
      lastCtrlY = ay1;
      curX = ax;
      curY = ay;
      lastCmd = cmd;
    } else if (cmd === 'T' || cmd === 't') {
      const x = readNumber();
      const y = readNumber();
      if (Number.isNaN(x) || Number.isNaN(y)) break;
      const isRel = cmd === 't';
      const prevQuad = lastCmd === 'Q' || lastCmd === 'q' || lastCmd === 'T' || lastCmd === 't';
      const ax1 = prevQuad ? 2 * curX - lastCtrlX : curX;
      const ay1 = prevQuad ? 2 * curY - lastCtrlY : curY;
      const ax = isRel ? curX + x : x;
      const ay = isRel ? curY + y : y;
      current.segments.push({
        kind: 'curve',
        x0: curX,
        y0: curY,
        x1: ax,
        y1: ay,
        curveD: `M${curX} ${curY}Q${ax1} ${ay1} ${ax} ${ay}`,
      });
      lastCtrlX = ax1;
      lastCtrlY = ay1;
      curX = ax;
      curY = ay;
      lastCmd = cmd;
    } else if (cmd === 'A' || cmd === 'a') {
      const rx = readNumber();
      const ry = readNumber();
      const rot = readNumber();
      const laf = readFlag();
      const sf = readFlag();
      const x = readNumber();
      const y = readNumber();
      if ([rx, ry, rot, laf, sf, x, y].some(Number.isNaN)) break;
      const ax = cmd === 'a' ? curX + x : x;
      const ay = cmd === 'a' ? curY + y : y;
      current.segments.push({
        kind: 'curve',
        x0: curX,
        y0: curY,
        x1: ax,
        y1: ay,
        curveD: `M${curX} ${curY}A${rx} ${ry} ${rot} ${laf} ${sf} ${ax} ${ay}`,
      });
      curX = ax;
      curY = ay;
      lastCmd = cmd;
    } else {
      break;
    }

    if (!hasMoreNumbers()) {
      cmd = '';
    }
  }

  flush();
  return subpaths;
}

function dedupeRing(ring: PolygonRing, eps = 1e-4): PolygonRing {
  const out: PolygonRing = [];
  for (const p of ring) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > eps) {
      out.push(p);
    }
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= eps) {
      out.pop();
    }
  }
  return out;
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
 * Checks whether `inner` ring is genuinely enclosed inside `outer` ring
 * (not merely overlapping/crossing it). Requires smaller area and >= 90% of vertices inside.
 */
function isRingContainedIn(inner: PolygonRing, outer: PolygonRing, innerAbsArea: number, outerAbsArea: number): boolean {
  if (innerAbsArea >= outerAbsArea * 0.999) return false;
  const step = Math.max(1, Math.floor(inner.length / 12));
  let tested = 0;
  let insideCount = 0;
  for (let i = 0; i < inner.length; i += step) {
    tested++;
    if (pointInRing(inner[i], outer)) insideCount++;
  }
  return tested > 0 && insideCount / tested >= 0.9;
}

/**
 * Expands an open or closed polyline with strokeWidth into closed solid polygon ring(s):
 * - Closed loops produce TWO separate rings (outer + inner hole) with zero seam gap.
 * - Open paths produce ONE closed ribbon ring with miter-clamped corners.
 */
function expandStrokedPolyline(pts: Point2D[], halfWidth: number, closed: boolean): PolygonRing[] {
  const n = pts.length;
  if (n < 2 || halfWidth <= 1e-4) return [];

  const left: Point2D[] = [];
  const right: Point2D[] = [];
  const miterLimit = 2.4;

  for (let i = 0; i < n; i++) {
    const curr = pts[i];
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    const prev = hasPrev ? pts[(i - 1 + n) % n] : curr;
    const next = hasNext ? pts[(i + 1) % n] : curr;

    let n1x = 0, n1y = 0, hasN1 = false;
    if (hasPrev) {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const l = Math.hypot(dx, dy);
      if (l > 1e-6) {
        n1x = -dy / l;
        n1y = dx / l;
        hasN1 = true;
      }
    }

    let n2x = 0, n2y = 0, hasN2 = false;
    if (hasNext) {
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const l = Math.hypot(dx, dy);
      if (l > 1e-6) {
        n2x = -dy / l;
        n2y = dx / l;
        hasN2 = true;
      }
    }

    let ox = 0, oy = 0;
    if (hasN1 && hasN2) {
      let bx = n1x + n2x;
      let by = n1y + n2y;
      const bLen = Math.hypot(bx, by);
      if (bLen < 1e-5) {
        ox = n1x * halfWidth;
        oy = n1y * halfWidth;
      } else {
        bx /= bLen;
        by /= bLen;
        const dot = Math.max(0.3, bx * n1x + by * n1y);
        const shift = halfWidth * Math.min(miterLimit, 1 / dot);
        ox = bx * shift;
        oy = by * shift;
      }
    } else if (hasN1) {
      ox = n1x * halfWidth;
      oy = n1y * halfWidth;
    } else if (hasN2) {
      ox = n2x * halfWidth;
      oy = n2y * halfWidth;
    } else {
      continue;
    }

    left.push({ x: curr.x + ox, y: curr.y + oy });
    right.push({ x: curr.x - ox, y: curr.y - oy });
  }

  if (closed) {
    const r1 = dedupeRing(left);
    const r2 = dedupeRing(right);
    const out: PolygonRing[] = [];
    if (r1.length >= 3) out.push(r1);
    if (r2.length >= 3) out.push(r2);
    return out;
  }

  const ribbon = dedupeRing([...left, ...right.reverse()]);
  return ribbon.length >= 3 ? [ribbon] : [];
}

function isPureWhiteColor(color: string | null | undefined): boolean {
  if (!color) return false;
  const c = color.replace(/\s+/g, '').toLowerCase();
  return c === '#fff' || c === '#ffffff' || c === 'white' || c === 'rgb(255,255,255)' || c === 'rgba(255,255,255,1)';
}

function isElementVisible(el: Element): { visible: boolean; strokedOnly: boolean; strokeWidth: number; isWhiteOnly: boolean } {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return { visible: false, strokedOnly: false, strokeWidth: 0, isWhiteOnly: false };
  }
  const opacity = parseFloat(style.opacity || '1');
  if (!Number.isNaN(opacity) && opacity <= 0.01) {
    return { visible: false, strokedOnly: false, strokeWidth: 0, isWhiteOnly: false };
  }

  const fillAttr = el.getAttribute('fill')?.trim().toLowerCase();
  const strokeAttr = el.getAttribute('stroke')?.trim().toLowerCase();
  const fillNone = fillAttr === 'none' || style.fill === 'none' || style.fill === 'transparent';
  const strokeNone =
    !strokeAttr
      ? style.stroke === 'none' || style.stroke === 'transparent' || !style.stroke
      : strokeAttr === 'none';

  const sw = parseFloat(el.getAttribute('stroke-width') || style.strokeWidth || '0') || 0;

  if (fillNone && (strokeNone || sw <= 0)) {
    // Invisible artboard / bounding box rectangle (e.g., <rect width="512" height="512" fill="none"/>)
    return { visible: false, strokedOnly: false, strokeWidth: 0, isWhiteOnly: false };
  }

  const strokedOnly = fillNone && !strokeNone && sw > 0;
  const activeColor = strokedOnly ? (strokeAttr || style.stroke) : (fillAttr || style.fill);
  const isWhiteOnly = isPureWhiteColor(activeColor);

  return { visible: true, strokedOnly, strokeWidth: sw, isWhiteOnly };
}

/**
 * Universal SVG motif importer supporting <path>, <rect>, <circle>, <ellipse>,
 * <polygon>, <polyline>, and <line>, preserving sharp corners, compact arc flags,
 * compound evenodd holes, and normalizing to ~20mm baseline.
 */
export function parseCustomSvgMotif(rawSvg: string, fileName: string): CustomSvgMotifData | null {
  const sanitized = sanitizeSvgDocument(rawSvg);
  if (!sanitized) return null;

  // Mount temporarily offscreen so browser SVGGeometryElement computes exact curves & transforms.
  // NOTE: Do NOT set visibility:hidden on host, as visibility is inherited by children and would
  // cause getComputedStyle(el).visibility === 'hidden' for every SVG shape!
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  host.setAttribute('width', '500');
  host.setAttribute('height', '500');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '-99999px';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const coloredRings: PolygonRing[] = [];
  const whiteRings: PolygonRing[] = [];
  const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  host.appendChild(tempPath);

  try {
    const clone = document.importNode(sanitized, true) as unknown as SVGSVGElement;
    host.appendChild(clone);

    let invRootCtm: DOMMatrix | null = null;
    try {
      const rootCtm = clone.getCTM?.();
      if (rootCtm) invRootCtm = rootCtm.inverse();
    } catch {
      invRootCtm = null;
    }

    const elements = clone.querySelectorAll('*');
    elements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_SHAPES.has(tag)) return;

      const vis = isElementVisible(el);
      if (!vis.visible) return;

      const targetList = vis.isWhiteOnly ? whiteRings : coloredRings;
      const geomEl = el as unknown as SVGGeometryElement;
      const elCtm = geomEl.getCTM?.();
      const relCtm = elCtm && invRootCtm ? invRootCtm.multiply(elCtm) : elCtm;

      const applyCtm = (x: number, y: number): Point2D => {
        if (!relCtm) return { x, y };
        return {
          x: relCtm.a * x + relCtm.c * y + relCtm.e,
          y: relCtm.b * x + relCtm.d * y + relCtm.f,
        };
      };

      const pushPolygon = (pts: Point2D[], closed: boolean) => {
        const cleaned = dedupeRing(pts);
        if (vis.strokedOnly) {
          const scaleFactor = relCtm ? Math.hypot(relCtm.a, relCtm.b) : 1;
          const halfW = (vis.strokeWidth * Math.max(0.01, scaleFactor)) * 0.5;
          const expanded = expandStrokedPolyline(cleaned, halfW, closed);
          for (const r of expanded) {
            if (r.length >= 3) targetList.push(r);
          }
        } else if (cleaned.length >= 3) {
          targetList.push(cleaned);
        }
      };

      if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const subpaths = parseSvgPathToSubpaths(d);
        for (const sub of subpaths) {
          const ring: Point2D[] = [];
          for (const seg of sub.segments) {
            if (ring.length === 0) {
              ring.push(applyCtm(seg.x0, seg.y0));
            }
            if (seg.kind === 'line') {
              ring.push(applyCtm(seg.x1, seg.y1));
            } else if (seg.curveD) {
              tempPath.setAttribute('d', seg.curveD);
              const segLen = tempPath.getTotalLength();
              const steps = Math.min(20, Math.max(6, Math.ceil(segLen / 12)));
              for (let s = 1; s <= steps; s++) {
                const p = tempPath.getPointAtLength((s / steps) * segLen);
                ring.push(applyCtm(p.x, p.y));
              }
            }
          }
          pushPolygon(ring, sub.closed);
        }
      } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0') || 0;
        const y = parseFloat(el.getAttribute('y') || '0') || 0;
        const w = parseFloat(el.getAttribute('width') || '0') || 0;
        const h = parseFloat(el.getAttribute('height') || '0') || 0;
        const rx = Math.min(w * 0.5, parseFloat(el.getAttribute('rx') || el.getAttribute('ry') || '0') || 0);
        const ry = Math.min(h * 0.5, parseFloat(el.getAttribute('ry') || el.getAttribute('rx') || '0') || 0);
        if (w > 0 && h > 0) {
          if (rx <= 1e-4 && ry <= 1e-4) {
            pushPolygon(
              [
                applyCtm(x, y),
                applyCtm(x + w, y),
                applyCtm(x + w, y + h),
                applyCtm(x, y + h),
              ],
              true
            );
          } else {
            const pts: Point2D[] = [];
            const arcSteps = 6;
            const corners = [
              { cx: x + w - rx, cy: y + h - ry, start: 0, end: Math.PI * 0.5 },
              { cx: x + rx, cy: y + h - ry, start: Math.PI * 0.5, end: Math.PI },
              { cx: x + rx, cy: y + ry, start: Math.PI, end: Math.PI * 1.5 },
              { cx: x + w - rx, cy: y + ry, start: Math.PI * 1.5, end: Math.PI * 2 },
            ];
            for (const c of corners) {
              for (let i = 0; i <= arcSteps; i++) {
                const a = c.start + (i / arcSteps) * (c.end - c.start);
                pts.push(applyCtm(c.cx + Math.cos(a) * rx, c.cy + Math.sin(a) * ry));
              }
            }
            pushPolygon(pts, true);
          }
        }
      } else if (tag === 'circle' || tag === 'ellipse') {
        const cx = parseFloat(el.getAttribute('cx') || '0') || 0;
        const cy = parseFloat(el.getAttribute('cy') || '0') || 0;
        const rx =
          tag === 'circle'
            ? parseFloat(el.getAttribute('r') || '0') || 0
            : parseFloat(el.getAttribute('rx') || '0') || 0;
        const ry =
          tag === 'circle' ? rx : parseFloat(el.getAttribute('ry') || '0') || 0;
        if (rx > 0 && ry > 0) {
          const segs = 36;
          const pts: Point2D[] = [];
          for (let i = 0; i < segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            pts.push(applyCtm(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
          }
          pushPolygon(pts, true);
        }
      } else if (tag === 'polygon' || tag === 'polyline') {
        const ptsAttr = (el.getAttribute('points') || '').trim();
        const nums = ptsAttr.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
        if (nums && nums.length >= 4) {
          const ring: PolygonRing = [];
          for (let i = 0; i + 1 < nums.length; i += 2) {
            ring.push(applyCtm(parseFloat(nums[i]), parseFloat(nums[i + 1])));
          }
          pushPolygon(ring, tag === 'polygon');
        }
      } else if (tag === 'line' && vis.strokedOnly) {
        const x1 = parseFloat(el.getAttribute('x1') || '0') || 0;
        const y1 = parseFloat(el.getAttribute('y1') || '0') || 0;
        const x2 = parseFloat(el.getAttribute('x2') || '0') || 0;
        const y2 = parseFloat(el.getAttribute('y2') || '0') || 0;
        pushPolygon([applyCtm(x1, y1), applyCtm(x2, y2)], false);
      }
    });
  } finally {
    host.remove();
  }

  const rawRings = coloredRings.length > 0 ? coloredRings : whiteRings;
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

  // Assign true containment nesting parity: only rings genuinely enclosed inside a larger ring
  // are holes (CW negative); overlapping/crossing solid parts stay outer (CCW positive) for nonzero union!
  const areas = centered.map((r) => Math.abs(computeCompoundArea([r])));
  const oriented: CompoundPolygon = centered.map((ring, idx) => {
    let depth = 0;
    for (let j = 0; j < centered.length; j++) {
      if (j === idx) continue;
      if (isRingContainedIn(ring, centered[j], areas[idx], areas[j])) depth++;
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
