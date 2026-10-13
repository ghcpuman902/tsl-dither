"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDialKitController } from "dialkit";
import type { DitherMethod, DitherParams } from "@/lib/types";
import { DEFAULT_MAX_LONG_EDGE } from "@/lib/sky/sky-detector";
import { DEFAULT_LAYER_PARAMS, type V2LayerId } from "./layers";
import {
  V2_DEFAULT_OUTPUT_LONG_EDGE,
  V2_SAFE_MAX_LONG_EDGE,
  V2_SAMPLE_IMAGES,
} from "./types";

/** Method select embeds Bayer matrix size. Threshold uses opacity for noise. */
const METHOD_OPTIONS = [
  { value: "bayer:8", label: "Bayer 8×8" },
  { value: "bayer:4", label: "Bayer 4×4" },
  { value: "bayer:2", label: "Bayer 2×2" },
  { value: "threshold", label: "Threshold" },
] as const;

type MethodOptionValue = (typeof METHOD_OPTIONS)[number]["value"];

const SAMPLE_OPTIONS = V2_SAMPLE_IMAGES.map((s) => ({
  value: s.src,
  label: s.label,
}));

export const V2_UPLOADED_SOURCE_VALUE = "__uploaded__";

export type V2DialActions = {
  onLoadImage: () => void;
  onRedetect: () => void;
  onExport: () => void;
};

export type V2DialLayerParams = {
  method: DitherMethod;
  bayerSize: number;
  threshold: number;
  opacity: number;
};

const methodToOption = (
  method: DitherMethod,
  bayerSize: number,
): MethodOptionValue => {
  if (method === "bayer") {
    if (bayerSize <= 2) return "bayer:2";
    if (bayerSize <= 4) return "bayer:4";
    return "bayer:8";
  }
  return "threshold";
};

const parseMethodOption = (
  value: string,
): { method: DitherMethod; bayerSize: number } => {
  if (value === "bayer:2") return { method: "bayer", bayerSize: 2 };
  if (value === "bayer:4") return { method: "bayer", bayerSize: 4 };
  if (value === "bayer:8" || value === "bayer") {
    return { method: "bayer", bayerSize: 8 };
  }
  // Legacy dialkit values "white-noise" / "threshold" both map here.
  return { method: "threshold", bayerSize: 4 };
};

/** Threshold + opacity only for the merged threshold method. */
const layerParamControls = (
  methodKey: string,
  defaults: DitherParams,
): Record<string, unknown> => {
  const { method } = parseMethodOption(methodKey);
  if (method === "bayer") return {};
  return {
    threshold: [defaults.threshold, 0, 100, 1] as [
      number,
      number,
      number,
      number,
    ],
    opacity: [defaults.opacity, 0, 100, 1] as [number, number, number, number],
  };
};

export type UseV2DialsReturn = {
  values: {
    source: string;
    image: { maxLongEdge: number };
    sky: { includeMore: number; brightFill: number; maxLongEdge: number };
    background: V2DialLayerParams;
    foreground: V2DialLayerParams;
  };
  layerParams: Record<V2LayerId, DitherParams>;
  setSourceValue: (value: string) => void;
};

/**
 * DialKit controller for the v2 sidebar. Persist + id so remounts reconnect.
 */
