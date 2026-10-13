"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDialKitController } from "dialkit";
import { DEFAULT_MAX_LONG_EDGE } from "@/lib/sky/sky-detector";
import { DEFAULT_LAYER_PARAMS, type V3LayerId } from "./layers";
import {
  isPalettePresetId,
  PALETTE_BY_ID,
  PALETTE_PRESETS,
  type PalettePresetId,
} from "./palette";
import {
  V3_DEFAULT_OUTPUT_LONG_EDGE,
  V3_SAFE_MAX_LONG_EDGE,
  V3_SAMPLE_IMAGES,
  type PaletteDitherMethod,
  type PaletteDitherParams,
} from "./types";

/** Method select embeds Bayer matrix size — two modes only. */
const METHOD_OPTIONS = [
  { value: "ordered:8", label: "Ordered 8×8" },
  { value: "ordered:4", label: "Ordered 4×4" },
  { value: "ordered:2", label: "Ordered 2×2" },
  { value: "noise", label: "Noise" },
] as const;

type MethodOptionValue = (typeof METHOD_OPTIONS)[number]["value"];

const PALETTE_OPTIONS = PALETTE_PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
}));

const SAMPLE_OPTIONS = V3_SAMPLE_IMAGES.map((s) => ({
  value: s.src,
  label: s.label,
}));

export const V3_UPLOADED_SOURCE_VALUE = "__uploaded__";

export type V3DialActions = {
  onLoadImage: () => void;
  onRedetect: () => void;
  onExport: () => void;
};

export type V3DialLayerParams = {
  method: PaletteDitherMethod;
  bayerSize: number;
  strength: number;
  bias: number;
  chroma: number;
  paletteId: PalettePresetId;
};

const methodToOption = (
  method: PaletteDitherMethod,
  bayerSize: number,
): MethodOptionValue => {
  if (method === "ordered") {
    if (bayerSize <= 2) return "ordered:2";
    if (bayerSize <= 4) return "ordered:4";
    return "ordered:8";
  }
  return "noise";
};

const parseMethodOption = (
  value: string,
): { method: PaletteDitherMethod; bayerSize: number } => {
  if (value === "ordered:2") return { method: "ordered", bayerSize: 2 };
  if (value === "ordered:4") return { method: "ordered", bayerSize: 4 };
  if (value === "ordered:8") return { method: "ordered", bayerSize: 8 };
  return { method: "noise", bayerSize: 4 };
};

const resolvePaletteId = (value: string): PalettePresetId =>
  isPalettePresetId(value) ? value : DEFAULT_LAYER_PARAMS.fg.paletteId;

export type UseV3DialsReturn = {
  values: {
    source: string;
    image: { maxLongEdge: number };
    sky: { includeMore: number; brightFill: number; maxLongEdge: number };
    background: V3DialLayerParams;
    foreground: V3DialLayerParams;
  };
  layerParams: Record<V3LayerId, PaletteDitherParams>;
  setSourceValue: (value: string) => void;
};

