"use client";

import React, {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  PipelineActions,
  PipelineMeta,
  PipelineOutput,
  PipelineState,
  PipelineStateContextValue,
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
const STORAGE_VERSION = 1;
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

type StoredPipelineEnvelope = {
  v: number;
  state: Partial<PipelineState>;
};

const normalizePipelineState = (parsed: Partial<PipelineState>): PipelineState => {
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
};

const loadFromStorage = (): PipelineState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;

    const parsed = JSON.parse(stored) as StoredPipelineEnvelope | Partial<PipelineState>;

    if ("v" in parsed && typeof parsed.v === "number") {
      if (parsed.v !== STORAGE_VERSION) {
        return normalizePipelineState(parsed.state ?? {});
      }
      return normalizePipelineState(parsed.state ?? {});
    }

    return normalizePipelineState(parsed as Partial<PipelineState>);
  } catch {
    return DEFAULT_STATE;
  }
};

const PipelineStateContext = createContext<PipelineStateContextValue | null>(null);
const PipelineActionsContext = createContext<PipelineActions | null>(null);
const PipelineMetaContext = createContext<PipelineMeta | null>(null);

export const PipelineProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<PipelineState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    return loadFromStorage();
  });
  const [pipelineOutput, setPipelineOutputState] = useState<PipelineOutput | null>(null);
  const [isHydrated] = useState(() => typeof window !== "undefined");

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
    if (!isHydrated) return;
    const timer = setTimeout(() => {
      const envelope: StoredPipelineEnvelope = { v: STORAGE_VERSION, state };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    }, 500);
    return () => clearTimeout(timer);
  }, [state, isHydrated]);

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

  const updateDownsize = useCallback((params: Partial<DownsizeParams>) => {
    startTransition(() => {
      setState((prev) => ({ ...prev, downsize: { ...prev.downsize, ...params } }));
    });
  }, []);

  const updateTone = useCallback((params: Partial<ToneParams>) => {
    startTransition(() => {
      setState((prev) => ({ ...prev, tone: { ...prev.tone, ...params } }));
    });
  }, []);

  const updateToneVisible = useCallback((key: keyof ToneParams, visible: boolean) => {
    startTransition(() => {
      setState((prev) => ({
        ...prev,
        toneVisible: { ...prev.toneVisible, [key]: visible },
      }));
    });
  }, []);

  const resetTone = useCallback(() => {
    startTransition(() => {
      setState((prev) => ({
        ...prev,
        tone: DEFAULT_TONE_PARAMS,
        toneVisible: DEFAULT_TONE_VISIBLE,
      }));
    });
  }, []);

  const updateDither = useCallback((params: Partial<DitherParams>) => {
    startTransition(() => {
      setState((prev) => ({ ...prev, dither: { ...prev.dither, ...params } }));
    });
  }, []);

  const stateValue = useMemo<PipelineStateContextValue>(
    () => ({ state, pipelineOutput }),
    [state, pipelineOutput],
  );

  const actionsValue = useMemo<PipelineActions>(
    () => ({
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

  const metaValue = useMemo<PipelineMeta>(() => ({ isHydrated }), [isHydrated]);

  return (
    <PipelineMetaContext.Provider value={metaValue}>
      <PipelineActionsContext.Provider value={actionsValue}>
        <PipelineStateContext.Provider value={stateValue}>
          {children}
        </PipelineStateContext.Provider>
      </PipelineActionsContext.Provider>
    </PipelineMetaContext.Provider>
  );
};

export const usePipelineState = (): PipelineStateContextValue => {
  const ctx = useContext(PipelineStateContext);
  if (!ctx) throw new Error("usePipelineState must be used within PipelineProvider");
  return ctx;
};

export const usePipelineActions = (): PipelineActions => {
  const ctx = useContext(PipelineActionsContext);
  if (!ctx) throw new Error("usePipelineActions must be used within PipelineProvider");
  return ctx;
};

export const usePipelineMeta = (): PipelineMeta => {
  const ctx = useContext(PipelineMetaContext);
  if (!ctx) throw new Error("usePipelineMeta must be used within PipelineProvider");
  return ctx;
};

export const usePipeline = () => {
  const { state, pipelineOutput } = usePipelineState();
  const actions = usePipelineActions();
  return { state, pipelineOutput, ...actions };
};
