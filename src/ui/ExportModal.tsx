import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  FileJson,
  Image as ImageIcon,
  Layers,
  Link2,
  Upload,
  X,
} from 'lucide-react';
import type { PatternResult, PatternState } from '../engine/types';
import type { Translations } from '../i18n/translations';
import {
  buildGraphicSvg,
  buildLaserSvg,
  triggerTextDownload,
} from '../exporters/svgExporter';
import { buildDxf } from '../exporters/dxfExporter';
import { exportRasterImage } from '../exporters/rasterExporter';
import { buildCssBackgroundSnippet } from '../exporters/cssExporter';
import { mergeSafePatternState } from '../exporters/urlState';

interface ExportModalProps {
  open: boolean;
  state: PatternState;
  result: PatternResult;
  t: Translations;
  onClose: () => void;
  onCopyShareUrl: () => void;
  shareCopied: boolean;
  onImportState: (state: PatternState) => void;
}

type ExportTab = 'vector' | 'cad' | 'image' | 'web';

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  state,
  result,
  t,
  onClose,
  onCopyShareUrl,
  shareCopied,
  onImportState,
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('vector');
  const [legacyR12, setLegacyR12] = useState(false);
  const [includeOutline, setIncludeOutline] = useState(true);
  const [includeMarks, setIncludeMarks] = useState(false);
  const [rasterScale, setRasterScale] = useState<1 | 2 | 4>(2);
  const [rasterBusy, setRasterBusy] = useState(false);
  const [cssCopied, setCssCopied] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const cssPayload = useMemo(() => {
    if (!open || activeTab !== 'web') return null;
    return buildCssBackgroundSnippet(state, result);
  }, [open, activeTab, state, result]);

  if (!open) return null;

  const baseName = `alpers-works-${state.topology}-${state.panelW}x${state.panelH}mm`;

  const handleDownloadGraphicSvg = () => {
    const svg = buildGraphicSvg(state, result);
    triggerTextDownload(svg, `${baseName}.svg`, 'image/svg+xml;charset=utf-8');
  };

  const handleDownloadLaserSvg = () => {
    const svg = buildLaserSvg(state, result);
    triggerTextDownload(svg, `${baseName}-laser-cut.svg`, 'image/svg+xml;charset=utf-8');
  };

  const handleDownloadDxf = () => {
    const dxf = buildDxf(state, result, {
      legacyR12,
      includeOutline,
      includeAlignmentMarks: includeMarks,
    });
    triggerTextDownload(
      dxf,
      `${baseName}${legacyR12 ? '-r12' : ''}.dxf`,
      'application/dxf;charset=utf-8'
    );
  };

  const handleDownloadRaster = async (format: 'png' | 'webp') => {
    setRasterBusy(true);
    try {
      await exportRasterImage(state, result, format, rasterScale);
    } finally {
      setRasterBusy(false);
    }
  };

  const handleCopyCss = async () => {
    if (!cssPayload) return;
    try {
      await navigator.clipboard.writeText(cssPayload.cssCode);
      setCssCopied(true);
      setTimeout(() => setCssCopied(false), 1800);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement('textarea');
      textarea.value = cssPayload.cssCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCssCopied(true);
        setTimeout(() => setCssCopied(false), 1800);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const handleExportPresetJson = () => {
    const clean = JSON.stringify(state, null, 2);
    triggerTextDownload(clean, `${baseName}-recipe.json`, 'application/json;charset=utf-8');
  };

  const handleImportPresetJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<PatternState>;
      onImportState(mergeSafePatternState(parsed));
      onClose();
    } catch {
      // Ignore malformed JSON gracefully
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white border border-[#E4E4E7] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#E4E4E7]">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">
              {t.exportTitle}
            </h2>
            <p className="text-xs text-[#595959] mt-0.5">{t.exportSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="p-1.5 text-[#595959] hover:text-[#1A1A1A] hover:bg-[#F4F4F5] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Metadata Strip (unboxed clean typography) */}
        <div className="px-6 py-2.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#595959]">
          <span className="font-mono-tabular text-[#1A1A1A] font-medium">
            {state.panelW} × {state.panelH} mm
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {result.metrics.instanceCount.toLocaleString()} {t.metricShapes}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            OAR {result.metrics.panelOarPercent.toFixed(1)}%
          </span>
          {state.kerf > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">Kerf {state.kerf.toFixed(2)} mm</span>
            </>
          )}
        </div>

        {/* Tab Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 p-1 bg-[#F4F4F5] rounded-lg">
            {(
              [
                ['vector', t.tabVector, FileCode2],
                ['cad', t.tabCad, Layers],
                ['image', t.tabImage, ImageIcon],
                ['web', t.tabWeb, Code2],
              ] as [ExportTab, string, React.FC<{ className?: string }>][]
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-white text-[#1A1A1A] shadow-xs'
                    : 'text-[#595959] hover:text-[#1A1A1A]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body */}
        <div className="px-6 py-5 overflow-y-auto aw-scroll space-y-4">
          {activeTab === 'vector' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E4E7]">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-[#1A1A1A]">
                    {t.downloadGraphicSvg}
                  </div>
                  <p className="text-xs text-[#595959]">{t.graphicSvgDesc}</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadGraphicSvg}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.SVG</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-[#1A1A1A]">
                    {t.downloadLaserSvg}
                  </div>
                  <p className="text-xs text-[#595959]">{t.laserSvgDesc}</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadLaserSvg}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium bg-white border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#F4F4F5] rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Laser .SVG</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'cad' && (
            <div className="space-y-4">
              <p className="text-xs text-[#595959] leading-relaxed">{t.dxfDesc}</p>

              <div className="space-y-2.5 py-2 border-y border-[#E4E4E7]">
                <label className="flex items-center justify-between text-xs text-[#1A1A1A] cursor-pointer">
                  <span>{t.dxfIncludeOutline}</span>
                  <input
                    type="checkbox"
                    checked={includeOutline}
                    onChange={(e) => setIncludeOutline(e.target.checked)}
                    className="w-4 h-4 accent-[#1A1A1A]"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-[#1A1A1A] cursor-pointer">
                  <span>{t.dxfIncludeMarks}</span>
                  <input
                    type="checkbox"
                    checked={includeMarks}
                    onChange={(e) => setIncludeMarks(e.target.checked)}
                    className="w-4 h-4 accent-[#1A1A1A]"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-[#1A1A1A] cursor-pointer">
                  <span>{t.dxfLegacyR12}</span>
                  <input
                    type="checkbox"
                    checked={legacyR12}
                    onChange={(e) => setLegacyR12(e.target.checked)}
                    className="w-4 h-4 accent-[#1A1A1A]"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleDownloadDxf}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{t.downloadDxf} (.dxf)</span>
              </button>
            </div>
          )}

          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#595959]">{t.resolutionScale}</div>
                <div className="flex items-center gap-1.5">
                  {([1, 2, 4] as (1 | 2 | 4)[]).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setRasterScale(sc)}
                      className={`flex-1 py-2 text-xs font-mono-tabular font-medium rounded-md border transition-colors ${
                        rasterScale === sc
                          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                          : 'bg-white text-[#595959] border-[#E4E4E7] hover:border-[#94949C]'
                      }`}
                    >
                      {sc}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={rasterBusy}
                  onClick={() => handleDownloadRaster('png')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] disabled:opacity-50 rounded-md transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.downloadPng}</span>
                </button>
                <button
                  type="button"
                  disabled={rasterBusy}
                  onClick={() => handleDownloadRaster('webp')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-white border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#F4F4F5] disabled:opacity-50 rounded-md transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.downloadWebp}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'web' && (
            <div className="space-y-4">
              {cssPayload?.isLargeWarning && (
                <div className="flex items-start gap-2 text-xs text-[#B45309] bg-[#FAFAFA] border border-[#E4E4E7] rounded-md p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t.cssLargeWarning}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#595959]">
                    CSS Data URI ({cssPayload ? `${(cssPayload.byteSize / 1024).toFixed(1)} KB` : '—'})
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCss}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] rounded-md transition-colors"
                  >
                    {cssCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{cssCopied ? t.copied : t.copyCss}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-md text-[11px] font-mono-tabular text-[#2D2D2D] overflow-x-auto max-h-28">
                  {cssPayload?.cssCode.slice(0, 600)}
                  {(cssPayload?.cssCode.length ?? 0) > 600 ? '\n…' : ''}
                </pre>
              </div>

              <div className="pt-3 border-t border-[#E4E4E7] grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onCopyShareUrl}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#1A1A1A] rounded-md transition-colors"
                >
                  {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  <span>{shareCopied ? t.copied : t.copyShareLink}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPresetJson}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#1A1A1A] rounded-md transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>{t.downloadPresetJson}</span>
                </button>

                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#1A1A1A] rounded-md transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t.importPresetJson}</span>
                </button>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportPresetJson}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Commercial Freedom Footer Note */}
        <div className="px-6 py-3 bg-[#FAFAFA] border-t border-[#E4E4E7] text-[11px] text-[#737373]">
          {t.exportLicenseNote}
        </div>
      </div>
    </div>
  );
};
