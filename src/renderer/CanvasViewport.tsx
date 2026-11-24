import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Grid3X3,
  Maximize2,
  Scan,
  ShieldAlert,
  SquareDashed,
} from 'lucide-react';
import type {
  Attractor,
  ImageLuminanceGrid,
  PatternResult,
  PatternState,
  Point2D,
  WorkspaceMode,
} from '../engine/types';
import { buildPanelOutline, DEFAULT_CUSTOM_POLYGON } from '../engine/panelGeometry';
import { resolveVisualColors } from '../exporters/svgExporter';
import type { Translations } from '../i18n/translations';

interface CanvasViewportProps {
  state: PatternState;
  result: PatternResult;
  workspaceMode: WorkspaceMode;
  imageGrid: ImageLuminanceGrid | null;
  t: Translations;
  isDrawingPanel: boolean;
  onSetDrawingPanel: (drawing: boolean) => void;
  onUpdateState: (updater: (prev: PatternState) => PatternState, recordHistory?: boolean) => void;
  selectedAttractorId: string | null;
  onSelectAttractor: (id: string | null) => void;
}

interface ViewTransform {
  scale: number; // screen px per mm
  tx: number; // screen x of panel (0,0)
  ty: number; // screen y of panel (0,0)
}

type DragMode =
  | { type: 'pan'; startX: number; startY: number; origTx: number; origTy: number }
  | { type: 'attractor_p1'; id: string }
  | { type: 'attractor_p2'; id: string }
  | { type: 'attractor_radius'; id: string }
  | { type: 'poly_vertex'; index: number };

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  state,
  result,
  workspaceMode,
  imageGrid,
  t,
  isDrawingPanel,
  onSetDrawingPanel,
  onUpdateState,
  selectedAttractorId,
  onSelectAttractor,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);

  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<ViewTransform>({ scale: 0.65, tx: 100, ty: 80 });
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [snapAxis, setSnapAxis] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const [hoverCursor, setHoverCursor] = useState<string>('grab');
  const [imgLoadedTick, setImgLoadedTick] = useState(0);
  const [draftPolyPoints, setDraftPolyPoints] = useState<Point2D[]>([]);
  const [draftCursorWorld, setDraftCursorWorld] = useState<Point2D | null>(null);
  const initializedPanelRef = useRef<string>('');

  // Active normalized custom polygon vertices (guaranteed >= 3 when custom_polygon is selected)
  const activePolyPoints = useMemo(() => {
    return state.customPanelPoints.length >= 3 ? state.customPanelPoints : DEFAULT_CUSTOM_POLYGON;
  }, [state.customPanelPoints]);

  // Reset draft points when drawing mode turns off
  useEffect(() => {
    if (!isDrawingPanel) {
      setDraftPolyPoints([]);
      setDraftCursorWorld(null);
    }
  }, [isDrawingPanel]);

  const commitDrawnPolygon = useCallback(() => {
    if (draftPolyPoints.length < 3) return;
    const normalized = draftPolyPoints.map((p) => ({
      x: Number(Math.max(0, Math.min(1, p.x / state.panelW)).toFixed(4)),
      y: Number(Math.max(0, Math.min(1, p.y / state.panelH)).toFixed(4)),
    }));
    onUpdateState(
      (prev) => ({
        ...prev,
        panelShape: 'custom_polygon',
        customPanelPoints: normalized,
      }),
      true
    );
    onSetDrawingPanel(false);
  }, [draftPolyPoints, state.panelW, state.panelH, onUpdateState, onSetDrawingPanel]);

  // Load reference image element for canvas underlay if halftone image exists
  useEffect(() => {
    if (!imageGrid?.dataUrl) {
      imgElementRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => setImgLoadedTick((n) => n + 1);
    img.src = imageGrid.dataUrl;
    imgElementRef.current = img;
  }, [imageGrid?.dataUrl]);

  // Fit panel cleanly inside viewport with generous architectural breathing room
  const fitToView = useCallback(
    (w = viewportSize.w, h = viewportSize.h) => {
      const padX = Math.max(48, w * 0.08);
      const padY = Math.max(64, h * 0.12);
      const availW = Math.max(120, w - padX * 2);
      const availH = Math.max(120, h - padY * 2 - 48); // reserve bottom telemetry bar
      const scale = Math.min(availW / state.panelW, availH / state.panelH);
      const tx = (w - state.panelW * scale) * 0.5;
      const ty = (h - 40 - state.panelH * scale) * 0.5;
      setView({ scale: Math.max(0.02, Math.min(10, scale)), tx, ty });
    },
    [state.panelW, state.panelH, viewportSize.w, viewportSize.h]
  );

  // Set 1:1 approximate physical scale (~3.78 px per mm at 96 DPI)
  const setActualScale = useCallback(() => {
    const scale = 3.7795;
    const tx = (viewportSize.w - state.panelW * scale) * 0.5;
    const ty = (viewportSize.h - 40 - state.panelH * scale) * 0.5;
    setView({ scale, tx, ty });
  }, [state.panelW, state.panelH, viewportSize.w, viewportSize.h]);

  // Observe container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 10 || rect.height < 10) return;
      setViewportSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-fit on first mount or when panel dimensions change significantly
  useEffect(() => {
    const key = `${state.panelW}x${state.panelH}`;
    if (viewportSize.w > 100 && initializedPanelRef.current !== key) {
      initializedPanelRef.current = key;
      fitToView(viewportSize.w, viewportSize.h);
    }
  }, [state.panelW, state.panelH, viewportSize.w, viewportSize.h, fitToView]);

  // Keyboard shortcuts: F (Fit), 0 (1:1), Space (Pan)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (isInput) return;

      if (isDrawingPanel) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitDrawnPolygon();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onSetDrawingPanel(false);
          return;
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          setDraftPolyPoints((pts) => pts.slice(0, -1));
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        fitToView();
      } else if (e.key === '0') {
        e.preventDefault();
        setActualScale();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fitToView, setActualScale, isDrawingPanel, commitDrawnPolygon, onSetDrawingPanel]);

  // Cache unit motif Path2D whenever baseRings changes
  const cachedBasePath = useMemo(() => {
    const p = new Path2D();
    for (const ring of result.baseRings) {
      if (ring.length < 3) continue;
      p.moveTo(ring[0].x, ring[0].y);
      for (let i = 1; i < ring.length; i++) {
        p.lineTo(ring[i].x, ring[i].y);
      }
      p.closePath();
    }
    return p;
  }, [result.baseRings]);

  // Screen <-> World millimeter coordinate conversion
  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - view.tx) / view.scale,
      y: (sy - view.ty) / view.scale,
    }),
    [view]
  );

  const worldToScreen = useCallback(
    (wx: number, wy: number) => ({
      x: wx * view.scale + view.tx,
      y: wy * view.scale + view.ty,
    }),
    [view]
  );

  // Hit test interactive attractor handles on canvas
  const hitTestAttractors = useCallback(
    (sx: number, sy: number): DragMode | null => {
      if (!state.showAttractors) return null;

      for (let i = state.attractors.length - 1; i >= 0; i--) {
        const a = state.attractors[i];
        const p1 = worldToScreen(a.x * state.panelW, a.y * state.panelH);
        if (Math.hypot(sx - p1.x, sy - p1.y) <= 13) {
          return { type: 'attractor_p1', id: a.id };
        }
        if (a.type === 'line' && a.x2 !== undefined && a.y2 !== undefined) {
          const p2 = worldToScreen(a.x2 * state.panelW, a.y2 * state.panelH);
          if (Math.hypot(sx - p2.x, sy - p2.y) <= 13) {
            return { type: 'attractor_p2', id: a.id };
          }
        }
        // Radius resize handle on right side of circle
        const radHandle = worldToScreen(a.x * state.panelW + a.radius, a.y * state.panelH);
        if (Math.hypot(sx - radHandle.x, sy - radHandle.y) <= 11) {
          return { type: 'attractor_radius', id: a.id };
        }
      }
      return null;
    },
    [state.attractors, state.panelW, state.panelH, state.showAttractors, worldToScreen]
  );

  // Main HiDPI Canvas 2D Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = viewportSize.w;
    const ch = viewportSize.h;
    if (cw < 10 || ch < 10) return;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Studio desk backdrop
    ctx.fillStyle = state.studioMode === 'cad_wireframe' ? '#F6F7F9' : '#F0F0F2';
    ctx.fillRect(0, 0, cw, ch);

    // Subtle architectural dot grid on stage
    const stageStep = 28;
    ctx.fillStyle = '#D4D4D8';
    for (let gx = stageStep / 2; gx < cw; gx += stageStep) {
      for (let gy = stageStep / 2; gy < ch; gy += stageStep) {
        ctx.fillRect(gx, gy, 1, 1);
      }
    }

    // 2. Transform into world millimeter space
    ctx.save();
    ctx.translate(view.tx, view.ty);
    ctx.scale(view.scale, view.scale);

    const colors = resolveVisualColors(state);
    const invScale = 1 / Math.max(0.05, view.scale);

    // Build panel outline Path2D
    const panelPath = new Path2D();
    if (result.panelOutline.length >= 3) {
      panelPath.moveTo(result.panelOutline[0].x, result.panelOutline[0].y);
      for (let i = 1; i < result.panelOutline.length; i++) {
        panelPath.lineTo(result.panelOutline[i].x, result.panelOutline[i].y);
      }
      panelPath.closePath();
    }

    // Soft architectural elevation shadow under panel
    if (state.studioMode !== 'cad_wireframe') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = state.transparentBg ? 'rgba(255,255,255,0.6)' : colors.panelFill;
      ctx.fill(panelPath);
      ctx.restore();
    }

    // Clip interior for panel fill, brushed metal grain, halftone reference, and grid
    ctx.save();
    ctx.clip(panelPath);

    if (state.transparentBg && state.studioMode !== 'cad_wireframe') {
      // Subtle checkerboard inside transparent panel
      const checker = Math.max(8, 12 * invScale);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, state.panelW, state.panelH);
      ctx.fillStyle = '#EAEAEF';
      for (let y = 0; y < state.panelH; y += checker) {
        for (let x = 0; x < state.panelW; x += checker) {
          if ((Math.floor(x / checker) + Math.floor(y / checker)) % 2 === 0) {
            ctx.fillRect(x, y, checker, checker);
          }
        }
      }
    } else if (state.studioMode === 'brushed_metal') {
      const grad = ctx.createLinearGradient(0, 0, state.panelW, state.panelH);
      grad.addColorStop(0, '#DCE0E6');
      grad.addColorStop(0.45, '#C8CDD5');
      grad.addColorStop(1, '#B8BEC7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, state.panelW, state.panelH);

      // Subtle brushed aluminum grain streaks
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = Math.max(0.5, invScale * 0.75);
      const streakStep = Math.max(4, state.panelH / 90);
      ctx.beginPath();
      for (let sy = 0; sy < state.panelH; sy += streakStep) {
        ctx.moveTo(0, sy);
        ctx.lineTo(state.panelW, sy);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = colors.panelFill;
      ctx.fillRect(0, 0, state.panelW, state.panelH);
    }

    // Halftone reference image underlay
    if (
      state.imageMap.enabled &&
      state.imageMap.overlayOpacity > 0.01 &&
      imgElementRef.current &&
      imgElementRef.current.complete
    ) {
      ctx.save();
      ctx.globalAlpha = state.imageMap.overlayOpacity;
      ctx.drawImage(imgElementRef.current, 0, 0, state.panelW, state.panelH);
      ctx.restore();
    }

    // Millimeter engineering grid overlay inside panel
    if (state.showGrid) {
      const maxDim = Math.max(state.panelW, state.panelH);
      const majorStep = maxDim > 3200 ? 500 : maxDim > 1800 ? 250 : maxDim > 800 ? 100 : 50;
      const minorStep = majorStep / 5;
      ctx.strokeStyle =
        state.studioMode === 'acoustic_dark'
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(26,26,26,0.06)';
      ctx.lineWidth = invScale * 0.75;
      ctx.beginPath();
      for (let x = minorStep; x < state.panelW; x += minorStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, state.panelH);
      }
      for (let y = minorStep; y < state.panelH; y += minorStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(state.panelW, y);
      }
      ctx.stroke();

      ctx.strokeStyle =
        state.studioMode === 'acoustic_dark'
          ? 'rgba(255,255,255,0.13)'
          : 'rgba(26,26,26,0.12)';
      ctx.lineWidth = invScale * 1;
      ctx.beginPath();
      for (let x = majorStep; x < state.panelW; x += majorStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, state.panelH);
      }
      for (let y = majorStep; y < state.panelH; y += majorStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(state.panelW, y);
      }
      ctx.stroke();
    }

    ctx.restore(); // end panel clip

    // 3. Viewport-culled 60 FPS pattern rendering
    const visMinX = -view.tx / view.scale;
    const visMaxX = (cw - view.tx) / view.scale;
    const visMinY = -view.ty / view.scale;
    const visMaxY = (ch - view.ty) / view.scale;

    const shouldFill =
      state.studioMode !== 'cad_wireframe' &&
      (state.renderStyle === 'fill' || state.renderStyle === 'fill_stroke');
    const shouldStroke =
      state.studioMode === 'cad_wireframe' ||
      state.renderStyle === 'stroke' ||
      state.renderStyle === 'fill_stroke';

    ctx.lineJoin = 'round';
    const baseStrokeW =
      state.studioMode === 'cad_wireframe'
        ? Math.max(0.35, invScale * 1.1)
        : state.strokeWidth;

    const instances = result.instances;
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const br = inst.boundingRadius;
      // Fast frustum culling
      if (
        inst.x + br < visMinX ||
        inst.x - br > visMaxX ||
        inst.y + br < visMinY ||
        inst.y - br > visMaxY
      ) {
        continue;
      }

      const isErr = state.highlightCollisions && inst.isColliding;
      const isWarn = state.highlightCollisions && !inst.isColliding && inst.isThinBridge;

      const fillCol = isErr
        ? '#B91C1C'
        : isWarn
        ? '#B45309'
        : colors.holeFill;
      const strokeCol = isErr
        ? '#B91C1C'
        : isWarn
        ? '#B45309'
        : colors.holeStroke;

      if (inst.clippedRings) {
        ctx.beginPath();
        for (const ring of inst.clippedRings) {
          if (ring.length < 3) continue;
          ctx.moveTo(ring[0].x, ring[0].y);
          for (let k = 1; k < ring.length; k++) {
            ctx.lineTo(ring[k].x, ring[k].y);
          }
          ctx.closePath();
        }
        if (shouldFill) {
          ctx.fillStyle = fillCol;
          ctx.fill('evenodd');
        }
        if (shouldStroke) {
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = baseStrokeW;
          ctx.stroke();
        }
      } else {
        ctx.save();
        ctx.translate(inst.x, inst.y);
        ctx.rotate(inst.angle);
        ctx.scale(inst.scale, inst.scale);

        if (shouldFill) {
          ctx.fillStyle = fillCol;
          ctx.fill(cachedBasePath, 'evenodd');
        }
        if (shouldStroke) {
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = baseStrokeW / Math.max(0.1, inst.scale);
          ctx.stroke(cachedBasePath);
        }
        ctx.restore();
      }
    }

    // 4. Panel outer perimeter border
    ctx.strokeStyle =
      state.studioMode === 'cad_wireframe' ? '#1A73E8' : colors.outlineStroke;
    ctx.lineWidth = invScale * (state.studioMode === 'cad_wireframe' ? 1.5 : 1.1);
    ctx.stroke(panelPath);

    // 5. Safe border margin dashed guide
    if (state.showMargin && state.margin > 0.5) {
      const marginRing = buildPanelOutline(
        state.panelW,
        state.panelH,
        state.panelShape,
        state.cornerRadius,
        state.margin,
        state.customPanelPoints
      );
      if (marginRing.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(marginRing[0].x, marginRing[0].y);
        for (let i = 1; i < marginRing.length; i++) {
          ctx.lineTo(marginRing[i].x, marginRing[i].y);
        }
        ctx.closePath();
        ctx.setLineDash([invScale * 5, invScale * 4]);
        ctx.strokeStyle =
          state.studioMode === 'acoustic_dark'
            ? 'rgba(255,255,255,0.28)'
            : 'rgba(26,26,26,0.25)';
        ctx.lineWidth = invScale * 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Shift-snap axis alignment guides
    if (snapAxis.x || snapAxis.y) {
      ctx.save();
      ctx.strokeStyle = '#1A1A1A';
      ctx.lineWidth = invScale * 1;
      ctx.setLineDash([invScale * 4, invScale * 4]);
      ctx.beginPath();
      if (snapAxis.x) {
        ctx.moveTo(state.panelW * 0.5, -20 * invScale);
        ctx.lineTo(state.panelW * 0.5, state.panelH + 20 * invScale);
      }
      if (snapAxis.y) {
        ctx.moveTo(-20 * invScale, state.panelH * 0.5);
        ctx.lineTo(state.panelW + 20 * invScale, state.panelH * 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 7. Dimension labels along top & left of panel
    ctx.save();
    const fontSize = Math.max(9, 11 * invScale);
    ctx.font = `500 ${fontSize}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#737373';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.panelW} mm`, state.panelW * 0.5, -10 * invScale);
    ctx.save();
    ctx.translate(-12 * invScale, state.panelH * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${state.panelH} mm`, 0, 0);
    ctx.restore();
    ctx.restore();

    ctx.restore(); // back to screen pixel coordinates

    // 8. Interactive Attractor Overlay Handles (rendered in crisp screen pixels)
    if (state.showAttractors) {
      const isDarkPanel = state.studioMode === 'acoustic_dark';
      const accentStroke = isDarkPanel ? '#FFFFFF' : '#1A1A1A';

      for (let i = 0; i < state.attractors.length; i++) {
        const a = state.attractors[i];
        const p1 = worldToScreen(a.x * state.panelW, a.y * state.panelH);
        const radPx = a.radius * view.scale;
        const isSelected = selectedAttractorId === a.id || (i === 0 && !selectedAttractorId);

        // Influence radius circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, Math.max(8, radPx), 0, Math.PI * 2);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = isSelected
          ? isDarkPanel
            ? 'rgba(255,255,255,0.65)'
            : 'rgba(26,26,26,0.55)'
          : isDarkPanel
          ? 'rgba(255,255,255,0.3)'
          : 'rgba(26,26,26,0.28)';
        ctx.lineWidth = isSelected ? 1.4 : 1;
        ctx.stroke();
        ctx.restore();

        // Line attractor segment
        if (a.type === 'line' && a.x2 !== undefined && a.y2 !== undefined) {
          const p2 = worldToScreen(a.x2 * state.panelW, a.y2 * state.panelH);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = accentStroke;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p2.x, p2.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#1A1A1A';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // Radius resize knob on right perimeter
        const knobX = p1.x + Math.max(8, radPx);
        const knobY = p1.y;
        ctx.save();
        ctx.beginPath();
        ctx.arc(knobX, knobY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();

        // Center focal crosshair handle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, isSelected ? 8 : 6.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#1A1A1A' : '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#FFFFFF' : '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Small center dot
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#FFFFFF' : '#1A1A1A';
        ctx.fill();
        ctx.restore();
      }
    }

    // 9. Interactive Custom Polygon Vertex & Midpoint Handles (screen pixels)
    if (state.panelShape === 'custom_polygon' && !isDrawingPanel) {
      const pts = activePolyPoints;
      for (let i = 0; i < pts.length; i++) {
        const curr = worldToScreen(pts[i].x * state.panelW, pts[i].y * state.panelH);
        const nextPt = pts[(i + 1) % pts.length];
        const next = worldToScreen(nextPt.x * state.panelW, nextPt.y * state.panelH);
        const midX = (curr.x + next.x) * 0.5;
        const midY = (curr.y + next.y) * 0.5;

        // Edge midpoint "+" insert handle
        ctx.save();
        ctx.beginPath();
        ctx.arc(midX, midY, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fill();
        ctx.strokeStyle = '#737373';
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(midX - 2.5, midY);
        ctx.lineTo(midX + 2.5, midY);
        ctx.moveTo(midX, midY - 2.5);
        ctx.lineTo(midX, midY + 2.5);
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < pts.length; i++) {
        const sp = worldToScreen(pts[i].x * state.panelW, pts[i].y * state.panelH);
        ctx.save();
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 10. Freehand Polygon Drawing Mode Preview
    if (isDrawingPanel) {
      // Draw panel bounding guide box so user sees [0..panelW, 0..panelH] area
      const tl = worldToScreen(0, 0);
      const br = worldToScreen(state.panelW, state.panelH);
      ctx.save();
      ctx.strokeStyle = 'rgba(26,26,26,0.35)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();

      if (draftPolyPoints.length > 0) {
        ctx.save();
        ctx.beginPath();
        const first = worldToScreen(draftPolyPoints[0].x, draftPolyPoints[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < draftPolyPoints.length; i++) {
          const sp = worldToScreen(draftPolyPoints[i].x, draftPolyPoints[i].y);
          ctx.lineTo(sp.x, sp.y);
        }
        if (draftCursorWorld) {
          const cur = worldToScreen(draftCursorWorld.x, draftCursorWorld.y);
          ctx.lineTo(cur.x, cur.y);
        }
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw placed points (highlight first point larger when >= 3 points so user can close)
        for (let i = 0; i < draftPolyPoints.length; i++) {
          const sp = worldToScreen(draftPolyPoints[i].x, draftPolyPoints[i].y);
          const isCloseTarget = i === 0 && draftPolyPoints.length >= 3;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, isCloseTarget ? 8 : 5, 0, Math.PI * 2);
          ctx.fillStyle = isCloseTarget ? '#1A1A1A' : '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = isCloseTarget ? '#FFFFFF' : '#1A1A1A';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }, [
    state,
    result,
    view,
    viewportSize,
    cachedBasePath,
    selectedAttractorId,
    snapAxis,
    imageGrid,
    imgLoadedTick,
    isDrawingPanel,
    activePolyPoints,
    draftPolyPoints,
    draftCursorWorld,
  ]);

  // Native non-passive wheel listener to prevent browser scroll without passive-listener errors
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((prev) => {
        const nextScale = Math.max(0.02, Math.min(12, prev.scale * zoomFactor));
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          tx: mx - (mx - prev.tx) * ratio,
          ty: my - (my - prev.ty) * ratio,
        };
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // Hit test custom polygon vertex or midpoint handles
  const hitTestPolygonHandles = useCallback(
    (sx: number, sy: number): { kind: 'vertex' | 'midpoint'; index: number } | null => {
      if (state.panelShape !== 'custom_polygon' || isDrawingPanel) return null;
      const pts = activePolyPoints;
      for (let i = 0; i < pts.length; i++) {
        const sp = worldToScreen(pts[i].x * state.panelW, pts[i].y * state.panelH);
        if (Math.hypot(sx - sp.x, sy - sp.y) <= 11) {
          return { kind: 'vertex', index: i };
        }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = worldToScreen(pts[i].x * state.panelW, pts[i].y * state.panelH);
        const bPt = pts[(i + 1) % pts.length];
        const b = worldToScreen(bPt.x * state.panelW, bPt.y * state.panelH);
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        if (Math.hypot(sx - mx, sy - my) <= 9) {
          return { kind: 'midpoint', index: i };
        }
      }
      return null;
    },
    [state.panelShape, state.panelW, state.panelH, isDrawingPanel, activePolyPoints, worldToScreen]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (state.panelShape !== 'custom_polygon' || isDrawingPanel) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = hitTestPolygonHandles(sx, sy);
      if (hit?.kind === 'vertex' && activePolyPoints.length > 3) {
        e.preventDefault();
        const nextPts = activePolyPoints.filter((_, idx) => idx !== hit.index);
        onUpdateState((prev) => ({ ...prev, customPanelPoints: nextPts }), true);
      }
    },
    [state.panelShape, isDrawingPanel, hitTestPolygonHandles, activePolyPoints, onUpdateState]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (e.button === 1 || spacePressed) {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragMode({
          type: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          origTx: view.tx,
          origTy: view.ty,
        });
        return;
      }

      // Freehand polygon drawing mode
      if (isDrawingPanel && e.button === 0) {
        const world = screenToWorld(sx, sy);
        const clampedX = Math.max(0, Math.min(state.panelW, world.x));
        const clampedY = Math.max(0, Math.min(state.panelH, world.y));

        if (draftPolyPoints.length >= 3) {
          const firstScreen = worldToScreen(draftPolyPoints[0].x, draftPolyPoints[0].y);
          if (Math.hypot(sx - firstScreen.x, sy - firstScreen.y) <= 14) {
            commitDrawnPolygon();
            return;
          }
        }
        setDraftPolyPoints((pts) => [...pts, { x: clampedX, y: clampedY }]);
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);

      // Custom polygon vertex / midpoint editing
      if (e.button === 0) {
        const polyHit = hitTestPolygonHandles(sx, sy);
        if (polyHit?.kind === 'vertex') {
          setDragMode({ type: 'poly_vertex', index: polyHit.index });
          return;
        }
        if (polyHit?.kind === 'midpoint') {
          const a = activePolyPoints[polyHit.index];
          const b = activePolyPoints[(polyHit.index + 1) % activePolyPoints.length];
          const mid: Point2D = {
            x: Number(((a.x + b.x) * 0.5).toFixed(4)),
            y: Number(((a.y + b.y) * 0.5).toFixed(4)),
          };
          const insertIdx = polyHit.index + 1;
          const nextPts = [
            ...activePolyPoints.slice(0, insertIdx),
            mid,
            ...activePolyPoints.slice(insertIdx),
          ];
          onUpdateState((prev) => ({ ...prev, customPanelPoints: nextPts }), false);
          setDragMode({ type: 'poly_vertex', index: insertIdx });
          return;
        }
      }

      const hit = hitTestAttractors(sx, sy);
      if (hit) {
        if ('id' in hit) onSelectAttractor(hit.id);
        setDragMode(hit);
        return;
      }

      setDragMode({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origTx: view.tx,
        origTy: view.ty,
      });
    },
    [
      hitTestAttractors,
      hitTestPolygonHandles,
      activePolyPoints,
      onSelectAttractor,
      onUpdateState,
      spacePressed,
      view.tx,
      view.ty,
      isDrawingPanel,
      screenToWorld,
      worldToScreen,
      state.panelW,
      state.panelH,
      draftPolyPoints,
      commitDrawnPolygon,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (isDrawingPanel && !dragMode) {
        const world = screenToWorld(sx, sy);
        setDraftCursorWorld({
          x: Math.max(0, Math.min(state.panelW, world.x)),
          y: Math.max(0, Math.min(state.panelH, world.y)),
        });
        setHoverCursor('crosshair');
        return;
      }

      if (!dragMode) {
        const polyHit = hitTestPolygonHandles(sx, sy);
        if (polyHit?.kind === 'vertex') {
          setHoverCursor('move');
          return;
        }
        if (polyHit?.kind === 'midpoint') {
          setHoverCursor('copy');
          return;
        }
        const hit = hitTestAttractors(sx, sy);
        if (hit?.type === 'attractor_radius') {
          setHoverCursor('ew-resize');
        } else if (hit) {
          setHoverCursor('move');
        } else {
          setHoverCursor(spacePressed ? 'grab' : 'default');
        }
        return;
      }

      if (dragMode.type === 'pan') {
        const dx = e.clientX - dragMode.startX;
        const dy = e.clientY - dragMode.startY;
        setView((prev) => ({
          ...prev,
          tx: dragMode.origTx + dx,
          ty: dragMode.origTy + dy,
        }));
        return;
      }

      const world = screenToWorld(sx, sy);

      if (dragMode.type === 'poly_vertex') {
        let nx = Math.max(0, Math.min(1, world.x / state.panelW));
        let ny = Math.max(0, Math.min(1, world.y / state.panelH));
        if (e.shiftKey) {
          nx = Math.round(nx * 20) / 20;
          ny = Math.round(ny * 20) / 20;
        }
        onUpdateState((prev) => {
          const base =
            prev.customPanelPoints.length >= 3 ? prev.customPanelPoints : DEFAULT_CUSTOM_POLYGON;
          return {
            ...prev,
            customPanelPoints: base.map((p, idx) =>
              idx === dragMode.index
                ? { x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) }
                : p
            ),
          };
        }, false);
        return;
      }

      if (dragMode.type === 'attractor_p1' || dragMode.type === 'attractor_p2') {
        let nx = Math.max(-0.1, Math.min(1.1, world.x / state.panelW));
        let ny = Math.max(-0.1, Math.min(1.1, world.y / state.panelH));

        let snappedX = false;
        let snappedY = false;
        if (e.shiftKey) {
          if (Math.abs(nx - 0.5) < 0.045) {
            nx = 0.5;
            snappedX = true;
          }
          if (Math.abs(ny - 0.5) < 0.045) {
            ny = 0.5;
            snappedY = true;
          }
        }
        setSnapAxis({ x: snappedX, y: snappedY });

        onUpdateState(
          (prev) => ({
            ...prev,
            attractors: prev.attractors.map((a) => {
              if (a.id !== dragMode.id) return a;
              if (dragMode.type === 'attractor_p1') {
                return { ...a, x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) };
              }
              return { ...a, x2: Number(nx.toFixed(4)), y2: Number(ny.toFixed(4)) };
            }),
          }),
          false
        );
      } else if (dragMode.type === 'attractor_radius') {
        onUpdateState(
          (prev) => {
            const maxRadius = Math.max(1200, Math.round(Math.hypot(prev.panelW, prev.panelH) * 0.75));
            return {
              ...prev,
              attractors: prev.attractors.map((a) => {
                if (a.id !== dragMode.id) return a;
                const ax = a.x * prev.panelW;
                const ay = a.y * prev.panelH;
                const dist = Math.max(30, Math.min(maxRadius, Math.round(Math.hypot(world.x - ax, world.y - ay))));
                return { ...a, radius: dist };
              }),
              transitionRadius:
                prev.attractors[0]?.id === dragMode.id
                  ? Math.max(
                      30,
                      Math.min(
                        maxRadius,
                        Math.round(
                          Math.hypot(
                            world.x - prev.attractors[0].x * prev.panelW,
                            world.y - prev.attractors[0].y * prev.panelH
                          )
                        )
                      )
                    )
                  : prev.transitionRadius,
            };
          },
          false
        );
      }
    },
    [dragMode, hitTestAttractors, hitTestPolygonHandles, isDrawingPanel, onUpdateState, screenToWorld, spacePressed, state.panelW, state.panelH]
  );

  const handlePointerUp = useCallback(() => {
    if (dragMode && dragMode.type !== 'pan') {
      // Commit final drag state to undo stack
      onUpdateState((prev) => ({ ...prev }), true);
    }
    setDragMode(null);
    setSnapAxis({ x: false, y: false });
  }, [dragMode, onUpdateState]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (workspaceMode !== 'advanced') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (world.x < 0 || world.x > state.panelW || world.y < 0 || world.y > state.panelH) return;

      const newAttractor: Attractor = {
        id: `att-${Date.now()}`,
        type: 'point',
        x: Number((world.x / state.panelW).toFixed(4)),
        y: Number((world.y / state.panelH).toFixed(4)),
        radius: Math.round(Math.min(state.panelW, state.panelH) * 0.28),
        weight: 0.9,
        falloff: 'smoothstep',
      };
      onUpdateState(
        (prev) => ({
          ...prev,
          showAttractors: true,
          attractors: [...prev.attractors, newAttractor],
        }),
        true
      );
      onSelectAttractor(newAttractor.id);
    },
    [workspaceMode, screenToWorld, state.panelW, state.panelH, onUpdateState, onSelectAttractor]
  );

  // DFM Telemetry Status (never conveyed by color alone!)
  const { metrics } = result;
  const bridgeStatus =
    metrics.collisionCount > 0
      ? 'error'
      : metrics.minBridgeMm !== null && metrics.minBridgeMm < state.materialThickness
      ? 'warn'
      : 'ok';

  const zoomPercent = Math.round((view.scale / 3.7795) * 100);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full min-h-[360px] overflow-hidden select-none bg-[#F0F0F2]"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{
          width: '100%',
          height: '100%',
          cursor: dragMode?.type === 'pan' ? 'grabbing' : hoverCursor,
          touchAction: 'none',
        }}
      />

      {/* Drawing Mode Floating Action Banner */}
      {isDrawingPanel && (
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-[#1A1A1A] text-white px-3.5 py-2 rounded-lg shadow-lg text-xs">
          <span>{t.drawPolyHint}</span>
          <button
            type="button"
            disabled={draftPolyPoints.length < 3}
            onClick={commitDrawnPolygon}
            className="px-2.5 py-1 rounded bg-white text-[#1A1A1A] font-medium disabled:opacity-40 whitespace-nowrap"
          >
            {t.finishDrawing} ({draftPolyPoints.length})
          </button>
          <button
            type="button"
            onClick={() => onSetDrawingPanel(false)}
            className="px-2 py-1 rounded border border-white/30 text-white hover:bg-white/10 whitespace-nowrap"
          >
            {t.cancelDrawing}
          </button>
        </div>
      )}

      {/* Quiet top-right hint in canvas */}
      {!isDrawingPanel && (
        <div className="pointer-events-none hidden lg:block absolute top-3.5 right-4 text-[11px] text-[#737373] bg-white/85 backdrop-blur-xs px-2.5 py-1 rounded border border-[#E4E4E7]">
          {t.canvasHint}
        </div>
      )}

      {/* Floating minimalist bottom telemetry & viewport controls bar */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur-xs border border-[#E4E4E7] rounded-lg px-3.5 py-2 shadow-xs">
        {/* Left: Real Engineering Telemetry (zero static pills — clean inline tabular text) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[#737373]">{t.metricShapes}</span>
            <span className="font-mono-tabular font-semibold text-[#1A1A1A]">
              {metrics.instanceCount.toLocaleString()}
            </span>
          </div>

          <span className="text-[#D4D4D8]" aria-hidden="true">·</span>

          <div className="flex items-baseline gap-1.5">
            <span className="text-[#737373]">{t.metricFocusOar}</span>
            <span className="font-mono-tabular font-semibold text-[#1A1A1A]">
              {metrics.focusOarPercent.toFixed(1)}%
            </span>
          </div>

          {workspaceMode === 'advanced' && (
            <>
              <span className="text-[#D4D4D8]" aria-hidden="true">·</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[#737373]">{t.metricPanelOar}</span>
                <span className="font-mono-tabular font-semibold text-[#1A1A1A]">
                  {metrics.panelOarPercent.toFixed(1)}%
                </span>
              </div>
            </>
          )}

          <span className="text-[#D4D4D8]" aria-hidden="true">·</span>

          <div className="flex items-center gap-1.5">
            <span className="text-[#737373]">{t.metricMinBridge}</span>
            <span
              className="font-mono-tabular font-semibold"
              style={{
                color:
                  bridgeStatus === 'error'
                    ? 'var(--aw-status-error)'
                    : bridgeStatus === 'warn'
                    ? 'var(--aw-status-warn)'
                    : 'var(--aw-status-ok)',
              }}
            >
              {metrics.minBridgeMm !== null ? `${metrics.minBridgeMm.toFixed(2)} mm` : '—'}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium"
              style={{
                color:
                  bridgeStatus === 'error'
                    ? 'var(--aw-status-error)'
                    : bridgeStatus === 'warn'
                    ? 'var(--aw-status-warn)'
                    : 'var(--aw-status-ok)',
              }}
            >
              {bridgeStatus === 'error' ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{t.statusCollision} ({metrics.collisionCount})</span>
                </>
              ) : bridgeStatus === 'warn' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{t.statusThinBridge}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.statusOptimal}</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Right: Interactive Viewport Overlays & Zoom Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateState((p) => ({ ...p, showGrid: !p.showGrid }), false)}
            title={t.toggleGrid}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              state.showGrid
                ? 'bg-[#1A1A1A] text-white'
                : 'text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A]'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.toggleGrid}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateState((p) => ({ ...p, showMargin: !p.showMargin }), false)}
            title={t.toggleMargin}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              state.showMargin
                ? 'bg-[#1A1A1A] text-white'
                : 'text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A]'
            }`}
          >
            <SquareDashed className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.toggleMargin}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateState((p) => ({ ...p, showAttractors: !p.showAttractors }), false)
            }
            title={t.toggleAttractors}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              state.showAttractors
                ? 'bg-[#1A1A1A] text-white'
                : 'text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.toggleAttractors}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateState((p) => ({ ...p, highlightCollisions: !p.highlightCollisions }), false)
            }
            title={t.toggleCollisions}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              state.highlightCollisions
                ? 'bg-[#1A1A1A] text-white'
                : 'text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A]'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.toggleCollisions}</span>
          </button>

          <div className="w-px h-4 bg-[#E4E4E7] mx-1" />

          <button
            type="button"
            onClick={() => fitToView()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A] rounded transition-colors whitespace-nowrap shrink-0"
            title={t.fitView}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>{t.fitView}</span>
          </button>

          <button
            type="button"
            onClick={setActualScale}
            className="px-2 py-1 text-[11px] font-mono-tabular text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A] rounded transition-colors whitespace-nowrap shrink-0"
            title={t.actualScale}
          >
            {zoomPercent}%
          </button>
        </div>
      </div>
    </div>
  );
};
