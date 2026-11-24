import React, { useRef, useState } from 'react';
import {
  Check,
  Dices,
  Image as ImageIcon,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import type {
  Attractor,
  AttractorFalloff,
  CustomSvgMotifData,
  EdgeClipMode,
  ImageLuminanceGrid,
  Locale,
  OrientationMode,
  PanelShape,
  PatternState,
  PivotMode,
  RenderStyle,
  StudioMode,
  TopologyType,
  WorkspaceMode,
} from '../engine/types';
import { BUILT_IN_MOTIF_LIST } from '../motifs/motifs';
import { parseCustomPanelSvg, parseCustomSvgMotif } from '../motifs/svgParser';
import { DEFAULT_CUSTOM_POLYGON } from '../engine/panelGeometry';
import { loadImageLuminanceGrid } from '../engine/imageMap';
import { PANEL_ASPECT_PRESETS, PATTERN_PRESETS } from '../presets/presets';
import type { Translations } from '../i18n/translations';
import {
  MotifMiniIcon,
  SectionGroup,
  SegmentedControl,
  SliderControl,
} from './ControlPrimitives';

interface ControlSidebarProps {
  state: PatternState;
  workspaceMode: WorkspaceMode;
  locale: Locale;
  t: Translations;
  canUndo: boolean;
  canRedo: boolean;
  hasCustomAdvancedParams: boolean;
  customMotif: CustomSvgMotifData | null;
  imageGrid: ImageLuminanceGrid | null;
  selectedAttractorId: string | null;
  isDrawingPanel: boolean;
  onChangeWorkspaceMode: (mode: WorkspaceMode) => void;
  onUpdateState: (updater: (prev: PatternState) => PatternState, recordHistory?: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRandomize: () => void;
  onShareUrl: () => void;
  shareCopied: boolean;
  onReset: () => void;
  onCustomMotifChange: (motif: CustomSvgMotifData | null) => void;
  onImageGridChange: (grid: ImageLuminanceGrid | null) => void;
  onSelectAttractor: (id: string | null) => void;
  onSetDrawingPanel: (drawing: boolean) => void;
}

const TOPOLOGIES: TopologyType[] = [
  'hexagonal',
  'square_grid',
  'staggered_matrix',
  'diamond_matrix',
  'wave_flow',
  'vortex',
  'fibonacci',
  'concentric_radial',
  'diagonal_stripes',
  'sine_interference',
  'sunburst_rays',
  'organic_voronoi',
];

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  state,
  workspaceMode,
  locale,
  t,
  canUndo,
  canRedo,
  hasCustomAdvancedParams,
  customMotif,
  imageGrid,
  selectedAttractorId,
  isDrawingPanel,
  onChangeWorkspaceMode,
  onUpdateState,
  onUndo,
  onRedo,
  onRandomize,
  onShareUrl,
  shareCopied,
  onReset,
  onCustomMotifChange,
  onImageGridChange,
  onSelectAttractor,
  onSetDrawingPanel,
}) => {
  const svgInputRef = useRef<HTMLInputElement | null>(null);
  const panelSvgInputRef = useRef<HTMLInputElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const [svgError, setSvgError] = useState<string | null>(null);
  const [panelSvgError, setPanelSvgError] = useState<string | null>(null);

  const patch = (partial: Partial<PatternState>, recordHistory = false) => {
    onUpdateState((prev) => ({ ...prev, ...partial }), recordHistory);
  };

  const commit = () => {
    onUpdateState((prev) => ({ ...prev }), true);
  };

  const handlePanelSvgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPanelSvgError(null);
    try {
      const text = await file.text();
      const parsed = parseCustomPanelSvg(text, file.name);
      if (!parsed) {
        setPanelSvgError(t.svgError);
        return;
      }
      onSetDrawingPanel(false);
      onUpdateState((prev) => {
        const nextH = Math.max(50, Math.min(5000, Math.round(prev.panelW / Math.max(0.15, Math.min(6, parsed.aspect)))));
        return {
          ...prev,
          panelShape: 'custom_svg',
          panelH: nextH,
          customPanelPoints: parsed.points,
          customPanelName: parsed.name,
        };
      }, true);
    } catch {
      setPanelSvgError(t.svgError);
    } finally {
      e.target.value = '';
    }
  };

  const handleSvgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSvgError(null);
    try {
      const text = await file.text();
      const parsed = parseCustomSvgMotif(text, file.name);
      if (!parsed) {
        setSvgError(t.svgError);
        return;
      }
      onCustomMotifChange(parsed);
      patch({ motifId: 'custom_svg' }, true);
    } catch {
      setSvgError(t.svgError);
    } finally {
      e.target.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const grid = await loadImageLuminanceGrid(file);
      onImageGridChange(grid);
      onUpdateState(
        (prev) => ({
          ...prev,
          imageMap: {
            ...prev.imageMap,
            enabled: true,
            fileName: file.name,
          },
        }),
        true
      );
    } catch {
      // Ignore invalid image files gracefully
    } finally {
      e.target.value = '';
    }
  };

  const applyStudioMode = (mode: StudioMode) => {
    const colorMap: Record<StudioMode, { panelColor: string; holeColor: string }> = {
      architectural_light: { panelColor: '#FFFFFF', holeColor: '#1A1A1A' },
      acoustic_dark: { panelColor: '#16181C', holeColor: '#E4E4E7' },
      brushed_metal: { panelColor: '#D0D4DA', holeColor: '#101113' },
      cad_wireframe: { panelColor: '#FFFFFF', holeColor: '#D93025' },
    };
    patch({ studioMode: mode, ...colorMap[mode] }, true);
  };

  const addAttractor = (type: 'point' | 'line') => {
    const id = `att-${Date.now()}`;
    const newItem: Attractor =
      type === 'line'
        ? {
            id,
            type: 'line',
            x: 0.3,
            y: 0.5,
            x2: 0.7,
            y2: 0.5,
            radius: Math.round(Math.min(state.panelW, state.panelH) * 0.3),
            weight: 1.0,
            falloff: 'smoothstep',
          }
        : {
            id,
            type: 'point',
            x: Number((0.25 + (state.attractors.length % 3) * 0.25).toFixed(2)),
            y: 0.5,
            radius: Math.round(Math.min(state.panelW, state.panelH) * 0.3),
            weight: 0.9,
            falloff: 'smoothstep',
          };

    onUpdateState(
      (prev) => ({
        ...prev,
        showAttractors: true,
        attractors: [...prev.attractors, newItem],
      }),
      true
    );
    onSelectAttractor(id);
  };

  const updateAttractor = (id: string, updates: Partial<Attractor>, record = false) => {
    onUpdateState(
      (prev) => ({
        ...prev,
        attractors: prev.attractors.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        transitionRadius:
          prev.attractors[0]?.id === id && updates.radius !== undefined
            ? updates.radius
            : prev.transitionRadius,
      }),
      record
    );
  };

  const removeAttractor = (id: string) => {
    if (state.attractors.length <= 1) return;
    onUpdateState(
      (prev) => ({
        ...prev,
        attractors: prev.attractors.filter((a) => a.id !== id),
      }),
      true
    );
    if (selectedAttractorId === id) onSelectAttractor(null);
  };

  return (
    <aside className="w-full lg:w-[344px] xl:w-[364px] shrink-0 bg-[#FAFAFA] border-t lg:border-t-0 lg:border-r border-[#E4E4E7] flex flex-col h-[46vh] lg:h-full overflow-hidden">
      {/* Mode switcher & quick studio utilities */}
      <div className="px-4 py-3 border-b border-[#E4E4E7] bg-white space-y-2.5 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-[#F4F4F5] rounded-md">
          <button
            type="button"
            onClick={() => onChangeWorkspaceMode('simple')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              workspaceMode === 'simple'
                ? 'bg-white text-[#1A1A1A] shadow-xs'
                : 'text-[#595959] hover:text-[#1A1A1A]'
            }`}
          >
            {t.modeSimple}
          </button>
          <button
            type="button"
            onClick={() => onChangeWorkspaceMode('advanced')}
            title={hasCustomAdvancedParams ? t.advancedActiveHint : undefined}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
              workspaceMode === 'advanced'
                ? 'bg-white text-[#1A1A1A] shadow-xs'
                : 'text-[#595959] hover:text-[#1A1A1A]'
            }`}
          >
            <span>{t.modeAdvanced}</span>
            {workspaceMode === 'simple' && hasCustomAdvancedParams && (
              <span
                className="text-[#1A1A1A] font-bold leading-none"
                aria-label={t.advancedActiveHint}
              >
                •
              </span>
            )}
          </button>
        </div>

        {/* Action utility row: Undo, Redo, Randomize, Share, Reset */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title={`${t.undo} (Ctrl+Z)`}
              className="p-1.5 rounded text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A] disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title={`${t.redo} (Ctrl+Shift+Z)`}
              className="p-1.5 rounded text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A] disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onReset}
              title={t.resetDefaults}
              className="p-1.5 rounded text-[#595959] hover:bg-[#F4F4F5] hover:text-[#1A1A1A] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRandomize}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#1A1A1A] bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded transition-colors whitespace-nowrap"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>{t.randomize}</span>
            </button>
            <button
              type="button"
              onClick={onShareUrl}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#1A1A1A] bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded transition-colors whitespace-nowrap"
            >
              {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{shareCopied ? t.copied : t.shareUrl}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable control sections */}
      <div className="flex-1 overflow-y-auto aw-scroll px-4 py-2">
        {/* 1. Starter Templates (Compact in Simple mode) */}
        <SectionGroup title={t.secPresets} defaultOpen={workspaceMode === 'simple'}>
          <div className="grid grid-cols-2 gap-1.5">
            {PATTERN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onUpdateState(() => ({ ...preset.state }), true)}
                className="text-left px-2.5 py-2 rounded-md border border-[#E4E4E7] bg-white hover:border-[#1A1A1A] transition-colors group"
              >
                <div className="text-xs font-medium text-[#1A1A1A] truncate">
                  {locale === 'tr' ? preset.nameTr : preset.nameEn}
                </div>
                <div className="text-[11px] text-[#737373] truncate mt-0.5">
                  {locale === 'tr' ? preset.sectorTr : preset.sectorEn}
                </div>
              </button>
            ))}
          </div>
        </SectionGroup>

        {/* 2. Panel Format & Dimensions */}
        <SectionGroup title={t.secPanel} defaultOpen={true}>
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[#595959]">{t.panelAspectPresets}</div>
            <div className="flex flex-wrap gap-1.5">
              {PANEL_ASPECT_PRESETS.map((asp) => (
                <button
                  key={asp.id}
                  type="button"
                  onClick={() =>
                    patch(
                      {
                        panelShape: asp.panelShape,
                        panelW: asp.panelW,
                        panelH: asp.panelH,
                        cornerRadius: asp.cornerRadius,
                      },
                      true
                    )
                  }
                  className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                    state.panelW === asp.panelW &&
                    state.panelH === asp.panelH &&
                    state.panelShape === asp.panelShape
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-white text-[#595959] border-[#E4E4E7] hover:border-[#94949C] hover:text-[#1A1A1A]'
                  }`}
                >
                  {locale === 'tr' ? asp.labelTr : asp.labelEn}
                </button>
              ))}
            </div>
          </div>

          <SliderControl
            label={t.widthMm}
            value={state.panelW}
            min={50}
            max={5000}
            step={10}
            unit="mm"
            onChange={(v) =>
              onUpdateState((prev) => {
                const clampedW = Math.max(50, Math.min(5000, Math.round(v)));
                const maxMargin = Math.floor(Math.min(clampedW, prev.panelH) * 0.45);
                const maxCorner = Math.round(Math.min(clampedW, prev.panelH) * 0.5);
                return {
                  ...prev,
                  panelW: clampedW,
                  margin: Math.min(prev.margin, maxMargin),
                  cornerRadius: Math.min(prev.cornerRadius, maxCorner),
                };
              })
            }
            onCommit={commit}
          />

          <SliderControl
            label={t.heightMm}
            value={state.panelH}
            min={50}
            max={5000}
            step={10}
            unit="mm"
            onChange={(v) =>
              onUpdateState((prev) => {
                const clampedH = Math.max(50, Math.min(5000, Math.round(v)));
                const maxMargin = Math.floor(Math.min(prev.panelW, clampedH) * 0.45);
                const maxCorner = Math.round(Math.min(prev.panelW, clampedH) * 0.5);
                return {
                  ...prev,
                  panelH: clampedH,
                  margin: Math.min(prev.margin, maxMargin),
                  cornerRadius: Math.min(prev.cornerRadius, maxCorner),
                };
              })
            }
            onCommit={commit}
          />

          <p className="text-[11px] leading-snug text-[#737373]">
            {locale === 'tr'
              ? 'Çalışma alanı sınırı: 50 – 5000 mm (elle yazılabilir veya kaydırılabilir).'
              : 'Workspace limits: 50 – 5000 mm (type exact mm or drag slider).'}
          </p>

          {/* Panel Shape Selector — available in both Simple & Advanced modes */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[#595959]">{t.panelShape}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['rect', t.shapeRect],
                  ['rounded_rect', t.shapeRounded],
                  ['circle', t.shapeCircle],
                  ['capsule', t.shapeCapsule],
                  ['triangle', t.shapeTriangle],
                  ['hexagon', t.shapeHexagon],
                  ['octagon', t.shapeOctagon],
                  ['arch', t.shapeArch],
                  ['l_shape', t.shapeLShape],
                  ['custom_polygon', t.shapeCustomPoly],
                  ['custom_svg', t.shapeCustomSvg],
                ] as [PanelShape, string][]
              ).map(([shapeId, label]) => {
                const active = state.panelShape === shapeId;
                return (
                  <button
                    key={shapeId}
                    type="button"
                    onClick={() => {
                      if (shapeId !== 'custom_polygon') onSetDrawingPanel(false);
                      if (shapeId === 'custom_polygon' && state.customPanelPoints.length < 3) {
                        patch(
                          { panelShape: 'custom_polygon', customPanelPoints: DEFAULT_CUSTOM_POLYGON },
                          true
                        );
                      } else if (shapeId === 'custom_svg' && state.customPanelPoints.length < 3) {
                        patch({ panelShape: 'custom_svg' }, true);
                        panelSvgInputRef.current?.click();
                      } else {
                        patch({ panelShape: shapeId }, true);
                      }
                    }}
                    className={`px-2 py-1.5 text-[11px] font-medium rounded-md border transition-colors truncate ${
                      active
                        ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                        : 'bg-white text-[#595959] border-[#E4E4E7] hover:border-[#94949C] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            ref={panelSvgInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            onChange={handlePanelSvgUpload}
            className="hidden"
          />

          {state.panelShape === 'custom_polygon' && (
            <div className="space-y-2 p-2.5 rounded-md bg-white border border-[#E4E4E7]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSetDrawingPanel(!isDrawingPanel)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    isDrawingPanel
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-white text-[#1A1A1A] border-[#94949C] hover:border-[#1A1A1A]'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{isDrawingPanel ? t.cancelDrawing : t.drawPolygon}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSetDrawingPanel(false);
                    patch({ customPanelPoints: DEFAULT_CUSTOM_POLYGON }, true);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#595959] hover:text-[#1A1A1A] bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded-md transition-colors whitespace-nowrap"
                >
                  {t.resetPolygon}
                </button>
              </div>
              <p className="text-[11px] leading-snug text-[#737373]">{t.customPolyHint}</p>
            </div>
          )}

          {state.panelShape === 'custom_svg' && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => panelSvgInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#94949C] hover:border-[#1A1A1A] bg-white text-[#1A1A1A] transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="truncate">
                  {state.customPanelName ? `${state.customPanelName}.svg` : t.uploadPanelSvg}
                </span>
              </button>
              {panelSvgError && <p className="text-[11px] text-[#B91C1C]">{panelSvgError}</p>}
            </div>
          )}

          {state.panelShape === 'rounded_rect' && (
            <SliderControl
              label={t.cornerRadiusMm}
              value={state.cornerRadius}
              min={0}
              max={Math.round(Math.min(state.panelW, state.panelH) * 0.5)}
              step={2}
              unit="mm"
              onChange={(v) => patch({ cornerRadius: v })}
              onCommit={commit}
            />
          )}

          {workspaceMode === 'advanced' && (
            <>
              <SliderControl
                label={t.borderMarginMm}
                value={state.margin}
                min={0}
                max={Math.min(500, Math.floor(Math.min(state.panelW, state.panelH) * 0.45))}
                step={1}
                unit="mm"
                onChange={(v) => patch({ margin: v })}
                onCommit={commit}
              />

              <SegmentedControl<EdgeClipMode>
                label={t.edgeClipMode}
                value={state.edgeClipMode}
                onChange={(v) => patch({ edgeClipMode: v }, true)}
                options={[
                  { value: 'center', label: t.clipCenter },
                  { value: 'complete', label: t.clipComplete },
                  { value: 'boundary_clip', label: t.clipBoundary },
                ]}
              />
            </>
          )}
        </SectionGroup>

        {/* 3. Motif & Custom SVG */}
        <SectionGroup title={t.secMotif} defaultOpen={true}>
          <div className="grid grid-cols-5 gap-1.5">
            {BUILT_IN_MOTIF_LIST.map((mId) => {
              const active = state.motifId === mId;
              return (
                <button
                  key={mId}
                  type="button"
                  onClick={() => patch({ motifId: mId }, true)}
                  title={t.motifNames[mId]}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border transition-colors ${
                    active
                      ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                      : 'bg-white border-[#E4E4E7] text-[#595959] hover:border-[#94949C]'
                  }`}
                >
                  <MotifMiniIcon motifId={mId} active={active} />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={svgInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handleSvgUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => svgInputRef.current?.click()}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                state.motifId === 'custom_svg'
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white text-[#1A1A1A] border-[#94949C] hover:border-[#1A1A1A]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="truncate">
                {customMotif && state.motifId === 'custom_svg'
                  ? `${t.customSvgActive}: ${customMotif.name}`
                  : t.uploadSvg}
              </span>
            </button>
            {customMotif && (
              <button
                type="button"
                onClick={() => {
                  onCustomMotifChange(null);
                  patch({ motifId: 'circle' }, true);
                }}
                title={t.clearCustomSvg}
                className="p-2 rounded-md border border-[#E4E4E7] bg-white text-[#595959] hover:text-[#B91C1C] hover:border-[#B91C1C] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {svgError && <p className="text-[11px] text-[#B91C1C]">{svgError}</p>}

          {workspaceMode === 'advanced' && (
            <>
              <SegmentedControl<PivotMode>
                label={t.pivotMode}
                value={state.pivot}
                onChange={(v) => patch({ pivot: v }, true)}
                options={[
                  { value: 'left', label: t.pivotLeft },
                  { value: 'center', label: t.pivotCenter },
                  { value: 'right', label: t.pivotRight },
                ]}
              />

              <SegmentedControl<OrientationMode>
                label={t.orientationMode}
                value={state.orientationMode}
                onChange={(v) => patch({ orientationMode: v }, true)}
                options={[
                  { value: 'flow', label: t.orientFlow },
                  { value: 'fixed', label: t.orientFixed },
                  { value: 'radial', label: t.orientRadial },
                ]}
              />

              <SliderControl
                label={t.baseAngle}
                value={state.baseAngle}
                min={0}
                max={360}
                step={5}
                unit="°"
                onChange={(v) => patch({ baseAngle: v })}
                onCommit={commit}
              />

              <SliderControl
                label={t.kerfComp}
                value={state.kerf}
                min={0}
                max={1}
                step={0.05}
                unit="mm"
                hint={t.kerfHint}
                onChange={(v) => patch({ kerf: v })}
                onCommit={commit}
              />
            </>
          )}
        </SectionGroup>

        {/* 4. Topology & Density */}
        <SectionGroup title={t.secTopology} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-1.5">
            {TOPOLOGIES.map((topo) => {
              const active = state.topology === topo;
              return (
                <button
                  key={topo}
                  type="button"
                  onClick={() => patch({ topology: topo }, true)}
                  className={`px-2.5 py-1.5 text-left text-xs font-medium rounded-md border transition-colors truncate ${
                    active
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-white text-[#595959] border-[#E4E4E7] hover:border-[#94949C] hover:text-[#1A1A1A]'
                  }`}
                >
                  {t.topologyNames[topo]}
                </button>
              );
            })}
          </div>

          <SliderControl
            label={workspaceMode === 'simple' ? t.densityLabel : t.pitchMm}
            value={state.pitch}
            min={8}
            max={Math.min(300, Math.max(80, Math.round(Math.max(state.panelW, state.panelH) / 16)))}
            step={1}
            unit="mm"
            onChange={(v) => patch({ pitch: v })}
            onCommit={commit}
          />

          <SliderControl
            label={workspaceMode === 'simple' ? t.sizeLabel : t.centerScale}
            value={state.centerScale}
            min={0.2}
            max={2.2}
            step={0.05}
            unit="×"
            onChange={(v) => patch({ centerScale: v })}
            onCommit={commit}
          />

          <SliderControl
            label={workspaceMode === 'simple' ? t.spreadLabel : t.transitionRadiusMm}
            value={state.transitionRadius}
            min={40}
            max={Math.max(900, Math.round(Math.hypot(state.panelW, state.panelH) * 0.6))}
            step={10}
            unit="mm"
            onChange={(v) =>
              onUpdateState((prev) => ({
                ...prev,
                transitionRadius: v,
                attractors: prev.attractors.map((a, idx) =>
                  idx === 0 ? { ...a, radius: v } : a
                ),
              }))
            }
            onCommit={commit}
          />

          {workspaceMode === 'advanced' && (
            <>
              <SliderControl
                label={t.edgeCompression}
                value={state.edgeSpacingRatio}
                min={0.35}
                max={1.35}
                step={0.02}
                hint={t.edgeCompressionHint}
                onChange={(v) => patch({ edgeSpacingRatio: v })}
                onCommit={commit}
              />

              <SegmentedControl
                label={t.continuityMode}
                value={state.continuityMode}
                onChange={(v) => patch({ continuityMode: v }, true)}
                options={[
                  { value: 'infinite_lattice', label: t.contInfinite },
                  { value: 'isolated_island', label: t.contIsolated },
                ]}
              />

              {state.continuityMode === 'infinite_lattice' && (
                <SliderControl
                  label={t.ambientScale}
                  value={state.ambientScale}
                  min={0.05}
                  max={1.2}
                  step={0.02}
                  unit="×"
                  onChange={(v) => patch({ ambientScale: v })}
                  onCommit={commit}
                />
              )}

              {(state.topology === 'wave_flow' || state.topology === 'sine_interference') && (
                <>
                  <SliderControl
                    label={t.waveAmplitude}
                    value={state.waveAmplitude}
                    min={0}
                    max={140}
                    step={2}
                    unit="mm"
                    onChange={(v) => patch({ waveAmplitude: v })}
                    onCommit={commit}
                  />
                  <SliderControl
                    label={t.waveFrequency}
                    value={state.waveFrequency}
                    min={0.5}
                    max={6}
                    step={0.1}
                    onChange={(v) => patch({ waveFrequency: v })}
                    onCommit={commit}
                  />
                </>
              )}

              {state.topology === 'vortex' && (
                <SliderControl
                  label={t.vortexTwist}
                  value={state.vortexTwist}
                  min={-3}
                  max={3}
                  step={0.1}
                  onChange={(v) => patch({ vortexTwist: v })}
                  onCommit={commit}
                />
              )}

              <SliderControl
                label={t.jitterLabel}
                value={state.jitter}
                min={0}
                max={0.45}
                step={0.01}
                onChange={(v) => patch({ jitter: v })}
                onCommit={commit}
              />

              <SliderControl
                label={t.seedLabel}
                value={state.seed}
                min={1}
                max={9999}
                step={1}
                onChange={(v) => patch({ seed: Math.round(v) })}
                onCommit={commit}
              />
            </>
          )}
        </SectionGroup>

        {/* 5. Multi-Attractor Controls (Advanced) */}
        {workspaceMode === 'advanced' && (
          <SectionGroup title={t.secAttractors} defaultOpen={false}>
            <p className="text-[11px] leading-relaxed text-[#737373]">
              {t.attractorHintAdvanced}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addAttractor('point')}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#94949C] hover:border-[#1A1A1A] text-[#1A1A1A] rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addPointAttractor}</span>
              </button>
              <button
                type="button"
                onClick={() => addAttractor('line')}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#94949C] hover:border-[#1A1A1A] text-[#1A1A1A] rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addLineAttractor}</span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              {state.attractors.map((att, idx) => (
                <div
                  key={att.id}
                  onClick={() => onSelectAttractor(att.id)}
                  className={`p-3 rounded-md border transition-colors space-y-2.5 ${
                    selectedAttractorId === att.id
                      ? 'border-[#1A1A1A] bg-white'
                      : 'border-[#E4E4E7] bg-white/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1A1A1A]">
                      #{idx + 1} · {att.type === 'line' ? 'Line' : 'Point'} (
                      <span className="font-mono-tabular">
                        {Math.round(att.x * state.panelW)}, {Math.round(att.y * state.panelH)}
                      </span>
                      )
                    </span>
                    {state.attractors.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttractor(att.id);
                        }}
                        className="text-[#737373] hover:text-[#B91C1C] transition-colors"
                        title={t.remove}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <SliderControl
                    label={t.attractorRadius}
                    value={att.radius}
                    min={30}
                    max={Math.max(900, Math.round(Math.hypot(state.panelW, state.panelH) * 0.6))}
                    step={10}
                    unit="mm"
                    onChange={(v) => updateAttractor(att.id, { radius: v })}
                    onCommit={commit}
                  />
                  <SliderControl
                    label={t.attractorWeight}
                    value={att.weight}
                    min={0.2}
                    max={2.0}
                    step={0.05}
                    onChange={(v) => updateAttractor(att.id, { weight: v })}
                    onCommit={commit}
                  />
                  <SegmentedControl<AttractorFalloff>
                    label={t.attractorFalloff}
                    value={att.falloff}
                    onChange={(v) => updateAttractor(att.id, { falloff: v }, true)}
                    options={[
                      { value: 'smoothstep', label: t.falloffSmooth },
                      { value: 'linear', label: t.falloffLinear },
                      { value: 'gaussian', label: t.falloffGaussian },
                    ]}
                  />
                </div>
              ))}
            </div>
          </SectionGroup>
        )}

        {/* 6. Image Brightness / Halftone Modulator (Advanced) */}
        {workspaceMode === 'advanced' && (
          <SectionGroup title={t.secImageMap} defaultOpen={false}>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#94949C] hover:border-[#1A1A1A] text-[#1A1A1A] rounded-md transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="truncate">
                  {state.imageMap.fileName || t.uploadImage}
                </span>
              </button>
              {imageGrid && (
                <button
                  type="button"
                  onClick={() => {
                    onImageGridChange(null);
                    onUpdateState(
                      (prev) => ({
                        ...prev,
                        imageMap: { ...prev.imageMap, enabled: false, fileName: '' },
                      }),
                      true
                    );
                  }}
                  title={t.removeImage}
                  className="p-2 rounded-md border border-[#E4E4E7] bg-white text-[#595959] hover:text-[#B91C1C]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {imageGrid && (
              <div className="space-y-3 pt-1">
                <SegmentedControl<'scale' | 'angle' | 'both'>
                  label={t.imageTarget}
                  value={state.imageMap.target}
                  onChange={(v) =>
                    onUpdateState(
                      (prev) => ({ ...prev, imageMap: { ...prev.imageMap, target: v } }),
                      true
                    )
                  }
                  options={[
                    { value: 'scale', label: t.targetScale },
                    { value: 'angle', label: t.targetAngle },
                    { value: 'both', label: t.targetBoth },
                  ]}
                />

                <label className="flex items-center justify-between text-xs text-[#595959] cursor-pointer">
                  <span>{t.invertLuminance}</span>
                  <input
                    type="checkbox"
                    checked={state.imageMap.invert}
                    onChange={(e) =>
                      onUpdateState(
                        (prev) => ({
                          ...prev,
                          imageMap: { ...prev.imageMap, invert: e.target.checked },
                        }),
                        true
                      )
                    }
                    className="w-4 h-4 accent-[#1A1A1A] rounded"
                  />
                </label>

                <SliderControl
                  label={t.contrastLabel}
                  value={state.imageMap.contrast}
                  min={0.5}
                  max={3.0}
                  step={0.05}
                  onChange={(v) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      imageMap: { ...prev.imageMap, contrast: v },
                    }))
                  }
                  onCommit={commit}
                />

                <SliderControl
                  label={t.strengthLabel}
                  value={state.imageMap.strength}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      imageMap: { ...prev.imageMap, strength: v },
                    }))
                  }
                  onCommit={commit}
                />

                <SliderControl
                  label={t.referenceOpacity}
                  value={state.imageMap.overlayOpacity}
                  min={0}
                  max={0.6}
                  step={0.02}
                  onChange={(v) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      imageMap: { ...prev.imageMap, overlayOpacity: v },
                    }))
                  }
                />
              </div>
            )}
          </SectionGroup>
        )}

        {/* 7. Surface Preview & Style */}
        <SectionGroup title={t.secAppearance} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['architectural_light', t.studioLight],
                ['acoustic_dark', t.studioDark],
                ['brushed_metal', t.studioMetal],
                ['cad_wireframe', t.studioCad],
              ] as [StudioMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => applyStudioMode(mode)}
                className={`px-2.5 py-1.5 text-left text-xs font-medium rounded-md border transition-colors truncate ${
                  state.studioMode === mode
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                    : 'bg-white text-[#595959] border-[#E4E4E7] hover:border-[#94949C] hover:text-[#1A1A1A]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {state.studioMode !== 'cad_wireframe' && state.studioMode !== 'brushed_metal' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[#595959] block">
                  {t.panelColor}
                </span>
                <div className="flex items-center gap-2 bg-white border border-[#E4E4E7] rounded px-2 py-1">
                  <input
                    type="color"
                    value={state.panelColor}
                    onChange={(e) => patch({ panelColor: e.target.value })}
                    onBlur={commit}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[11px] font-mono-tabular text-[#1A1A1A] uppercase">
                    {state.panelColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[#595959] block">
                  {t.shapeColor}
                </span>
                <div className="flex items-center gap-2 bg-white border border-[#E4E4E7] rounded px-2 py-1">
                  <input
                    type="color"
                    value={state.holeColor}
                    onChange={(e) => patch({ holeColor: e.target.value })}
                    onBlur={commit}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[11px] font-mono-tabular text-[#1A1A1A] uppercase">
                    {state.holeColor}
                  </span>
                </div>
              </label>
            </div>
          )}

          <label className="flex items-center justify-between text-xs text-[#595959] cursor-pointer">
            <span>{t.transparentBg}</span>
            <input
              type="checkbox"
              checked={state.transparentBg}
              onChange={(e) => patch({ transparentBg: e.target.checked }, true)}
              className="w-4 h-4 accent-[#1A1A1A] rounded"
            />
          </label>

          <SegmentedControl<RenderStyle>
            label={t.renderStyle}
            value={state.renderStyle}
            onChange={(v) => patch({ renderStyle: v }, true)}
            options={[
              { value: 'fill', label: t.styleFill },
              { value: 'stroke', label: t.styleStroke },
              { value: 'fill_stroke', label: t.styleBoth },
            ]}
          />

          {workspaceMode === 'advanced' &&
            (state.renderStyle === 'stroke' || state.renderStyle === 'fill_stroke') && (
              <SliderControl
                label={t.strokeWidthMm}
                value={state.strokeWidth}
                min={0.1}
                max={3}
                step={0.1}
                unit="mm"
                onChange={(v) => patch({ strokeWidth: v })}
                onCommit={commit}
              />
            )}

          {workspaceMode === 'advanced' && (
            <SliderControl
              label={t.materialThicknessMm}
              value={state.materialThickness}
              min={0.5}
              max={10}
              step={0.5}
              unit="mm"
              onChange={(v) => patch({ materialThickness: v })}
              onCommit={commit}
            />
          )}
        </SectionGroup>
      </div>
    </aside>
  );
};
