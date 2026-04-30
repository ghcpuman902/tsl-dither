"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  float,
  hash,
  length,
  screenCoordinate,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
  viewportSize,
} from "three/tsl";

const MAX_ROTATION_DEGREES = 5;
const MAX_ROTATION_RADIANS = THREE.MathUtils.degToRad(MAX_ROTATION_DEGREES);
const NOISE_SEED_R = 12345.0;
const NOISE_SEED_G = 23456.0;
const NOISE_SEED_B = 34567.0;
const SQRT_3 = Math.sqrt(3);

type EffectMode = "pixel" | "hex" | "lidar";
type MediumMode = "digital" | "analog";

type PostEffectControls = {
  mode: EffectMode;
  mediumMode: MediumMode;
  pixelSize: number;
  hexSize: number;
  dotRadiusRatio: number;
  dotSoftnessPx: number;
  noiseDensity: number;
  baseThreshold: number;
  analogGammaR: number;
  analogGammaG: number;
  analogGammaB: number;
  analogCrossTalk: number;
  analogToe: number;
  analogShoulder: number;
  lidarStep: number;
  lidarJitterPx: number;
  lidarSigmaPx: number;
  lidarDensity: number;
};

const DEFAULT_CONTROLS: PostEffectControls = {
  mode: "hex",
  mediumMode: "digital",
  pixelSize: 8,
  hexSize: 10,
  dotRadiusRatio: 0.42,
  dotSoftnessPx: 1.2,
  noiseDensity: 0.08,
  baseThreshold: 0.5,
  analogGammaR: 0.56,
  analogGammaG: 0.5,
  analogGammaB: 0.64,
  analogCrossTalk: 0.07,
  analogToe: 0.24,
  analogShoulder: 0.2,
  lidarStep: 9,
  lidarJitterPx: 4.5,
  lidarSigmaPx: 2.7,
  lidarDensity: 0.9,
};

type NumericUniformNode = ReturnType<typeof uniform>;

type PostEffectUniforms = {
  mode: NumericUniformNode;
  mediumMode: NumericUniformNode;
  pixelSize: NumericUniformNode;
  hexSize: NumericUniformNode;
  dotRadiusRatio: NumericUniformNode;
  dotSoftnessPx: NumericUniformNode;
  noiseDensity: NumericUniformNode;
  baseThreshold: NumericUniformNode;
  analogGammaR: NumericUniformNode;
  analogGammaG: NumericUniformNode;
  analogGammaB: NumericUniformNode;
  analogCrossTalk: NumericUniformNode;
  analogToe: NumericUniformNode;
  analogShoulder: NumericUniformNode;
  lidarStep: NumericUniformNode;
  lidarJitterPx: NumericUniformNode;
  lidarSigmaPx: NumericUniformNode;
  lidarDensity: NumericUniformNode;
};

const modeToValue = (mode: EffectMode): number => {
  if (mode === "pixel") {
    return 0;
  }
  if (mode === "hex") {
    return 1;
  }
  return 2;
};

const mediumModeToValue = (mode: MediumMode): number => {
  if (mode === "digital") {
    return 0;
  }
  return 1;
};

