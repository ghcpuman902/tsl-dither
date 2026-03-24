"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  float,
  hash,
  screenCoordinate,
  step,
  texture,
  viewportUV,
  viewportSize,
  vec3,
  vec4,
} from "three/tsl";

const MAX_ROTATION_DEGREES = 5;
const MAX_ROTATION_RADIANS = THREE.MathUtils.degToRad(MAX_ROTATION_DEGREES);
const NOISE_DENSITY = 0.15;
const BASE_THRESHOLD = 0.5;
const NOISE_SEED_R = 12345.0;
const NOISE_SEED_G = 23456.0;
const NOISE_SEED_B = 34567.0;

const buildWhiteNoiseQuantizedColorNode = (
  seedR: number,
  seedG: number,
  seedB: number,
  sampledColorNode: ReturnType<typeof vec4>
) => {
  const densityNode = float(NOISE_DENSITY);
  const baseThresholdNode = float(BASE_THRESHOLD);
  const pixelCoord = screenCoordinate.floor();
  const viewportWidth = viewportSize.x.floor().max(1.0);
  const pixelIndex = pixelCoord.y.mul(viewportWidth).add(pixelCoord.x);

  const noiseR = hash(pixelIndex.add(float(seedR)));
  const noiseG = hash(pixelIndex.add(float(seedG)));
  const noiseB = hash(pixelIndex.add(float(seedB)));

  const thresholdR = baseThresholdNode
    .add(noiseR.sub(0.5).mul(densityNode))
    .clamp(0.0, 1.0);
  const thresholdG = baseThresholdNode
    .add(noiseG.sub(0.5).mul(densityNode))
    .clamp(0.0, 1.0);
  const thresholdB = baseThresholdNode
    .add(noiseB.sub(0.5).mul(densityNode))
    .clamp(0.0, 1.0);

  // Match CPU dither behavior more closely by thresholding in display-like (gamma) space.
  const displayRgb = sampledColorNode.rgb.clamp(0.0, 1.0).pow(vec3(1.0 / 2.2));

  const binaryRgb = vec3(
    step(thresholdR, displayRgb.r),
    step(thresholdG, displayRgb.g),
    step(thresholdB, displayRgb.b)
  );

  return vec4(binaryRgb, sampledColorNode.a);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    camera.position.set(0, 0, 4);

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.05);
    keyLight.position.set(2.8, 0.9, 2.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#ffffff", 0.25);
    fillLight.position.set(-1.3, -0.1, 1.2);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight("#dbeafe", "#05070b", 0.55);
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

        postMaterial = new THREE.MeshBasicNodeMaterial();
        const sampledSceneColor = texture(renderTarget.texture, viewportUV);
        postMaterial.fragmentNode = buildWhiteNoiseQuantizedColorNode(
          NOISE_SEED_R,
          NOISE_SEED_G,
          NOISE_SEED_B,
          sampledSceneColor
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

  return (
    <main className="fixed inset-0 h-svh w-svw overflow-hidden bg-black">
      <div ref={containerRef} className="h-full w-full" />
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
