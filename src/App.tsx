import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type {
  CustomSvgMotifData,
  ImageLuminanceGrid,
  Locale,
  PatternState,
  TopologyType,
  WorkspaceMode,
} from './engine/types';
import { generatePattern } from './engine/generator';
import { createMulberry32 } from './engine/mulberry32';
import { BUILT_IN_MOTIF_LIST } from './motifs/motifs';
import { INITIAL_PATTERN_STATE } from './presets/presets';
import {
  decodeStateFromUrlHash,
  encodeStateToUrlHash,
} from './exporters/urlState';
import { TRANSLATIONS } from './i18n/translations';
import { CanvasViewport } from './renderer/CanvasViewport';
import { ControlSidebar } from './ui/ControlSidebar';
import { ExportModal } from './ui/ExportModal';
import { TemplatesModal } from './ui/TemplatesModal';
import { CadGuideModal } from './ui/CadGuideModal';

const MAX_HISTORY = 50;

function detectInitialLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr')) {
    return 'tr';
  }
  return 'en';
}

function getInitialPatternState(): PatternState {
  if (typeof window !== 'undefined' && window.location.hash) {
    const decoded = decodeStateFromUrlHash(window.location.hash);
    if (decoded) return decoded;
  }
  return INITIAL_PATTERN_STATE;
}

interface HistoryState {
  current: PatternState;
  stack: PatternState[];
  index: number;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(detectInitialLocale);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('simple');

  // Unified atomic state + Undo / Redo History Stacks
  const [historyState, setHistoryState] = useState<HistoryState>(() => {
    const initial = getInitialPatternState();
    return { current: initial, stack: [initial], index: 0 };
  });
  const state = historyState.current;

  // Non-serializable assets (Custom SVG & Halftone luminance buffer)
  const [customMotif, setCustomMotif] = useState<CustomSvgMotifData | null>(null);
  const [imageGrid, setImageGrid] = useState<ImageLuminanceGrid | null>(null);
  const [selectedAttractorId, setSelectedAttractorId] = useState<string | null>(null);