export const useV2Dials = (
  actions: V2DialActions,
  options: {
    isUploaded: boolean;
    currentSourceSrc: string;
  },
): UseV2DialsReturn => {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const sampleOptions = options.isUploaded
    ? [...SAMPLE_OPTIONS, { value: V2_UPLOADED_SOURCE_VALUE, label: "Uploaded" }]
    : SAMPLE_OPTIONS;

  const defaultSource = options.isUploaded
    ? V2_UPLOADED_SOURCE_VALUE
    : (SAMPLE_OPTIONS.find((o) => o.value === options.currentSourceSrc)?.value ??
      SAMPLE_OPTIONS[0]?.value ??
      V2_SAMPLE_IMAGES[0].src);

  const bgDefault = methodToOption(
    DEFAULT_LAYER_PARAMS.bg.method,
    DEFAULT_LAYER_PARAMS.bg.bayerSize,
  );
  const fgDefault = methodToOption(
    DEFAULT_LAYER_PARAMS.fg.method,
    DEFAULT_LAYER_PARAMS.fg.bayerSize,
  );

  const [bgMethodKey, setBgMethodKey] = useState<string>(bgDefault);
  const [fgMethodKey, setFgMethodKey] = useState<string>(fgDefault);

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
        // 0 = native resolution (no shrink). Same clamp algo as decode / sky mask.
        maxLongEdge: [
          V2_DEFAULT_OUTPUT_LONG_EDGE,
          0,
          V2_SAFE_MAX_LONG_EDGE,
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
        ...layerParamControls(bgMethodKey, DEFAULT_LAYER_PARAMS.bg),
      },
      foreground: {
        method: {
          type: "select" as const,
          options: [...METHOD_OPTIONS],
          default: fgDefault,
        },
        ...layerParamControls(fgMethodKey, DEFAULT_LAYER_PARAMS.fg),
      },
      exportPng: { type: "action" as const, label: "Download PNG" },
    },
    {
      id: "v2",
      persist: true,
      onAction: (path) => {
        if (path === "loadImage") actionsRef.current.onLoadImage();
        if (path === "sky.redetect") actionsRef.current.onRedetect();
        if (path === "exportPng") actionsRef.current.onExport();
      },
    },
  );

  useEffect(() => {
    setBgMethodKey(String(dial.values.background.method));
  }, [dial.values.background.method]);

  useEffect(() => {
    setFgMethodKey(String(dial.values.foreground.method));
  }, [dial.values.foreground.method]);

  const setValueRef = useRef(dial.setValue);
  useEffect(() => {
    setValueRef.current = dial.setValue;
  }, [dial.setValue]);

  const setSourceValue = useCallback((value: string) => {
    setValueRef.current("source", value);
  }, []);

  const bgParsed = parseMethodOption(String(dial.values.background.method));
  const fgParsed = parseMethodOption(String(dial.values.foreground.method));
  const bgFolder = dial.values.background as {
    method: string;
    threshold?: number;
    opacity?: number;
    density?: number;
  };
  const fgFolder = dial.values.foreground as {
    method: string;
    threshold?: number;
    opacity?: number;
    density?: number;
  };
  const bgThreshold = bgFolder.threshold ?? DEFAULT_LAYER_PARAMS.bg.threshold;
  const bgOpacity =
    bgFolder.opacity ?? bgFolder.density ?? DEFAULT_LAYER_PARAMS.bg.opacity;
  const fgThreshold = fgFolder.threshold ?? DEFAULT_LAYER_PARAMS.fg.threshold;
  const fgOpacity =
    fgFolder.opacity ?? fgFolder.density ?? DEFAULT_LAYER_PARAMS.fg.opacity;

  const bg: V2DialLayerParams = {
    method: bgParsed.method,
    bayerSize: bgParsed.bayerSize,
    threshold: bgThreshold,
    opacity: bgOpacity,
  };
  const fg: V2DialLayerParams = {
    method: fgParsed.method,
    bayerSize: fgParsed.bayerSize,
    threshold: fgThreshold,
    opacity: fgOpacity,
  };

  const layerParams = useMemo<Record<V2LayerId, DitherParams>>(
    () => ({
      bg: {
        method: bgParsed.method,
        threshold: bgThreshold,
        opacity: bgOpacity,
        bayerSize: bgParsed.bayerSize,
      },
      fg: {
        method: fgParsed.method,
        threshold: fgThreshold,
        opacity: fgOpacity,
        bayerSize: fgParsed.bayerSize,
      },
    }),
    [
      bgParsed.method,
      bgParsed.bayerSize,
      bgThreshold,
      bgOpacity,
      fgParsed.method,
      fgParsed.bayerSize,
      fgThreshold,
      fgOpacity,
    ],
  );

  const outputMaxLongEdge = Math.round(Number(dial.values.image.maxLongEdge) || 0);
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
