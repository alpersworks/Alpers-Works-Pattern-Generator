import type { ImageLuminanceGrid, ImageMapConfig } from './types';

/**
 * Loads an image File into a compact normalized 0..1 grayscale luminance grid
 * for real-time halftone modulation without blocking the main thread.
 */
export function loadImageLuminanceGrid(
  file: File,
  maxResolution = 180
): Promise<ImageLuminanceGrid> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const aspect = img.width / Math.max(1, img.height);
        let width = maxResolution;
        let height = Math.round(maxResolution / aspect);
        if (height > maxResolution) {
          height = maxResolution;
          width = Math.round(maxResolution * aspect);
        }
        width = Math.max(8, width);
        height = Math.max(8, height);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height).data;
        const data = new Float32Array(width * height);

        for (let i = 0; i < width * height; i++) {
          const r = pixels[i * 4];
          const g = pixels[i * 4 + 1];
          const b = pixels[i * 4 + 2];
          const a = pixels[i * 4 + 3] / 255;
          // Perceptual sRGB luminance composited on white
          const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          data[i] = lum * a + (1 - a);
        }

        resolve({ width, height, data, dataUrl });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Bilinear sample of the luminance grid at normalized (u, v) in [0, 1],
 * applying user Contrast and Invert settings.
 * Returns modulation intensity in [0, 1] where darker pixels produce larger shapes by default (invert=false).
 */
export function sampleImageModulation(
  grid: ImageLuminanceGrid,
  u: number,
  v: number,
  config: ImageMapConfig
): number {
  const cu = Math.max(0, Math.min(1, u));
  const cv = Math.max(0, Math.min(1, v));

  const fx = cu * (grid.width - 1);
  const fy = cv * (grid.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(grid.width - 1, x0 + 1);
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const w = grid.width;
  const l00 = grid.data[y0 * w + x0];
  const l10 = grid.data[y0 * w + x1];
  const l01 = grid.data[y1 * w + x0];
  const l11 = grid.data[y1 * w + x1];

  const top = l00 + (l10 - l00) * tx;
  const bottom = l01 + (l11 - l01) * tx;
  let lum = top + (bottom - top) * ty;

  // Apply contrast around 0.5 midpoint
  lum = (lum - 0.5) * config.contrast + 0.5;
  lum = Math.max(0, Math.min(1, lum));

  // Default: darker regions produce larger openings (classic halftone), invert flips it
  return config.invert ? lum : 1 - lum;
}