const buildConfigurableQuantizedPointCloudNode = (
  sampledSceneTexture: THREE.Texture,
  uniforms: PostEffectUniforms
) => {
  const modeNode = float(uniforms.mode).round();
  const mediumModeNode = float(uniforms.mediumMode).round();
  const pixelSize = float(uniforms.pixelSize).max(1.0);
  const hexSize = float(uniforms.hexSize).max(1.0);
  const dotRadiusRatio = float(uniforms.dotRadiusRatio).clamp(0.05, 1.0);
  const dotSoftness = float(uniforms.dotSoftnessPx).max(0.1);
  const noiseDensityNode = float(uniforms.noiseDensity).clamp(0.0, 1.0);
  const baseThresholdNode = float(uniforms.baseThreshold).clamp(0.0, 1.0);
  const analogGammaR = float(uniforms.analogGammaR).clamp(0.2, 2.2);
  const analogGammaG = float(uniforms.analogGammaG).clamp(0.2, 2.2);
  const analogGammaB = float(uniforms.analogGammaB).clamp(0.2, 2.2);
  const analogCrossTalk = float(uniforms.analogCrossTalk).clamp(0.0, 0.35);
  const analogToe = float(uniforms.analogToe).clamp(0.0, 1.0);
  const analogShoulder = float(uniforms.analogShoulder).clamp(0.0, 1.0);
  const lidarStep = float(uniforms.lidarStep).max(1.0);
  const lidarJitterPx = float(uniforms.lidarJitterPx).max(0.0);
  const lidarSigmaPx = float(uniforms.lidarSigmaPx).max(0.1);
  const lidarDensity = float(uniforms.lidarDensity).clamp(0.0, 1.0);
  const sqrt3 = float(SQRT_3);

  const pixelCoord = screenCoordinate.xy;

  const quantizeColorForCell = (
    sampledColorNode: ReturnType<typeof vec4>,
    cellIndex: ReturnType<typeof float>
  ) => {
    const noiseR = hash(cellIndex.add(float(NOISE_SEED_R)));
    const noiseG = hash(cellIndex.add(float(NOISE_SEED_G)));
    const noiseB = hash(cellIndex.add(float(NOISE_SEED_B)));

    const thresholdR = baseThresholdNode
      .add(noiseR.sub(0.5).mul(noiseDensityNode))
      .clamp(0.0, 1.0);
    const thresholdG = baseThresholdNode
      .add(noiseG.sub(0.5).mul(noiseDensityNode))
      .clamp(0.0, 1.0);
    const thresholdB = baseThresholdNode
      .add(noiseB.sub(0.5).mul(noiseDensityNode))
      .clamp(0.0, 1.0);

    const sampledRgb = sampledColorNode.rgb.clamp(0.0, 1.0);
    // Keep digital mode in renderer-managed space to avoid double gamma correction.
    const digitalRgb = sampledRgb;

    const analogMixedRgb = vec3(
      sampledRgb.r.mul(float(1.0).sub(analogCrossTalk.mul(2.0)))
        .add(sampledRgb.g.mul(analogCrossTalk))
        .add(sampledRgb.b.mul(analogCrossTalk)),
      sampledRgb.g.mul(float(1.0).sub(analogCrossTalk.mul(2.0)))
        .add(sampledRgb.r.mul(analogCrossTalk))
        .add(sampledRgb.b.mul(analogCrossTalk)),
      sampledRgb.b.mul(float(1.0).sub(analogCrossTalk.mul(2.0)))
        .add(sampledRgb.r.mul(analogCrossTalk))
        .add(sampledRgb.g.mul(analogCrossTalk))
    ).clamp(0.0, 1.0);

    const analogCurvedRgb = analogMixedRgb
      .pow(vec3(analogGammaR, analogGammaG, analogGammaB))
      .clamp(0.0, 1.0);
    const analogToeLiftedRgb = analogCurvedRgb
      .add(float(0.16).mul(analogToe).mul(float(1.0).sub(analogCurvedRgb)))
      .clamp(0.0, 1.0);
    const analogRgb = analogToeLiftedRgb
      .div(float(1.0).add(analogToeLiftedRgb.mul(analogShoulder.mul(1.6))))
      .clamp(0.0, 1.0);

    const isAnalog = step(0.5, mediumModeNode);
    const displayRgb = digitalRgb
      .mul(float(1.0).sub(isAnalog))
      .add(analogRgb.mul(isAnalog));

    return vec3(
      step(thresholdR, displayRgb.r),
      step(thresholdG, displayRgb.g),
      step(thresholdB, displayRgb.b)
    );
  };

  // Pixel mode (square block quantization)
  const pixelCell = pixelCoord.div(pixelSize).floor();
  const pixelCenter = pixelCell.add(0.5).mul(pixelSize);
  const pixelUv = pixelCenter.div(viewportSize.xy).clamp(0.0, 1.0);
  const sampledPixelColor = texture(sampledSceneTexture, pixelUv);
  const pixelCellIndex = pixelCell.y.mul(4096.0).add(pixelCell.x);
  const pixelRgb = quantizeColorForCell(sampledPixelColor, pixelCellIndex);
  const pixelColor = vec4(pixelRgb, sampledPixelColor.a);

  // Hex mode (hex cells + dot mask)
  const axialU = pixelCoord.x
    .div(hexSize)
    .sub(pixelCoord.y.div(hexSize.mul(sqrt3)));
  const axialV = pixelCoord.y.mul(2.0).div(hexSize.mul(sqrt3));

  const roundedU = axialU.round();
  const roundedV = axialV.round();

  const centerX = hexSize.mul(roundedU.add(roundedV.mul(0.5)));
  const centerY = hexSize.mul(sqrt3.mul(0.5)).mul(roundedV);
  const hexCenter = vec2(centerX, centerY);
  const hexUv = hexCenter.div(viewportSize.xy).clamp(0.0, 1.0);
  const sampledHexColor = texture(sampledSceneTexture, hexUv);
  const centerCellX = roundedU;
  const centerCellY = roundedV;
  const cellIndex = centerCellY.mul(4096.0).add(centerCellX);
  const binaryRgb = quantizeColorForCell(sampledHexColor, cellIndex);
  const dotRadius = hexSize.mul(dotRadiusRatio);
  const distanceFromCenter = length(pixelCoord.sub(hexCenter));
  const pointMask = smoothstep(
    dotRadius.add(dotSoftness),
    dotRadius.sub(dotSoftness),
    distanceFromCenter
  );
  const hexColor = vec4(binaryRgb.mul(pointMask), sampledHexColor.a);

  // LIDAR mode (jittered points + gaussian blobs + per-channel slight offsets)
  const lidarCell = pixelCoord.div(lidarStep).floor();
  const lidarCellCenter = vec2(
    lidarCell.x.add(0.5).mul(lidarStep),
    lidarCell.y.add(0.5).mul(lidarStep)
  );
  const lidarCellIndex = lidarCell.y.mul(8192.0).add(lidarCell.x);
  const jitterX = hash(lidarCellIndex.add(1111.0)).sub(0.5).mul(lidarJitterPx.mul(2.0));
  const jitterY = hash(lidarCellIndex.add(2222.0)).sub(0.5).mul(lidarJitterPx.mul(2.0));
  const lidarCenter = vec2(lidarCellCenter.x.add(jitterX), lidarCellCenter.y.add(jitterY));

  const sampleOffset = lidarStep.mul(0.35);
  const lidarUvCenter = lidarCenter.div(viewportSize.xy).clamp(0.0, 1.0);
  const lidarUvLeft = lidarCenter
    .add(vec2(sampleOffset.negate(), 0.0))
    .div(viewportSize.xy)
    .clamp(0.0, 1.0);
  const lidarUvRight = lidarCenter
    .add(vec2(sampleOffset, 0.0))
    .div(viewportSize.xy)
    .clamp(0.0, 1.0);
  const lidarUvUp = lidarCenter
    .add(vec2(0.0, sampleOffset.negate()))
    .div(viewportSize.xy)
    .clamp(0.0, 1.0);
  const lidarUvDown = lidarCenter
    .add(vec2(0.0, sampleOffset))
    .div(viewportSize.xy)
    .clamp(0.0, 1.0);

  const lidarCenterColor = texture(sampledSceneTexture, lidarUvCenter);
  const lidarLeftColor = texture(sampledSceneTexture, lidarUvLeft);
  const lidarRightColor = texture(sampledSceneTexture, lidarUvRight);
  const lidarUpColor = texture(sampledSceneTexture, lidarUvUp);
  const lidarDownColor = texture(sampledSceneTexture, lidarUvDown);

  const sideWeight = float(0.35);
  const weightSum = float(1.0).add(sideWeight.mul(4.0));
  const lidarWeightedColor = vec4(
    lidarCenterColor.rgb
      .add(lidarLeftColor.rgb.mul(sideWeight))
      .add(lidarRightColor.rgb.mul(sideWeight))
      .add(lidarUpColor.rgb.mul(sideWeight))
      .add(lidarDownColor.rgb.mul(sideWeight))
      .div(weightSum),
    lidarCenterColor.a
  );

  const lidarBinaryRgb = quantizeColorForCell(lidarWeightedColor, lidarCellIndex.add(9999.0));
  const densityGate = step(float(1.0).sub(lidarDensity), hash(lidarCellIndex.add(3333.0)));

  const channelOffsetScale = lidarSigmaPx.mul(0.45);
  const redCenter = vec2(
    lidarCenter.x.add(hash(lidarCellIndex.add(4101.0)).sub(0.5).mul(channelOffsetScale)),
    lidarCenter.y.add(hash(lidarCellIndex.add(4102.0)).sub(0.5).mul(channelOffsetScale))
  );
  const greenCenter = vec2(
    lidarCenter.x.add(hash(lidarCellIndex.add(4201.0)).sub(0.5).mul(channelOffsetScale)),
    lidarCenter.y.add(hash(lidarCellIndex.add(4202.0)).sub(0.5).mul(channelOffsetScale))
  );
  const blueCenter = vec2(
    lidarCenter.x.add(hash(lidarCellIndex.add(4301.0)).sub(0.5).mul(channelOffsetScale)),
    lidarCenter.y.add(hash(lidarCellIndex.add(4302.0)).sub(0.5).mul(channelOffsetScale))
  );

  const computeGaussianMask = (pointCenter: ReturnType<typeof vec2>) => {
    const dist = length(pixelCoord.sub(pointCenter));
    const sigma2 = lidarSigmaPx.mul(lidarSigmaPx).mul(2.0);
    const gaussian = dist.mul(dist).div(sigma2).negate().exp();
    return gaussian.mul(densityGate);
  };

  const redMask = computeGaussianMask(redCenter);
  const greenMask = computeGaussianMask(greenCenter);
  const blueMask = computeGaussianMask(blueCenter);
  const lidarRgb = vec3(
    lidarBinaryRgb.r.mul(redMask),
    lidarBinaryRgb.g.mul(greenMask),
    lidarBinaryRgb.b.mul(blueMask)
  );
  const lidarColor = vec4(lidarRgb, lidarCenterColor.a);

  const isPixel = step(modeNode, 0.5);
  const isHex = step(0.5, modeNode).mul(step(modeNode, 1.5));
  const isLidar = step(1.5, modeNode);

  const finalRgb = pixelColor.rgb
    .mul(isPixel)
    .add(hexColor.rgb.mul(isHex))
    .add(lidarColor.rgb.mul(isLidar));
  const finalAlpha = pixelColor.a
    .mul(isPixel)
    .add(hexColor.a.mul(isHex))
    .add(lidarColor.a.mul(isLidar));

  return vec4(finalRgb, finalAlpha);
};

