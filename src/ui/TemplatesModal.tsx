import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { Locale, PatternState } from '../engine/types';
import type { Translations } from '../i18n/translations';
import { PATTERN_PRESETS, type PatternPreset } from '../presets/presets';
import { generatePattern } from '../engine/generator';
import { buildGraphicSvg } from '../exporters/svgExporter';

interface TemplatesModalProps {
  open: boolean;
  locale: Locale;
  t: Translations;
  onClose: () => void;
  onSelectPreset: (state: PatternState) => void;
}

const PresetPreviewCard: React.FC<{
  preset: PatternPreset;
  locale: Locale;
  t: Translations;
  onSelect: () => void;
}> = ({ preset, locale, t, onSelect }) => {
  const { svgUrl, metrics } = useMemo(() => {
    // Generate compact preview using slightly larger pitch if very dense, keeping exact visual character
    const previewState: PatternState = {
      ...preset.state,
      panelW: Math.min(preset.state.panelW, 960),
      panelH: Math.min(preset.state.panelH, 540),
    };
    const res = generatePattern(previewState, null, null);
    const svg = buildGraphicSvg(previewState, res);
    const encoded = encodeURIComponent(svg);
    return {
      svgUrl: `data:image/svg+xml;charset=utf-8,${encoded}`,
      metrics: res.metrics,
    };
  }, [preset]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group text-left bg-white border border-[#E4E4E7] hover:border-[#1A1A1A] rounded-lg overflow-hidden transition-colors flex flex-col"
    >
      <div className="w-full aspect-16/10 bg-[#F0F0F2] p-3 flex items-center justify-center overflow-hidden">
        <img
          src={svgUrl}
          alt={locale === 'tr' ? preset.nameTr : preset.nameEn}
          className="w-full h-full object-contain rounded-xs shadow-xs transition-transform duration-200 group-hover:scale-[1.02]"
        />
      </div>
      <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-sm font-semibold text-[#1A1A1A]">
            {locale === 'tr' ? preset.nameTr : preset.nameEn}
          </div>
          <div className="text-xs text-[#737373] mt-0.5">
            {locale === 'tr' ? preset.sectorTr : preset.sectorEn}
            <span className="mx-1.5" aria-hidden="true">·</span>
            {t.topologyNames[preset.state.topology]}
          </div>
        </div>
        <div className="pt-2 border-t border-[#F4F4F5] flex items-center justify-between text-[11px] font-mono-tabular text-[#595959]">
          <span>OAR {metrics.focusOarPercent.toFixed(1)}%</span>
          <span>
            {metrics.minBridgeMm !== null ? `${metrics.minBridgeMm.toFixed(1)} mm` : '—'}
          </span>
        </div>
      </div>
    </button>
  );
};

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  open,
  locale,
  t,
  onClose,
  onSelectPreset,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white border border-[#E4E4E7] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#E4E4E7]">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">
              {t.templatesTitle}
            </h2>
            <p className="text-xs text-[#595959] mt-0.5">{t.templatesSubtitle}</p>
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

        <div className="p-6 overflow-y-auto aw-scroll grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PATTERN_PRESETS.map((preset) => (
            <PresetPreviewCard
              key={preset.id}
              preset={preset}
              locale={locale}
              t={t}
              onSelect={() => {
                onSelectPreset({ ...preset.state });
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
