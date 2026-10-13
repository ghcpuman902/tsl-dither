import * as THREE from "three/webgpu";
import { normalizeDepth01 } from "./depth-estimator";

export type DepthMeshSource = HTMLImageElement | ImageBitmap;

export type DepthMeshOptions = {
  /** World-space height of the plane. Width follows image aspect. */
  planeHeight?: number;
  /** Max Z displacement in world units. */
  reliefDepth?: number;
  /**
   * Cap the long edge of the mesh grid (depth is bilinear-sampled).
   * Keeps triangle counts sane while the colour texture stays full-res.
   */
  maxMeshLongEdge?: number;
  roughness?: number;
};

const DEFAULT_OPTIONS = {
  planeHeight: 2.05,
  reliefDepth: 0.85,
  maxMeshLongEdge: 320,
  roughness: 0.82,
} as const;

const sampleBilinear = (
  depth: Float32Array,
  width: number,
  height: number,
  u: number,
  v: number,
): number => {
  const x = u * (width - 1);
  const y = v * (height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = depth[y0 * width + x0]!;
  const b = depth[y0 * width + x1]!;
  const c = depth[y1 * width + x0]!;
  const d = depth[y1 * width + x1]!;
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
};

const getImageSize = (image: DepthMeshSource) => {
  if ("naturalWidth" in image) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  }
  return { width: image.width, height: image.height };
};

/**
 * Build a lit mesh from a relative depth map + the original colour photo.
 * Depth is assumed higher = closer (Depth Anything V2).
 */
export const createDepthMesh = (
  image: DepthMeshSource,
  depth: Float32Array,
  depthWidth: number,
  depthHeight: number,
  options?: DepthMeshOptions,
): THREE.Mesh => {
  if (depthWidth <= 0 || depthHeight <= 0) {
    throw new Error("Depth map has invalid dimensions");
  }
  if (depth.length < depthWidth * depthHeight) {
    throw new Error("Depth buffer shorter than width×height");
  }

  const planeHeight = options?.planeHeight ?? DEFAULT_OPTIONS.planeHeight;
  const reliefDepth = options?.reliefDepth ?? DEFAULT_OPTIONS.reliefDepth;
  const maxMeshLongEdge =
    options?.maxMeshLongEdge ?? DEFAULT_OPTIONS.maxMeshLongEdge;
  const roughness = options?.roughness ?? DEFAULT_OPTIONS.roughness;

  const { width: imageWidth, height: imageHeight } = getImageSize(image);
  const aspect = imageWidth / Math.max(1, imageHeight);
  const width = planeHeight * aspect;

  const depthLong = Math.max(depthWidth, depthHeight);
  const meshScale = depthLong > maxMeshLongEdge ? maxMeshLongEdge / depthLong : 1;
  const sampleWidth = Math.max(2, Math.round(depthWidth * meshScale));
  const sampleHeight = Math.max(2, Math.round(depthHeight * meshScale));

  const normalized = normalizeDepth01(depth);
  const geometry = new THREE.PlaneGeometry(
    width,
    planeHeight,
    sampleWidth - 1,
    sampleHeight - 1,
  );
  const positions = geometry.attributes.position;

  // PlaneGeometry lays out vertices bottom→top; depth/image rows are top→bottom.
  for (let row = 0; row < sampleHeight; row += 1) {
    for (let column = 0; column < sampleWidth; column += 1) {
      const vertex = row * sampleWidth + column;
      const u = column / (sampleWidth - 1);
      const vFromBottom = row / (sampleHeight - 1);
      const vDepth = 1 - vFromBottom;
      const depth01 = sampleBilinear(
        normalized,
        depthWidth,
        depthHeight,
        u,
        vDepth,
      );
      positions.setZ(vertex, (depth01 - 0.35) * reliefDepth);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const colourMap = new THREE.Texture(image);
  colourMap.colorSpace = THREE.SRGBColorSpace;
  colourMap.needsUpdate = true;
  colourMap.flipY = true;

  const material = new THREE.MeshStandardMaterial({
    map: colourMap,
    roughness,
    metalness: 0,
  });

  return new THREE.Mesh(geometry, material);
};
