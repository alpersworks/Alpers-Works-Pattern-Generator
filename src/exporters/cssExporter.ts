import type { PatternResult, PatternState } from '../engine/types';
import { buildGraphicSvg } from './svgExporter';

export interface CssExportPayload {
  cssCode: string;
  byteSize: number;
  isLargeWarning: boolean;
}

/**
 * Generates a compact URL-encoded SVG Data URI CSS background-image snippet.
 * Avoids Base64's ~33% bloat by escaping only minimal characters (# -> %23, etc.).
 */
export function buildCssBackgroundSnippet(
  state: PatternState,
  result: PatternResult
): CssExportPayload {
  const rawSvg = buildGraphicSvg(state, result)
    .replace(/<\?xml[^>]*\?>\s*/g, '')
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  const encoded = rawSvg
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/"/g, "'")
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');

  const cssCode = [
    `.pattern-surface {`,
    `  background-color: ${state.transparentBg ? 'transparent' : state.panelColor};`,
    `  background-image: url("data:image/svg+xml,${encoded}");`,
    `  background-size: cover;`,
    `  background-position: center;`,
    `  background-repeat: no-repeat;`,
    `}`,
  ].join('\n');

  const byteSize = new Blob([cssCode]).size;
  return {
    cssCode,
    byteSize,
    isLargeWarning: result.instances.length > 900 || byteSize > 65000,
  };
}
