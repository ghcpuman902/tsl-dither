"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  PipelineContextType,
  PipelineState,
  PipelineOutput,
  ToneParams,
  DitherParams,
  DownsizeParams,
  StageId,
} from "./types";
import {
  DEFAULT_DOWNSIZE_PARAMS,
  DEFAULT_TONE_PARAMS,
  DEFAULT_TONE_VISIBLE,
  DEFAULT_DITHER_PARAMS,
} from "./types";
import {
  saveSourceImage,
  getSourceImage,
  clearSourceImage,
} from "./source-image-db";

const STORAGE_KEY = "tsl-dither-pipeline";
export const SOURCE_IMAGE_FILENAME_KEY = "tsl-dither-source-image-filename";
const DEFAULT_IMAGE_SRC = "/DSC04192_LowRes.jpg";

const DEFAULT_STATE: PipelineState = {
  sourceImageSrc: DEFAULT_IMAGE_SRC,
  activeStage: "load",
  downsize: DEFAULT_DOWNSIZE_PARAMS,
  tone: DEFAULT_TONE_PARAMS,
  toneVisible: DEFAULT_TONE_VISIBLE,
  dither: DEFAULT_DITHER_PARAMS,
};

const loadFromStorage = (): PipelineState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    const parsed = JSON.parse(stored) as Partial<PipelineState>;
    const sourceImageSrc =
      typeof parsed.sourceImageSrc === "string" && parsed.sourceImageSrc.startsWith("blob:")
        ? DEFAULT_IMAGE_SRC
        : (parsed.sourceImageSrc ?? DEFAULT_STATE.sourceImageSrc);
    const rawActiveStage = (parsed as { activeStage?: string }).activeStage;
    const activeStage: StageId =
      rawActiveStage === "channel-preview"
        ? "dither"
        : (parsed.activeStage ?? DEFAULT_STATE.activeStage);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      sourceImageSrc,
      activeStage,
      downsize: { ...DEFAULT_DOWNSIZE_PARAMS, ...(parsed.downsize ?? {}) },
      tone: { ...DEFAULT_TONE_PARAMS, ...(parsed.tone ?? {}) },
      toneVisible: { ...DEFAULT_TONE_VISIBLE, ...(parsed.toneVisible ?? {}) },
      dither: { ...DEFAULT_DITHER_PARAMS, ...(parsed.dither ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
};

const PipelineContext = createContext<PipelineContextType | null>(null);

export const PipelineProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<PipelineState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    return loadFromStorage();
  });
  const [pipelineOutput, setPipelineOutputState] = useState<PipelineOutput | null>(null);

  const setPipelineOutput = useCallback((output: PipelineOutput | null) => {
    setPipelineOutputState(output);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getSourceImage();
        if (cancelled || !stored) return;
        const url = URL.createObjectURL(stored.blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        try {
          localStorage.setItem(SOURCE_IMAGE_FILENAME_KEY, stored.filename);
        } catch {
          // ignore
        }
        setState((prev) => ({ ...prev, sourceImageSrc: url }));
      } catch {
        // no stored image or IndexedDB unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  const setSourceImageSrc = useCallback((src: string) => {
    if (!src.startsWith("blob:")) {
      clearSourceImage().catch(() => {});
      try {
        localStorage.removeItem(SOURCE_IMAGE_FILENAME_KEY);
      } catch {
        // ignore
      }
      setState((prev) => ({ ...prev, sourceImageSrc: src }));
      return;
    }
    setState((prev) => ({ ...prev, sourceImageSrc: src }));
  }, []);

  /** Load a file as source: persist to IndexedDB first (no size limit), then set blob URL so refresh restores the image. */
  const setSourceImageFromFile = useCallback(async (file: File) => {
    await saveSourceImage(file);
    try {
      localStorage.setItem(SOURCE_IMAGE_FILENAME_KEY, file.name);
    } catch {
      // ignore
    }
    setState((prev) => {
      if (prev.sourceImageSrc.startsWith("blob:")) {
        URL.revokeObjectURL(prev.sourceImageSrc);
      }
      return { ...prev, sourceImageSrc: URL.createObjectURL(file) };
    });
  }, []);

  const setActiveStage = useCallback(
    (stage: StageId) => setState((prev) => ({ ...prev, activeStage: stage })),
    [],
  );

  const updateDownsize = useCallback(
    (params: Partial<DownsizeParams>) =>
      setState((prev) => ({ ...prev, downsize: { ...prev.downsize, ...params } })),
    [],
  );

  const updateTone = useCallback(
    (params: Partial<ToneParams>) =>
      setState((prev) => ({ ...prev, tone: { ...prev.tone, ...params } })),
    [],
  );

  const updateToneVisible = useCallback(
    (key: keyof ToneParams, visible: boolean) =>
      setState((prev) => ({
        ...prev,
        toneVisible: { ...prev.toneVisible, [key]: visible },
      })),
    [],
  );

  const resetTone = useCallback(
    () =>
      setState((prev) => ({
        ...prev,
        tone: DEFAULT_TONE_PARAMS,
        toneVisible: DEFAULT_TONE_VISIBLE,
      })),
    [],
  );

  const updateDither = useCallback(
    (params: Partial<DitherParams>) =>
      setState((prev) => ({ ...prev, dither: { ...prev.dither, ...params } })),
    [],
  );

  const value = useMemo<PipelineContextType>(
    () => ({
      state,
      pipelineOutput,
      setSourceImageSrc,
      setSourceImageFromFile,
      setActiveStage,
      setPipelineOutput,
      updateDownsize,
      updateTone,
      updateToneVisible,
      resetTone,
      updateDither,
    }),
    [
      state,
      pipelineOutput,
      setSourceImageSrc,
      setSourceImageFromFile,
      setActiveStage,
      setPipelineOutput,
      updateDownsize,
      updateTone,
      updateToneVisible,
      resetTone,
      updateDither,
    ],
  );

  return (
    <PipelineContext.Provider value={value}>
      {children}
    </PipelineContext.Provider>
  );
};

export const usePipeline = (): PipelineContextType => {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
};
