import LZString from 'lz-string';
import type { PatternState } from '../engine/types';
import { INITIAL_PATTERN_STATE } from '../presets/presets';

const HASH_PREFIX = '#s=';

/**
 * Compresses the PatternState into a shareable URL hash (#s=...) using lz-string.
 */
export function encodeStateToUrlHash(state: PatternState): string {
  // Exclude ephemeral image file metadata that can't be recreated from URL alone
  const cleanState: PatternState = {
    ...state,
    imageMap: {
      ...state.imageMap,
      enabled: false,
      fileName: '',
    },
    motifId: state.motifId === 'custom_svg' ? 'circle' : state.motifId,
  };
  const json = JSON.stringify(cleanState);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `${HASH_PREFIX}${compressed}`;
}

/**
 * Decodes PatternState from the current window.location.hash if present.
 */
export function decodeStateFromUrlHash(hash: string): PatternState | null {
  if (!hash || !hash.startsWith(HASH_PREFIX)) return null;
  try {
    const payload = hash.slice(HASH_PREFIX.length);
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    const parsed = JSON.parse(json) as Partial<PatternState>;
    return mergeSafePatternState(parsed);
  } catch {
    return null;
  }
}

/**
 * Safely merges partial JSON (from URL hash or imported Preset JSON) onto defaults.
 */
export function mergeSafePatternState(partial: Partial<PatternState>): PatternState {
  const merged: PatternState = {
    ...INITIAL_PATTERN_STATE,
    ...partial,
    imageMap: {
      ...INITIAL_PATTERN_STATE.imageMap,
      ...(partial.imageMap ?? {}),
    },
    attractors:
      Array.isArray(partial.attractors) && partial.attractors.length > 0
        ? partial.attractors
        : INITIAL_PATTERN_STATE.attractors,
  };
  merged.panelW = Math.max(50, Math.min(5000, Math.round(Number(merged.panelW) || INITIAL_PATTERN_STATE.panelW)));
  merged.panelH = Math.max(50, Math.min(5000, Math.round(Number(merged.panelH) || INITIAL_PATTERN_STATE.panelH)));
  return merged;
}
