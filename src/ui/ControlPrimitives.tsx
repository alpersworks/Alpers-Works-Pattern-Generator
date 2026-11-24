import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BuiltInMotifId } from '../engine/types';
import { BUILT_IN_MOTIFS } from '../motifs/motifs';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  hint,
  onChange,
  onCommit,
}) => {
  const decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  const formatted = String(Number(value.toFixed(decimals)));
  const [draft, setDraft] = useState<string>(formatted);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatted);
    }
  }, [formatted, isFocused]);

  const commitDraft = () => {
    const normalized = draft.replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      setDraft(formatted);
    } else {
      const clamped = Math.max(min, Math.min(max, parsed));
      const rounded = Number(clamped.toFixed(decimals));
      setDraft(String(rounded));
      if (rounded !== value) {
        onChange(rounded);
      }
      onCommit?.();
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[#595959] truncate" title={hint}>
          {label}
        </label>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="text"
            inputMode="decimal"
            value={isFocused ? draft : formatted}
            aria-label={label}
            onFocus={(e) => {
              setIsFocused(true);
              setDraft(formatted);
              e.currentTarget.select();
            }}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              const parsed = parseFloat(raw.replace(',', '.'));
              if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) {
                onChange(parsed);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
              commitDraft();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setDraft(formatted);
                setIsFocused(false);
                e.currentTarget.blur();
              }
            }}
            className="w-[72px] text-right text-xs font-mono-tabular font-medium text-[#1A1A1A] bg-white border border-[#E4E4E7] hover:border-[#94949C] focus:border-[#1A1A1A] rounded px-1.5 py-0.5 transition-colors"
          />
          {unit && <span className="text-[11px] font-mono-tabular text-[#737373]">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        className="aw-slider"
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
      />
      {hint && <p className="text-[11px] leading-snug text-[#737373]">{hint}</p>}
    </div>
  );
};

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs font-medium text-[#595959]">{label}</div>}
      <div className="flex items-center gap-1 p-1 bg-[#F4F4F5] rounded-md">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap truncate ${
                active
                  ? 'bg-white text-[#1A1A1A] shadow-xs'
                  : 'text-[#595959] hover:text-[#1A1A1A]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SectionGroupProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const SectionGroup: React.FC<SectionGroupProps> = ({
  title,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-[#E4E4E7] py-4 first:pt-2 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="font-display text-[13px] font-semibold tracking-wide text-[#2D2D2D] group-hover:text-[#1A1A1A]">
          {title}
        </h3>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#737373]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#737373]" />
        )}
      </button>
      {open && <div className="mt-3.5 space-y-3.5">{children}</div>}
    </section>
  );
};

export const MotifMiniIcon: React.FC<{ motifId: BuiltInMotifId; active?: boolean }> = ({
  motifId,
  active,
}) => {
  const rings = BUILT_IN_MOTIFS[motifId].rings;
  const d = rings
    .map((ring) => {
      if (ring.length < 3) return '';
      return (
        `M${ring[0].x.toFixed(1)} ${ring[0].y.toFixed(1)}` +
        ring
          .slice(1)
          .map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join('') +
        'Z'
      );
    })
    .join(' ');

  return (
    <svg viewBox="-14 -14 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path d={d} fill={active ? '#FFFFFF' : '#1A1A1A'} fillRule="evenodd" />
    </svg>
  );
};