  // Modals & UI transient feedback
  const [exportOpen, setExportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [cadGuideOpen, setCadGuideOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isDrawingPanel, setIsDrawingPanel] = useState(false);

  const t = TRANSLATIONS[locale];

  // Unified state updater with optional atomic history commit
  const handleUpdateState = useCallback(
    (updater: (prev: PatternState) => PatternState, recordHistory = false) => {
      setHistoryState((prev) => {
        const next = updater(prev.current);
        if (!recordHistory) {
          return { ...prev, current: next };
        }
        const sliced = prev.stack.slice(0, prev.index + 1);
        sliced.push(next);
        if (sliced.length > MAX_HISTORY) sliced.shift();
        return {
          current: next,
          stack: sliced,
          index: sliced.length - 1,
        };
      });
    },
    []
  );

  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.stack.length - 1;

  const handleUndo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index <= 0) return prev;
      const nextIdx = prev.index - 1;
      return { ...prev, index: nextIdx, current: prev.stack[nextIdx] };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index >= prev.stack.length - 1) return prev;
      const nextIdx = prev.index + 1;
      return { ...prev, index: nextIdx, current: prev.stack[nextIdx] };
    });
  }, []);

  // Global Undo/Redo keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Deterministic randomization powered by Mulberry32
  const handleRandomize = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 9998) + 1;
    const rand = createMulberry32(newSeed);
    const topologies: TopologyType[] = [
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
    const motifId = BUILT_IN_MOTIF_LIST[Math.floor(rand() * BUILT_IN_MOTIF_LIST.length)];
    const topology = topologies[Math.floor(rand() * topologies.length)];
    const pitch = Math.round(24 + rand() * 20);
    const centerScale = Number((0.75 + rand() * 0.45).toFixed(2));
    const edgeSpacingRatio = Number((0.62 + rand() * 0.34).toFixed(2));
    const ambientScale = Number((0.2 + rand() * 0.38).toFixed(2));
    const baseAngle = Math.round(rand() * 6) * 15;
    const radius = Math.round(180 + rand() * 220);

    handleUpdateState(
      (prev) => ({
        ...prev,
        seed: newSeed,
        motifId,
        topology,
        pitch,
        centerScale,
        transitionRadius: radius,
        edgeSpacingRatio,
        ambientScale,
        baseAngle,
        orientationMode:
          topology === 'wave_flow' || topology === 'vortex' ? 'flow' : 'fixed',
        attractors: [
          {
            id: 'att-1',
            type: 'point',
            x: Number((0.28 + rand() * 0.44).toFixed(2)),
            y: Number((0.3 + rand() * 0.4).toFixed(2)),
            radius,
            weight: 1,
            falloff: 'smoothstep',
          },
        ],
      }),
      true
    );
  }, [handleUpdateState]);

  const handleShareUrl = useCallback(async () => {
    const hash = encodeStateToUrlHash(state);
    window.history.replaceState(null, '', hash);
    const fullUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      // Clipboard fallback silently handled since hash is updated in address bar
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1800);
  }, [state]);

  const handleReset = useCallback(() => {
    setCustomMotif(null);
    setImageGrid(null);
    handleUpdateState(() => ({ ...INITIAL_PATTERN_STATE }), true);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [handleUpdateState]);

  // Indicator showing whether custom advanced engineering parameters are active while viewing Simple mode
  const hasCustomAdvancedParams = useMemo(() => {
    return (
      state.kerf > 0 ||
      state.jitter > 0 ||
      state.attractors.length > 1 ||
      state.attractors[0]?.type === 'line' ||
      state.imageMap.enabled ||
      state.edgeClipMode !== 'complete' ||
      state.continuityMode === 'isolated_island' ||
      state.pivot !== 'center' ||
      Math.abs(state.edgeSpacingRatio - 0.74) > 0.01
    );
  }, [state]);

  // Pure TypeScript Geometry Engine Calculation
  const patternResult = useMemo(
    () => generatePattern(state, customMotif, imageGrid),
    [state, customMotif, imageGrid]
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white text-[#1A1A1A]">
      {/* Strict 3-Zone Swiss Minimalist Top Bar Contract */}
      <header className="h-14 shrink-0 px-5 sm:px-6 border-b border-[#E4E4E7] bg-white flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark in Jost matching ALPER'S WORKS identity */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setTemplatesOpen(false);
            setCadGuideOpen(false);
          }}
          className="font-display text-[17px] font-semibold tracking-[0.14em] text-[#2D2D2D] whitespace-nowrap shrink-0"
        >
          ALPER&apos;S WORKS
        </a>

        {/* Zone 2: Concise single-line text links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#595959]">
          <button
            type="button"
            onClick={() => {
              setTemplatesOpen(false);
              setCadGuideOpen(false);
            }}
            className="hover:text-[#1A1A1A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {t.navStudio}
          </button>
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className="hover:text-[#1A1A1A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {t.navTemplates}
          </button>
          <button
            type="button"
            onClick={() => setCadGuideOpen(true)}
            className="hover:text-[#1A1A1A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {t.navCadGuide}
          </button>
          <button
            type="button"
            onClick={() => setLocale((l) => (l === 'tr' ? 'en' : 'tr'))}
            className="hover:text-[#1A1A1A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 font-mono-tabular"
          >
            {locale === 'tr' ? 'TR / EN' : 'EN / TR'}
          </button>
        </nav>

        {/* Zone 3: Single Primary Action + Mobile Shortcuts */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className="md:hidden text-xs font-medium text-[#595959] hover:text-[#1A1A1A] whitespace-nowrap shrink-0"
          >
            {t.navTemplates}
          </button>
          <button
            type="button"
            onClick={() => setCadGuideOpen(true)}
            className="md:hidden text-xs font-medium text-[#595959] hover:text-[#1A1A1A] whitespace-nowrap shrink-0"
          >
            CAD
          </button>
          <button
            type="button"
            onClick={() => setLocale((l) => (l === 'tr' ? 'en' : 'tr'))}
            className="md:hidden text-xs font-mono-tabular font-medium text-[#595959] hover:text-[#1A1A1A] whitespace-nowrap shrink-0"
          >
            {locale === 'tr' ? 'EN' : 'TR'}
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportPrimary}</span>
          </button>
        </div>
      </header>

      {/* Responsive Studio Workspace: Sidebar + 60 FPS Interactive Canvas */}
      <main className="flex-1 flex flex-col-reverse lg:flex-row min-h-0 overflow-hidden">
        <ControlSidebar
          state={state}
          workspaceMode={workspaceMode}
          locale={locale}
          t={t}
          canUndo={canUndo}
          canRedo={canRedo}
          hasCustomAdvancedParams={hasCustomAdvancedParams}
          customMotif={customMotif}
          imageGrid={imageGrid}
          selectedAttractorId={selectedAttractorId}
          isDrawingPanel={isDrawingPanel}
          onChangeWorkspaceMode={setWorkspaceMode}
          onUpdateState={handleUpdateState}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onRandomize={handleRandomize}
          onShareUrl={handleShareUrl}
          shareCopied={shareCopied}
          onReset={handleReset}
          onCustomMotifChange={setCustomMotif}
          onImageGridChange={setImageGrid}
          onSelectAttractor={setSelectedAttractorId}
          onSetDrawingPanel={setIsDrawingPanel}
        />

        <CanvasViewport
          state={state}
          result={patternResult}
          workspaceMode={workspaceMode}
          imageGrid={imageGrid}
          t={t}
          isDrawingPanel={isDrawingPanel}
          onSetDrawingPanel={setIsDrawingPanel}
          onUpdateState={handleUpdateState}
          selectedAttractorId={selectedAttractorId}
          onSelectAttractor={setSelectedAttractorId}
        />
      </main>

      {/* Modals */}
      <ExportModal
        open={exportOpen}
        state={state}
        result={patternResult}
        t={t}
        onClose={() => setExportOpen(false)}
        onCopyShareUrl={handleShareUrl}
        shareCopied={shareCopied}
        onImportState={(imported) => handleUpdateState(() => imported, true)}
      />

      <TemplatesModal
        open={templatesOpen}
        locale={locale}
        t={t}
        onClose={() => setTemplatesOpen(false)}
        onSelectPreset={(presetState) => handleUpdateState(() => presetState, true)}
      />

      <CadGuideModal
        open={cadGuideOpen}
        locale={locale}
        t={t}
        onClose={() => setCadGuideOpen(false)}
      />
    </div>
  );
}
