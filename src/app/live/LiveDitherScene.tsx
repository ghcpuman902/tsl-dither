"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three/webgpu";
import {
  clamp,
  float,
  hash,
  screenCoordinate,
  step,
  texture,
  uniform,
  vec3,
  vec4,
  viewportSize,
} from "three/tsl";
import { createDepthMesh } from "@/lib/depth/create-depth-mesh";
import {
  DEFAULT_DEPTH_MODEL,
  getSharedDepthEstimator,
  type DepthProgress,
} from "@/lib/depth/depth-estimator";
import type { LiveDitherSettings } from "./live-dither-types";

export type LiveDitherSceneProps = {
  settings: LiveDitherSettings;
  photoUrl: string;
  onLightDegrees: (degrees: number) => void;
  onStatus: (status: string) => void;
  onError: (message: string | null) => void;
};

const NOISE_SEED_R = 12345;
const NOISE_SEED_G = 23456;
const NOISE_SEED_B = 34567;
const NOISE_INTERVAL_MS = 1000 / 18;
const LIGHT_RADIUS = 3.4;

const BUST_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.02, 0.16],
  [0.46, 0.2],
  [0.5, 0.42],
  [0.46, 0.7],
  [0.34, 0.88],
  [0.16, 0.98],
  [0.14, 1.1],
  [0.2, 1.18],
  [0.26, 1.28],
  [0.29, 1.42],
  [0.27, 1.54],
  [0.2, 1.66],
  [0.1, 1.74],
  [0.02, 1.78],
];

type DitherUniforms = {
  threshold: ReturnType<typeof uniform>;
  noise: ReturnType<typeof uniform>;
  pixelSize: ReturnType<typeof uniform>;
  noiseFrame: ReturnType<typeof uniform>;
};

const wrapDegrees = (radians: number): number => {
  const degrees = Math.round(THREE.MathUtils.radToDeg(radians));
  return ((degrees % 360) + 360) % 360;
};

const createStoneMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color("#f0d2a4"),
    roughness: 0.46,
    metalness: 0,
  });

const createBust = (): THREE.Group => {
  const group = new THREE.Group();
  const stone = createStoneMaterial();
  const points = BUST_PROFILE.map(([radius, height]) => new THREE.Vector2(radius, height));
  const body = new THREE.Mesh(new THREE.LatheGeometry(points, 56), stone);
  group.add(body);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.18, 48), stone);
  plinth.position.y = 0.09;
  group.add(plinth);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), stone);
  nose.scale.set(0.62, 0.78, 1.45);
  nose.position.set(0, 1.32, 0.26);
  group.add(nose);

  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), stone);
  brow.scale.set(1.6, 0.38, 0.7);
  brow.position.set(0, 1.46, 0.22);
  group.add(brow);

  const earGeometry = new THREE.SphereGeometry(0.07, 16, 12);
  const leftEar = new THREE.Mesh(earGeometry, stone);
  leftEar.scale.set(0.42, 0.85, 0.55);
  leftEar.position.set(-0.27, 1.38, 0.02);
  const rightEar = new THREE.Mesh(earGeometry, stone);
  rightEar.scale.copy(leftEar.scale);
  rightEar.position.set(0.27, 1.38, 0.02);
  group.add(leftEar, rightEar);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), stone);
  hair.scale.set(1.05, 0.85, 0.75);
  hair.position.set(0, 1.58, -0.06);
  group.add(hair);

  return group;
};

const loadHtmlImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });

const formatDepthProgress = (progress: DepthProgress): string => {
  if (progress.phase === "loading-model") {
    if (progress.totalBytes && progress.loadedBytes != null) {
      const pct = Math.min(
        100,
        Math.round((progress.loadedBytes / progress.totalBytes) * 100),
      );
      return `Loading ${DEFAULT_DEPTH_MODEL.label}… ${pct}%`;
    }
    return `Loading ${DEFAULT_DEPTH_MODEL.label}…`;
  }
  if (progress.phase === "estimating") {
    return "Estimating depth…";
  }
  return `Depth ready · ${Math.round(progress.inferenceMs)}ms · ${progress.device}`;
};