export const useV3Dials = (
  actions: V3DialActions,
  options: {
    isUploaded: boolean;
    currentSourceSrc: string;
  },
): UseV3DialsReturn => {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const sampleOptions = options.isUploaded
    ? [...SAMPLE_OPTIONS, { value: V3_UPLOADED_SOURCE_VALUE, label: "Uploaded" }]
    : SAMPLE_OPTIONS;

  const defaultSource = options.isUploaded
    ? V3_UPLOADED_SOURCE_VALUE
    : (SAMPLE_OPTIONS.find((o) => o.value === options.currentSourceSrc)?.value ??
      SAMPLE_OPTIONS[0]?.value ??
      V3_SAMPLE_IMAGES[0].src);

  const bgDefault = methodToOption(
    DEFAULT_LAYER_PARAMS.bg.method,
    DEFAULT_LAYER_PARAMS.bg.bayerSize,
  );
  const fgDefault = methodToOption(
    DEFAULT_LAYER_PARAMS.fg.method,
    DEFAULT_LAYER_PARAMS.fg.bayerSize,
  );

  const dial = useDialKitController(
    "Dither",
    {
      source: {
        type: "select" as const,
        options: sampleOptions,
        default: defaultSource,
      },
      loadImage: { type: "action" as const, label: "Load Image…" },
      image: {
        maxLongEdge: [
          V3_DEFAULT_OUTPUT_LONG_EDGE,
          0,
          V3_SAFE_MAX_LONG_EDGE,
          16,
        ] as [number, number, number, number],
      },
      sky: {
        maxLongEdge: [DEFAULT_MAX_LONG_EDGE, 256, 2048, 16] as [
          number,
          number,
          number,
          number,
        ],
        includeMore: [0, 0, 100, 1] as [number, number, number, number],
        brightFill: [0, 0, 100, 1] as [number, number, number, number],
        redetect: { type: "action" as const, label: "Re-detect sky" },
      },
      background: {
        method: {
          type: "select" as const,
          options: [...METHOD_OPTIONS],
          default: bgDefault,
        },
        palette: {
          type: "select" as const,
          options: [...PALETTE_OPTIONS],
          default: DEFAULT_LAYER_PARAMS.bg.paletteId,
        },
        strength: [DEFAULT_LAYER_PARAMS.bg.strength, 0, 100, 1] as [
          number,
          number,
          number,
          number,
        ],
        bias: [DEFAULT_LAYER_PARAMS.bg.bias, -50, 50, 1] as [
          number,
          number,
          number,
          number,
        ],
        chroma: [DEFAULT_LAYER_PARAMS.bg.chroma, 0, 100, 1] as [
          number,
          number,
          number,
          number,
        ],
      },
      foreground: {
        method: {
          type: "select" as const,
          options: [...METHOD_OPTIONS],
          default: fgDefault,
        },
        palette: {
          type: "select" as const,
          options: [...PALETTE_OPTIONS],
          default: DEFAULT_LAYER_PARAMS.fg.paletteId,
        },
        strength: [DEFAULT_LAYER_PARAMS.fg.strength, 0, 100, 1] as [
          number,
          number,
          number,
          number,
        ],
        bias: [DEFAULT_LAYER_PARAMS.fg.bias, -50, 50, 1] as [
          number,
          number,
          number,
          number,
        ],
        chroma: [DEFAULT_LAYER_PARAMS.fg.chroma, 0, 100, 1] as [
          number,
          number,
          number,
          number,
        ],
      },
      exportPng: { type: "action" as const, label: "Download PNG" },
    },
    {
      id: "v3",
      persist: true,
      onAction: (path) => {
        if (path === "loadImage") actionsRef.current.onLoadImage();
        if (path === "sky.redetect") actionsRef.current.onRedetect();
        if (path === "exportPng") actionsRef.current.onExport();
      },
    },
  );

  const setValueRef = useRef(dial.setValue);
  useEffect(() => {
    setValueRef.current = dial.setValue;
  }, [dial.setValue]);

  const setSourceValue = useCallback((value: string) => {
    setValueRef.current("source", value);
  }, []);

  const bgParsed = parseMethodOption(String(dial.values.background.method));
  const fgParsed = parseMethodOption(String(dial.values.foreground.method));
  const bgPaletteId = resolvePaletteId(String(dial.values.background.palette));
  const fgPaletteId = resolvePaletteId(String(dial.values.foreground.palette));
  const bgStrength = dial.values.background.strength;
  const bgBias = dial.values.background.bias;
  const bgChroma = dial.values.background.chroma;
  const fgStrength = dial.values.foreground.strength;
  const fgBias = dial.values.foreground.bias;
  const fgChroma = dial.values.foreground.chroma;

  const bg: V3DialLayerParams = {
    method: bgParsed.method,
    bayerSize: bgParsed.bayerSize,
    strength: bgStrength,
    bias: bgBias,
    chroma: bgChroma,
    paletteId: bgPaletteId,
  };
  const fg: V3DialLayerParams = {
    method: fgParsed.method,
    bayerSize: fgParsed.bayerSize,
    strength: fgStrength,
    bias: fgBias,
    chroma: fgChroma,
    paletteId: fgPaletteId,
  };

  const layerParams = useMemo<Record<V3LayerId, PaletteDitherParams>>(
    () => ({
      bg: {
        method: bgParsed.method,
        bayerSize: bgParsed.bayerSize,
        strength: bgStrength,
        bias: bgBias,
        chroma: bgChroma,
        paletteId: bgPaletteId,
        palette: PALETTE_BY_ID[bgPaletteId].colors,
      },
      fg: {
        method: fgParsed.method,
        bayerSize: fgParsed.bayerSize,
        strength: fgStrength,
        bias: fgBias,
        chroma: fgChroma,
        paletteId: fgPaletteId,
        palette: PALETTE_BY_ID[fgPaletteId].colors,
      },
    }),
    [
      bgParsed.method,
      bgParsed.bayerSize,
      bgStrength,
      bgBias,
      bgChroma,
      bgPaletteId,
      fgParsed.method,
      fgParsed.bayerSize,
      fgStrength,
      fgBias,
      fgChroma,
      fgPaletteId,
    ],
  );

  const outputMaxLongEdge = Math.round(
    Number(dial.values.image.maxLongEdge) || 0,
  );
  const maskMaxLongEdge = Math.round(
    Number(dial.values.sky.maxLongEdge) || DEFAULT_MAX_LONG_EDGE,
  );

  return {
    values: {
      source: String(dial.values.source),
      image: { maxLongEdge: outputMaxLongEdge },
      sky: {
        includeMore: dial.values.sky.includeMore,
        brightFill: dial.values.sky.brightFill,
        maxLongEdge: maskMaxLongEdge,
      },
      background: bg,
      foreground: fg,
    },
    layerParams,
    setSourceValue,
  };
};
