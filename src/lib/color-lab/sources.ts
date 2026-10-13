/** Source image loaders and synthetic generators for Color Lab. */

import type { SourceSpec } from "./types";
import { WORKING_LONG_EDGE } from "./types";

export const COLOR_LAB_SOURCES: readonly SourceSpec[] = [
  {
    id: "portrait",
    kind: "portrait",
    label: "Portrait",
    src: "/DSC04192_LowRes.jpg",
  },
  {
    id: "landscape",
    kind: "landscape",
    label: "Landscape",
    src: "/samples/saturated-abstract-landscape.png",
  },
  {
    id: "gradient",
    kind: "gradient",
    label: "Colour gradient",
    src: null,
  },
  {
    id: "greyscale",
    kind: "greyscale",
    label: "Greyscale ramp",
    src: null,
  },
  {
    id: "hue-luma",
    kind: "hue-luma",
    label: "Hue × luma chart",
    src: null,
  },
  {
    id: "dark-detail",
    kind: "dark-detail",
    label: "Dark coloured detail",
    src: null,
  },
];

const resizeToLongEdge = (
  source: ImageData,
  longEdge: number,
): ImageData => {
  const { width, height } = source;
  const maxDim = Math.max(width, height);
  if (maxDim <= longEdge) return source;
  const scale = longEdge / maxDim;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  tmp.getContext("2d")!.putImageData(source, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
};

const hslToRgb = (
  h: number,
  s: number,
  l: number,
): [number, number, number] => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
};

export const generateSynthetic = (
  kind: SourceSpec["kind"],
  size = WORKING_LONG_EDGE,
): ImageData => {
  const w = size;
  const h = size;
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const u = x / (w - 1);
      const v = y / (h - 1);

      let r = 0;
      let g = 0;
      let b = 0;

      if (kind === "gradient") {
        // Horizontal hue, vertical lightness
        [r, g, b] = hslToRgb(u, 0.85, 0.15 + v * 0.7);
      } else if (kind === "greyscale") {
        const t = Math.round(u * 255);
        r = g = b = t;
      } else if (kind === "hue-luma") {
        // Left: greyscale ramp; right: saturated hues at matching luma bands
        if (u < 0.2) {
          const t = Math.round(v * 255);
          r = g = b = t;
        } else {
          const hue = (u - 0.2) / 0.8;
          [r, g, b] = hslToRgb(hue, 0.9, 0.12 + v * 0.76);
        }
      } else if (kind === "dark-detail") {
        // Near-black field with sparse dark-green / dark-blue blobs
        const base = 8 + Math.floor(v * 18);
        r = g = b = base;
        const dx = u - 0.35;
        const dy = v - 0.4;
        const d1 = Math.sqrt(dx * dx + dy * dy);
        if (d1 < 0.18) {
          const t = 1 - d1 / 0.18;
          r = Math.round(base + t * 4);
          g = Math.round(base + t * 28);
          b = Math.round(base + t * 6);
        }
        const dx2 = u - 0.68;
        const dy2 = v - 0.62;
        const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 < 0.14) {
          const t = 1 - d2 / 0.14;
          r = Math.round(base + t * 6);
          g = Math.round(base + t * 10);
          b = Math.round(base + t * 32);
        }
        // Soft warm edge accent
        if (u > 0.85 && v < 0.25) {
          const t = (u - 0.85) / 0.15;
          r = Math.round(base + t * 40);
          g = Math.round(base + t * 18);
          b = Math.round(base + t * 8);
        }
      } else {
        // Fallback: soft pastel
        [r, g, b] = hslToRgb(u, 0.4, 0.55);
      }

      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }

  return new ImageData(data, w, h);
};

export const loadImageUrl = (url: string): Promise<ImageData> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });

export const loadSourceImage = async (
  spec: SourceSpec,
  longEdge = WORKING_LONG_EDGE,
  uploadData?: ImageData | null,
): Promise<ImageData> => {
  if (spec.kind === "upload") {
    if (!uploadData) throw new Error("No upload");
    return resizeToLongEdge(uploadData, longEdge);
  }
  if (spec.src) {
    const full = await loadImageUrl(spec.src);
    return resizeToLongEdge(full, longEdge);
  }
  return generateSynthetic(spec.kind, longEdge);
};

export const imageDataFromFile = (file: File): Promise<ImageData> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