/** Brightness fallback only if ONNX depth fails — not the default path. */
const createBrightnessReliefMesh = async (src: string): Promise<THREE.Mesh> => {
  const image = await loadHtmlImage(src);
  const sampleWidth = 80;
  const sampleHeight = 106;
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read the photo");
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;

  const aspect = image.width / Math.max(1, image.height);
  const height = 2.05;
  const width = height * aspect;
  const geometry = new THREE.PlaneGeometry(
    width,
    height,
    sampleWidth - 1,
    sampleHeight - 1,
  );
  const positions = geometry.attributes.position;
  for (let row = 0; row < sampleHeight; row++) {
    for (let column = 0; column < sampleWidth; column++) {
      const vertex = row * sampleWidth + column;
      const pixel = vertex * 4;
      const red = pixels[pixel]! / 255;
      const green = pixels[pixel + 1]! / 255;
      const blue = pixels[pixel + 2]! / 255;
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      positions.setZ(vertex, (luminance - 0.35) * 0.72);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const map = new THREE.Texture(image);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.82,
    metalness: 0,
  });
  return new THREE.Mesh(geometry, material);
};

const createPhotoDepthMesh = async (
  src: string,
  onProgress: (status: string) => void,
  signal: AbortSignal,
): Promise<{ mesh: THREE.Mesh; status: string }> => {
  const image = await loadHtmlImage(src);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const estimator = getSharedDepthEstimator();
  const estimate = await estimator.estimate(image, {
    signal,
    onProgress: (progress) => onProgress(formatDepthProgress(progress)),
  });

  const mesh = createDepthMesh(
    image,
    estimate.depth,
    estimate.width,
    estimate.height,
  );
  const status = `Depth · ${DEFAULT_DEPTH_MODEL.id} · ${Math.round(estimate.inferenceMs)}ms · ${estimate.device}`;
  return { mesh, status };
};

const buildWhiteNoiseNode = (sceneTexture: THREE.Texture, uniforms: DitherUniforms) => {
  const pixelSize = float(uniforms.pixelSize).max(1);
  const cell = screenCoordinate.xy.div(pixelSize).floor();
  const center = cell.add(0.5).mul(pixelSize);
  const uv = center.div(viewportSize);
  const sampled = texture(sceneTexture, uv);
  const cellIndex = cell.y.mul(4096).add(cell.x);
  const frame = float(uniforms.noiseFrame);
  const noiseR = hash(cellIndex.add(frame.mul(17)).add(float(NOISE_SEED_R)));
  const noiseG = hash(cellIndex.add(frame.mul(29)).add(float(NOISE_SEED_G)));
  const noiseB = hash(cellIndex.add(frame.mul(41)).add(float(NOISE_SEED_B)));
  const threshold = float(uniforms.threshold);
  const noiseAmount = float(uniforms.noise);
  const thresholdR = clamp(threshold.add(noiseR.sub(0.5).mul(noiseAmount)), 0, 1);
  const thresholdG = clamp(threshold.add(noiseG.sub(0.5).mul(noiseAmount)), 0, 1);
  const thresholdB = clamp(threshold.add(noiseB.sub(0.5).mul(noiseAmount)), 0, 1);
  const rgb = vec3(
    step(thresholdR, sampled.r),
    step(thresholdG, sampled.g),
    step(thresholdB, sampled.b),
  );
  return vec4(rgb, 1);
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      const textured = material as THREE.MeshStandardMaterial;
      textured.map?.dispose();
      material.dispose();
    }
  });
};

