export type StageId = "load" | "tone" | "dither" | "export";

export type ToneParams = {
  exposure: number;    // -5 to +5 (stops)
  contrast: number;    // -100 to +100
  highlights: number;  // -100 to +100
  shadows: number;     // -100 to +100
  whites: number;      // -100 to +100
  blacks: number;      // -100 to +100
  saturation: number;  // -100 to +100
  temperature: number; // -100 (cool) to +100 (warm)
};

export const DEFAULT_TONE_PARAMS: ToneParams = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  saturation: 0,
  temperature: 0,
};

/** Per-control visibility (Photoshop-style "eye"). When false, that adjustment is not applied. */
export type ToneVisible = Record<keyof ToneParams, boolean>;

export const DEFAULT_TONE_VISIBLE: ToneVisible = {
  exposure: true,
  contrast: true,
  highlights: true,
  shadows: true,
  whites: true,
  blacks: true,
  saturation: true,
  temperature: true,
};

export type DitherMethod =
  | "threshold"
  | "white-noise"
  | "bayer"
  | "atkinson"
  | "burkes"
  | "floyd-steinberg"
  | "jjn"
  | "sierra"
  | "stucki";

export type DitherParams = {
  method: DitherMethod;
  threshold: number;   // 0–100 binary cut for threshold method
  density: number;     // 0–100 for white noise
  bayerSize: number;   // precomputed matrix size for Bayer (e.g. 2, 4, 8)
};

export const DEFAULT_DITHER_PARAMS: DitherParams = {
  method: "threshold",
  threshold: 50,
  density: 50,
  bayerSize: 4,
};

export type PipelineState = {
  sourceImageSrc: string;
  activeStage: StageId;
  tone: ToneParams;
  toneVisible: ToneVisible;
  dither: DitherParams;
};

/** Flattened RGBA buffer + dimensions: current pipeline output (tone or dither), saved at tab switch for next stage to read. */
export type PipelineOutput = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
};

export type PipelineContextType = {
  state: PipelineState;
  /** Current pipeline output (tone-adjusted or dithered). Written when a stage produces result; Export reads it. */
  pipelineOutput: PipelineOutput | null;
  setSourceImageSrc: (src: string) => void;
  setSourceImageFromFile: (file: File) => Promise<void>;
  setActiveStage: (stage: StageId) => void;
  setPipelineOutput: (output: PipelineOutput | null) => void;
  updateTone: (params: Partial<ToneParams>) => void;
  updateToneVisible: (key: keyof ToneParams, visible: boolean) => void;
  resetTone: () => void;
  updateDither: (params: Partial<DitherParams>) => void;
};

export type Stage = {
  id: StageId;
  label: string;
};

export const PIPELINE_STAGES: Stage[] = [
  { id: "load", label: "Load" },
  { id: "tone", label: "Tone" },
  { id: "dither", label: "Dither" },
  { id: "export", label: "Export" },
];
