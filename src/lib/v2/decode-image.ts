/**
 * Decode an image URL into working ImageData, optionally clamping the long edge.
 * `maxLongEdge <= 0` keeps native size (still capped by `safeMaxLongEdge`).
 * Runs in the browser (uses Image / canvas).
 */
export const decodeToWorkingImageData = (
  src: string,
  maxLongEdge: number,
  safeMaxLongEdge = Number.POSITIVE_INFINITY,
): Promise<ImageData> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    // Blob URLs are same-origin; setting crossOrigin can make them fail to load.
    if (!src.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
        if (naturalW <= 0 || naturalH <= 0) {
          reject(new Error("Image has zero dimensions"));
          return;
        }

        const longEdge = Math.max(naturalW, naturalH);
        const userCap = maxLongEdge > 0 ? maxLongEdge : Number.POSITIVE_INFINITY;
        const cap = Math.min(userCap, safeMaxLongEdge);
        const scale = longEdge > cap ? cap / longEdge : 1;
        const width = Math.max(1, Math.round(naturalW * scale));
        const height = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2d context"));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        resolve(ctx.getImageData(0, 0, width, height));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
