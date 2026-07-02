export type EffectMode = "pixel" | "hex" | "lidar";
export type MediumMode = "digital" | "analog";

export type PostEffectControls = {
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

export const DEFAULT_CONTROLS: PostEffectControls = {
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