export const LiveDitherScene = ({
  settings,
  photoUrl,
  onLightDegrees,
  onStatus,
  onError,
}: LiveDitherSceneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef(settings);
  const photoUrlRef = useRef(photoUrl);
  const onLightDegreesRef = useRef(onLightDegrees);
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);
  const ensurePhotoRef = useRef<(url: string, force?: boolean) => void>(() => {});

  useEffect(() => {
    settingsRef.current = settings;
    photoUrlRef.current = photoUrl;
    onLightDegreesRef.current = onLightDegrees;
    onStatusRef.current = onStatus;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (settings.subject !== "photo") return;
    ensurePhotoRef.current(photoUrl);
  }, [photoUrl, settings.subject]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");

    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
    const keyLight = new THREE.DirectionalLight("#fff4e5", 6.5);
    const fillLight = new THREE.DirectionalLight("#7eb6ff", 0.55);
    scene.add(keyLight, keyLight.target, fillLight, fillLight.target);

    const statueGroup = createBust();
    const photoGroup = new THREE.Group();
    scene.add(statueGroup, photoGroup);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#ffe27a" }),
    );
    scene.add(marker);

    let azimuth = 1.12;
    let elevation = 0.42;
    let disposed = false;
    let renderer: THREE.WebGPURenderer | null = null;
    let renderTarget: THREE.RenderTarget | null = null;
    let postMaterial: THREE.MeshBasicNodeMaterial | null = null;
    let postQuad: THREE.Mesh | null = null;
    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const lightFocus = new THREE.Vector3();
    const reportLight = () => {
      onLightDegreesRef.current(wrapDegrees(azimuth));
    };
    reportLight();

    const placeLight = (focusY: number) => {
      const horizontal = Math.cos(elevation);
      keyLight.position.set(
        horizontal * Math.sin(azimuth) * LIGHT_RADIUS,
        focusY + Math.sin(elevation) * LIGHT_RADIUS,
        horizontal * Math.cos(azimuth) * LIGHT_RADIUS,
      );
      keyLight.target.position.set(0, focusY, 0);
      fillLight.position.set(-keyLight.position.x * 0.55, focusY + 0.4, 1.4);
      fillLight.target.position.set(0, focusY, 0);
      lightFocus.set(0, focusY, 0);
      marker.position.copy(keyLight.position).lerp(lightFocus, 0.72);
    };

    const frameCamera = (subject: LiveDitherSettings["subject"]) => {
      if (subject === "photo") {
        camera.position.set(0.15, 0.05, 2.7);
        camera.lookAt(0, 0, 0);
        return 0;
      }
      camera.position.set(1.25, 1.22, 2.85);
      camera.lookAt(0, 1.08, 0);
      return 1.08;
    };

    let photoAbort: AbortController | null = null;
    let photoRequestId = 0;
    let builtPhotoUrl: string | null = null;

    const rebuildPhoto = async (url: string) => {
      photoAbort?.abort();
      const controller = new AbortController();
      photoAbort = controller;
      const requestId = ++photoRequestId;
      onStatusRef.current(`Loading ${DEFAULT_DEPTH_MODEL.label}…`);
      onErrorRef.current(null);

      try {
        const { mesh, status } = await createPhotoDepthMesh(
          url,
          (progressStatus) => {
            if (requestId === photoRequestId) {
              onStatusRef.current(progressStatus);
            }
          },
          controller.signal,
        );
        if (disposed || requestId !== photoRequestId) {
          disposeObject(mesh);
          return;
        }
        for (const child of [...photoGroup.children]) {
          photoGroup.remove(child);
          disposeObject(child);
        }
        photoGroup.add(mesh);
        builtPhotoUrl = url;
        onStatusRef.current(status);
        onErrorRef.current(null);
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        console.warn("[LiveDither] ONNX depth failed, using brightness relief:", error);
        try {
          const mesh = await createBrightnessReliefMesh(url);
          if (disposed || requestId !== photoRequestId) {
            disposeObject(mesh);
            return;
          }
          for (const child of [...photoGroup.children]) {
            photoGroup.remove(child);
            disposeObject(child);
          }
          photoGroup.add(mesh);
          builtPhotoUrl = url;
          const detail = error instanceof Error ? error.message : "depth failed";
          onStatusRef.current(`Brightness fallback · ${detail}`);
          onErrorRef.current(null);
        } catch (fallbackError) {
          const message =
            fallbackError instanceof Error
              ? fallbackError.message
              : "Photo depth failed";
          onErrorRef.current(message);
          onStatusRef.current("error");
        }
      }
    };
    ensurePhotoRef.current = (url: string, force = false) => {
      if (!force && builtPhotoUrl === url && photoGroup.children.length > 0) {
        return;
      }
      void rebuildPhoto(url);
    };
    if (settingsRef.current.subject === "photo") {
      ensurePhotoRef.current(photoUrlRef.current, true);
    }

    const resize = () => {
      if (!renderer) return;
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      if (width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, true);
      renderTarget?.setSize(width, height);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest("[data-ui]")) return;
      container.setPointerCapture(event.pointerId);
      container.dataset.dragging = "true";
      container.dataset.pointerX = String(event.clientX);
      container.dataset.pointerY = String(event.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (container.dataset.dragging !== "true") return;
      const previousX = Number(container.dataset.pointerX ?? event.clientX);
      const previousY = Number(container.dataset.pointerY ?? event.clientY);
      azimuth += (event.clientX - previousX) * 0.01;
      elevation = THREE.MathUtils.clamp(
        elevation - (event.clientY - previousY) * 0.008,
        -0.15,
        1.15,
      );
      container.dataset.pointerX = String(event.clientX);
      container.dataset.pointerY = String(event.clientY);
      reportLight();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
      container.dataset.dragging = "false";
    };

    const handleNudge = () => {
      azimuth += 0.45;
      reportLight();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "ArrowRight") azimuth += 0.12;
      if (event.key === "ArrowLeft") azimuth -= 0.12;
      if (event.key === "ArrowUp") elevation = Math.min(1.15, elevation + 0.08);
      if (event.key === "ArrowDown") elevation = Math.max(-0.15, elevation - 0.08);
      if (event.key.startsWith("Arrow")) reportLight();
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointercancel", handlePointerUp);
    container.addEventListener("live-nudge-light", handleNudge);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", resize);

    const initialize = async () => {
      try {
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        renderer = new THREE.WebGPURenderer({ antialias: false, alpha: false });
        try {
          await renderer.init();
        } catch {
          renderer.dispose();
          renderer = new THREE.WebGPURenderer({
            antialias: false,
            alpha: false,
            forceWebGL: true,
          });
          await renderer.init();
        }
        if (disposed) return;

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(width, height, true);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.domElement.dataset.testid = "live-canvas";
        renderer.domElement.setAttribute("aria-label", "Live dither viewport. Drag to move the light.");
        renderer.domElement.tabIndex = 0;
        container.appendChild(renderer.domElement);

        renderTarget = new THREE.RenderTarget(width, height, {
          depthBuffer: true,
          samples: 1,
        });
        renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

        const uniforms: DitherUniforms = {
          threshold: uniform(settingsRef.current.threshold),
          noise: uniform(settingsRef.current.noise),
          pixelSize: uniform(settingsRef.current.pixelSize),
          noiseFrame: uniform(0),
        };
        postMaterial = new THREE.MeshBasicNodeMaterial();
        postMaterial.toneMapped = false;
        postMaterial.fragmentNode = buildWhiteNoiseNode(renderTarget.texture, uniforms);
        postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
        postScene.add(postQuad);

        let noiseFrame = 0;
        let lastNoiseTime = 0;
        let announced = false;

        renderer.setAnimationLoop((time) => {
          if (!renderer || !renderTarget) return;
          const current = settingsRef.current;
          uniforms.threshold.value = current.threshold;
          uniforms.noise.value = current.noise;
          uniforms.pixelSize.value = current.pixelSize;
          if (time - lastNoiseTime >= NOISE_INTERVAL_MS) {
            lastNoiseTime = time;
            noiseFrame = (noiseFrame + 1) % 4096;
            uniforms.noiseFrame.value = noiseFrame;
          }

          statueGroup.visible = current.subject === "statue";
          photoGroup.visible = current.subject === "photo";
          statueGroup.rotation.y = Math.sin(time * 0.00035) * 0.4;
          const focusY = frameCamera(current.subject);
          placeLight(focusY);

          renderer.setRenderTarget(renderTarget);
          renderer.render(scene, camera);
          renderer.setRenderTarget(null);
          renderer.render(postScene, postCamera);

          if (!announced) {
            announced = true;
            onStatusRef.current("live");
            onErrorRef.current(null);
          }
        });
        resize();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start the live dither";
        onErrorRef.current(message);
        onStatusRef.current("error");
      }
    };

    void initialize();

    return () => {
      disposed = true;
      photoAbort?.abort();
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);
      container.removeEventListener("live-nudge-light", handleNudge);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resize);
      renderer?.setAnimationLoop(null);
      disposeObject(statueGroup);
      disposeObject(photoGroup);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
      postQuad?.geometry.dispose();
      postMaterial?.dispose();
      renderTarget?.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none"
      data-testid="live-stage"
      aria-label="Drag to move the light"
    />
  );
};