const disposeMaterial = (material: THREE.Material) => {
  const knownMaterial = material as THREE.MeshStandardMaterial & {
    [key: string]: unknown;
  };

  for (const value of Object.values(knownMaterial)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }

  material.dispose();
};

export default function ThreeDPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [controls, setControls] = useState<PostEffectControls>(DEFAULT_CONTROLS);
  const uniformsRef = useRef<PostEffectUniforms | null>(null);
  const normalizedControls: PostEffectControls = {
    ...DEFAULT_CONTROLS,
    ...controls,
  };

  useEffect(() => {
    const activeUniforms = uniformsRef.current;
    if (!activeUniforms) {
      return;
    }
    activeUniforms.mode.value = modeToValue(normalizedControls.mode);
    activeUniforms.mediumMode.value = mediumModeToValue(normalizedControls.mediumMode);
    activeUniforms.pixelSize.value = normalizedControls.pixelSize;
    activeUniforms.hexSize.value = normalizedControls.hexSize;
    activeUniforms.dotRadiusRatio.value = normalizedControls.dotRadiusRatio;
    activeUniforms.dotSoftnessPx.value = normalizedControls.dotSoftnessPx;
    activeUniforms.noiseDensity.value = normalizedControls.noiseDensity;
    activeUniforms.baseThreshold.value = normalizedControls.baseThreshold;
    activeUniforms.analogGammaR.value = normalizedControls.analogGammaR;
    activeUniforms.analogGammaG.value = normalizedControls.analogGammaG;
    activeUniforms.analogGammaB.value = normalizedControls.analogGammaB;
    activeUniforms.analogCrossTalk.value = normalizedControls.analogCrossTalk;
    activeUniforms.analogToe.value = normalizedControls.analogToe;
    activeUniforms.analogShoulder.value = normalizedControls.analogShoulder;
    activeUniforms.lidarStep.value = normalizedControls.lidarStep;
    activeUniforms.lidarJitterPx.value = normalizedControls.lidarJitterPx;
    activeUniforms.lidarSigmaPx.value = normalizedControls.lidarSigmaPx;
    activeUniforms.lidarDensity.value = normalizedControls.lidarDensity;
  }, [normalizedControls]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    camera.position.set(0, 0, 4);

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.25);
    keyLight.position.set(2.8, 0.9, 2.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#ffffff", 0.85);
    fillLight.position.set(-1.3, -0.1, 1.2);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight("#dbeafe", "#05070b", 0.25);
    scene.add(hemiLight);

    let renderer: THREE.WebGPURenderer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let postMaterial: THREE.MeshBasicNodeMaterial | null = null;
    let postQuad: THREE.Mesh | null = null;
    let postScene: THREE.Scene | null = null;
    let postCamera: THREE.OrthographicCamera | null = null;
    let renderTarget: THREE.RenderTarget | null = null;
    let disposed = false;

    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;

    const handlePointerMove = (event: PointerEvent) => {
      const normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = (event.clientY / window.innerHeight) * 2 - 1;
      targetRotationY = THREE.MathUtils.clamp(
        normalizedX * MAX_ROTATION_RADIANS,
        -MAX_ROTATION_RADIANS,
        MAX_ROTATION_RADIANS
      );
      targetRotationX = THREE.MathUtils.clamp(
        -normalizedY * MAX_ROTATION_RADIANS,
        -MAX_ROTATION_RADIANS,
        MAX_ROTATION_RADIANS
      );
    };

    const handleResize = () => {
      if (!renderer) {
        return;
      }

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      if (height <= 0 || width <= 0) {
        return;
      }

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, true);
      if (renderTarget) {
        renderTarget.setSize(width, height);
      }
    };

    const loader = new GLTFLoader();

    const initialize = async () => {
      try {
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;

        renderer = new THREE.WebGPURenderer({
          antialias: true,
          alpha: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height, true);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        await renderer.init();
        if (disposed) {
          return;
        }

        const gltf = await loader.loadAsync("/api/3d-model");
        if (disposed) {
          return;
        }

        modelRoot = gltf.scene;
        scene.add(modelRoot);

        const bounds = new THREE.Box3().setFromObject(modelRoot);
        const centerWorld = bounds.getCenter(new THREE.Vector3());
        const parent = modelRoot.parent;
        if (parent) {
          const centerInParent = parent.worldToLocal(centerWorld.clone());
          modelRoot.position.sub(centerInParent);
        } else {
          modelRoot.position.sub(centerWorld);
        }

        const fittedBounds = new THREE.Box3().setFromObject(modelRoot);
        const size = fittedBounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

        const fovRadians = THREE.MathUtils.degToRad(camera.fov);
        const fitDistance = maxDimension / (2 * Math.tan(fovRadians / 2));
        camera.position.set(0, 0.12, fitDistance * 1.55);
        camera.near = Math.max(0.01, fitDistance / 200);
        camera.far = Math.max(20, fitDistance * 30);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        modelRoot.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) {
            return;
          }
          obj.castShadow = false;
          obj.receiveShadow = false;
        });

        renderTarget = new THREE.RenderTarget(width, height, {
          depthBuffer: true,
          stencilBuffer: false,
        });
        renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

        postScene = new THREE.Scene();
        postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const uniforms: PostEffectUniforms = {
          mode: uniform(modeToValue(DEFAULT_CONTROLS.mode)),
          mediumMode: uniform(mediumModeToValue(DEFAULT_CONTROLS.mediumMode)),
          pixelSize: uniform(DEFAULT_CONTROLS.pixelSize),
          hexSize: uniform(DEFAULT_CONTROLS.hexSize),
          dotRadiusRatio: uniform(DEFAULT_CONTROLS.dotRadiusRatio),
          dotSoftnessPx: uniform(DEFAULT_CONTROLS.dotSoftnessPx),
          noiseDensity: uniform(DEFAULT_CONTROLS.noiseDensity),
          baseThreshold: uniform(DEFAULT_CONTROLS.baseThreshold),
          analogGammaR: uniform(DEFAULT_CONTROLS.analogGammaR),
          analogGammaG: uniform(DEFAULT_CONTROLS.analogGammaG),
          analogGammaB: uniform(DEFAULT_CONTROLS.analogGammaB),
          analogCrossTalk: uniform(DEFAULT_CONTROLS.analogCrossTalk),
          analogToe: uniform(DEFAULT_CONTROLS.analogToe),
          analogShoulder: uniform(DEFAULT_CONTROLS.analogShoulder),
          lidarStep: uniform(DEFAULT_CONTROLS.lidarStep),
          lidarJitterPx: uniform(DEFAULT_CONTROLS.lidarJitterPx),
          lidarSigmaPx: uniform(DEFAULT_CONTROLS.lidarSigmaPx),
          lidarDensity: uniform(DEFAULT_CONTROLS.lidarDensity),
        };
        uniformsRef.current = uniforms;

        postMaterial = new THREE.MeshBasicNodeMaterial();
        postMaterial.fragmentNode = buildConfigurableQuantizedPointCloudNode(
          renderTarget.texture,
          uniforms
        );

        postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
        postScene.add(postQuad);

        handleResize();
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("resize", handleResize);

        renderer.setAnimationLoop(() => {
          if (!modelRoot || !renderer || !renderTarget || !postScene || !postCamera) {
            return;
          }

          currentRotationX = THREE.MathUtils.lerp(currentRotationX, targetRotationX, 0.08);
          currentRotationY = THREE.MathUtils.lerp(currentRotationY, targetRotationY, 0.08);
          modelRoot.rotation.x = currentRotationX;
          modelRoot.rotation.y = currentRotationY;

          renderer.setRenderTarget(renderTarget);
          renderer.render(scene, camera);
          renderer.setRenderTarget(null);
          renderer.render(postScene, postCamera);
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown Three.js initialization error";
        setErrorMessage(message);
      }
    };

    void initialize();

    return () => {
      disposed = true;
      uniformsRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);

      if (renderer) {
        renderer.setAnimationLoop(null);
      }

      if (modelRoot) {
        modelRoot.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) {
            return;
          }

          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            for (const material of obj.material) {
              disposeMaterial(material);
            }
          } else if (obj.material) {
            disposeMaterial(obj.material);
          }
        });
      }

      scene.clear();
      if (postScene) {
        postScene.clear();
      }

      if (renderer) {
        renderer.dispose();
        const { domElement } = renderer;
        if (domElement.parentElement === container) {
          container.removeChild(domElement);
        }
      }
      if (postQuad?.geometry) {
        postQuad.geometry.dispose();
      }
      if (postMaterial) {
        postMaterial.dispose();
      }
      if (renderTarget) {
        renderTarget.dispose();
      }
    };
  }, []);

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = event.target.value as EffectMode;
    setControls((prev) => ({ ...prev, mode }));
  };

  const handleMediumModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mediumMode = event.target.value as MediumMode;
    setControls((prev) => ({ ...prev, mediumMode }));
  };

  const handleNumericControlChange =
    (key: Exclude<keyof PostEffectControls, "mode" | "mediumMode">) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isNaN(value)) {
        return;
      }
      setControls((prev) => ({ ...prev, [key]: value }));
    };

  return (
    <main className="fixed inset-0 h-svh w-svw overflow-hidden bg-black">
      <div ref={containerRef} className="h-full w-full" />
      <aside className="absolute right-0 top-0 z-10 h-full w-80 overflow-y-auto border-l border-white/20 bg-black/70 p-4 text-sm text-white backdrop-blur-sm">
        <h2 className="mb-4 text-base font-semibold text-white">Display Lab</h2>

        <div className="mb-4">
          <label htmlFor="effect-mode" className="mb-1 block text-xs uppercase tracking-wide text-white/70">
            Effect Mode
          </label>
          <select
            id="effect-mode"
            value={normalizedControls.mode}
            onChange={handleModeChange}
            className="w-full rounded border border-white/30 bg-black/70 px-2 py-1.5 text-sm text-white outline-none focus:border-white"
          >
            <option value="pixel">Pixel Grid</option>
            <option value="hex">Hex Dot Grid</option>
            <option value="lidar">LIDAR Dots</option>
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="medium-mode" className="mb-1 block text-xs uppercase tracking-wide text-white/70">
            Medium Response
          </label>
          <select
            id="medium-mode"
            value={normalizedControls.mediumMode}
            onChange={handleMediumModeChange}
            className="w-full rounded border border-white/30 bg-black/70 px-2 py-1.5 text-sm text-white outline-none focus:border-white"
          >
            <option value="digital">Digital</option>
            <option value="analog">Analog Curve</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Pixel Size ({normalizedControls.pixelSize.toFixed(1)})
            </span>
            <input
              type="range"
              min={2}
              max={24}
              step={0.5}
              value={normalizedControls.pixelSize}
              onChange={handleNumericControlChange("pixelSize")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Hex Size ({normalizedControls.hexSize.toFixed(1)})
            </span>
            <input
              type="range"
              min={3}
              max={28}
              step={0.5}
              value={normalizedControls.hexSize}
              onChange={handleNumericControlChange("hexSize")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Dot Radius Ratio ({normalizedControls.dotRadiusRatio.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.08}
              max={0.95}
              step={0.01}
              value={normalizedControls.dotRadiusRatio}
              onChange={handleNumericControlChange("dotRadiusRatio")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Dot Softness px ({normalizedControls.dotSoftnessPx.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={normalizedControls.dotSoftnessPx}
              onChange={handleNumericControlChange("dotSoftnessPx")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Noise Density ({normalizedControls.noiseDensity.toFixed(2)})
            </span>
            <input
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={normalizedControls.noiseDensity}
              onChange={handleNumericControlChange("noiseDensity")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Base Threshold ({normalizedControls.baseThreshold.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.2}
              max={0.8}
              step={0.01}
              value={normalizedControls.baseThreshold}
              onChange={handleNumericControlChange("baseThreshold")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Analog Gamma R ({normalizedControls.analogGammaR.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.2}
              max={1.8}
              step={0.01}
              value={normalizedControls.analogGammaR}
              onChange={handleNumericControlChange("analogGammaR")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Analog Gamma G ({normalizedControls.analogGammaG.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.2}
              max={1.8}
              step={0.01}
              value={normalizedControls.analogGammaG}
              onChange={handleNumericControlChange("analogGammaG")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Analog Gamma B ({normalizedControls.analogGammaB.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.2}
              max={1.8}
              step={0.01}
              value={normalizedControls.analogGammaB}
              onChange={handleNumericControlChange("analogGammaB")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Analog Cross-Talk ({normalizedControls.analogCrossTalk.toFixed(2)})
            </span>
            <input
              type="range"
              min={0}
              max={0.3}
              step={0.005}
              value={normalizedControls.analogCrossTalk}
              onChange={handleNumericControlChange("analogCrossTalk")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Analog Toe ({normalizedControls.analogToe.toFixed(2)})
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={normalizedControls.analogToe}
              onChange={handleNumericControlChange("analogToe")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              Analog Shoulder ({normalizedControls.analogShoulder.toFixed(2)})
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={normalizedControls.analogShoulder}
              onChange={handleNumericControlChange("analogShoulder")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              LIDAR Step ({normalizedControls.lidarStep.toFixed(1)})
            </span>
            <input
              type="range"
              min={3}
              max={24}
              step={0.5}
              value={normalizedControls.lidarStep}
              onChange={handleNumericControlChange("lidarStep")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              LIDAR Jitter px ({normalizedControls.lidarJitterPx.toFixed(2)})
            </span>
            <input
              type="range"
              min={0}
              max={16}
              step={0.1}
              value={normalizedControls.lidarJitterPx}
              onChange={handleNumericControlChange("lidarJitterPx")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              LIDAR Sigma px ({normalizedControls.lidarSigmaPx.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.4}
              max={12}
              step={0.1}
              value={normalizedControls.lidarSigmaPx}
              onChange={handleNumericControlChange("lidarSigmaPx")}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">
              LIDAR Density ({normalizedControls.lidarDensity.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={normalizedControls.lidarDensity}
              onChange={handleNumericControlChange("lidarDensity")}
              className="w-full accent-white"
            />
          </label>
        </div>
      </aside>
      {errorMessage ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <p className="max-w-xl text-center text-sm text-red-300">
            Failed to initialize `/3d`: {errorMessage}
          </p>
        </div>
      ) : null}
    </main>
  );
}
