"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_MAX_LONG_EDGE } from "@/lib/sky/sky-detector";
import { decodeToWorkingImageData } from "@/lib/v2/decode-image";
import {
  useV2SkyDetect,
  type SkyDetectResult,
  type SkyDetectState,
} from "@/lib/v2/use-v2-sky-detect";
import {
  clearV3SourceImage,
  getV3SourceImage,
  saveV3SourceImage,
} from "./source-image-db";
import {
  DEFAULT_V3_STATE,
  V3_DEFAULT_OUTPUT_LONG_EDGE,
  V3_SAFE_MAX_LONG_EDGE,
  V3_SOURCE_FILENAME_KEY,
  V3_STORAGE_KEY,
  V3_STORAGE_VERSION,
  type V3PersistedState,
  type V3ViewMode,
} from "./types";

type StoredEnvelope = {
  v: number;
  state: Partial<V3PersistedState> | Record<string, unknown>;
};

export type V3Detection = {
  skyMargin: Float32Array;
  classMap: Uint16Array;
  width: number;
  height: number;
  inferWidth: number;
  inferHeight: number;
  logitWidth: number;
  logitHeight: number;
  inferenceMs: number;
};

type V3StateContextValue = {
  state: V3PersistedState;
  filename: string | null;
  workingImageData: ImageData | null;
  detection: V3Detection | null;
  isReady: boolean;
  skyDetect: SkyDetectState;
};

type V3Actions = {
  setSourceSrc: (src: string) => void;
  setSourceFromFile: (file: File) => Promise<void>;
  setView: (view: V3ViewMode) => void;
  setWorkingMaxLongEdge: (edge: number) => void;
  setMaskMaxLongEdge: (edge: number) => void;
  redetect: () => void;
};

const V3StateContext = createContext<V3StateContextValue | null>(null);
const V3ActionsContext = createContext<V3Actions | null>(null);

const normalizeState = (parsed: Partial<V3PersistedState>): V3PersistedState => {
  const sourceImageSrc =
    typeof parsed.sourceImageSrc === "string" &&
    parsed.sourceImageSrc.startsWith("blob:")
      ? DEFAULT_V3_STATE.sourceImageSrc
      : (parsed.sourceImageSrc ?? DEFAULT_V3_STATE.sourceImageSrc);

  const view: V3ViewMode =
    parsed.view === "source" ||
    parsed.view === "mask" ||
    parsed.view === "result"
      ? parsed.view
      : DEFAULT_V3_STATE.view;

  return { sourceImageSrc, view };
};

const loadFromStorage = (): V3PersistedState => {
  try {
    const stored = localStorage.getItem(V3_STORAGE_KEY);
    if (!stored) return DEFAULT_V3_STATE;
    const parsed = JSON.parse(stored) as
      | StoredEnvelope
      | Record<string, unknown>;
    if ("v" in parsed && typeof parsed.v === "number") {
      if (parsed.v !== V3_STORAGE_VERSION) return DEFAULT_V3_STATE;
      return normalizeState((parsed.state ?? {}) as Partial<V3PersistedState>);
    }
    return normalizeState(parsed as Partial<V3PersistedState>);
  } catch {
    return DEFAULT_V3_STATE;
  }
};

const toDetection = (result: SkyDetectResult): V3Detection => ({
  skyMargin: result.skyMargin,
  classMap: result.classMap,
  width: result.width,
  height: result.height,
  inferWidth: result.inferWidth,
  inferHeight: result.inferHeight,
  logitWidth: result.logitWidth,
  logitHeight: result.logitHeight,
  inferenceMs: result.inferenceMs,
});

export const V3Provider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<V3PersistedState>(() => {
    if (typeof window === "undefined") return DEFAULT_V3_STATE;
    return loadFromStorage();
  });
  const [filename, setFilename] = useState<string | null>(null);
  const [workingImageData, setWorkingImageData] = useState<ImageData | null>(
    null,
  );
  const [detection, setDetection] = useState<V3Detection | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [workingMaxLongEdge, setWorkingMaxLongEdge] = useState(
    V3_DEFAULT_OUTPUT_LONG_EDGE,
  );
  const [maskMaxLongEdge, setMaskMaxLongEdge] = useState(DEFAULT_MAX_LONG_EDGE);

  const workingRef = useRef<ImageData | null>(null);
  const sourceGenRef = useRef(0);
  const detectGenRef = useRef(0);
  const maskMaxLongEdgeRef = useRef(maskMaxLongEdge);
  const stateRef = useRef(state);
  const blobUrlRef = useRef<string | null>(
    state.sourceImageSrc.startsWith("blob:") ? state.sourceImageSrc : null,
  );

  const { state: skyDetect, requestDetect, warmup } = useV2SkyDetect();

  stateRef.current = state;
  maskMaxLongEdgeRef.current = maskMaxLongEdge;

  useEffect(() => {
    workingRef.current = workingImageData;
  }, [workingImageData]);

  useEffect(() => {
    blobUrlRef.current = state.sourceImageSrc.startsWith("blob:")
      ? state.sourceImageSrc
      : null;
  }, [state.sourceImageSrc]);

  useEffect(() => {
    return () => {
      const url = blobUrlRef.current;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    warmup();
  }, [warmup]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const envelope: StoredEnvelope = { v: V3_STORAGE_VERSION, state };
      try {
        localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(envelope));
      } catch {
        // ignore quota
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getV3SourceImage();
        if (cancelled || !stored) return;
        const url = URL.createObjectURL(stored.blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        try {
          localStorage.setItem(V3_SOURCE_FILENAME_KEY, stored.filename);
        } catch {
          // ignore
        }
        const prevSrc = stateRef.current.sourceImageSrc;
        if (prevSrc.startsWith("blob:") && prevSrc !== url) {
          URL.revokeObjectURL(prevSrc);
        }
        setFilename(stored.filename);
        setState((prev) => ({ ...prev, sourceImageSrc: url }));
      } catch {
        // no stored image
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const gen = ++sourceGenRef.current;

    (async () => {
      try {
        const imageData = await decodeToWorkingImageData(
          state.sourceImageSrc,
          workingMaxLongEdge,
          V3_SAFE_MAX_LONG_EDGE,
        );
        if (cancelled || gen !== sourceGenRef.current) return;

        setWorkingImageData(imageData);
        workingRef.current = imageData;
        setIsReady(true);
        setDetection(null);

        const detectGen = ++detectGenRef.current;
        try {
          const result = await requestDetect(imageData, {
            maxLongEdge: maskMaxLongEdgeRef.current,
          });
          if (
            cancelled ||
            gen !== sourceGenRef.current ||
            detectGen !== detectGenRef.current
          ) {
            return;
          }
          setDetection(toDetection(result));
        } catch (detectErr) {
          console.warn("[V3] Sky detect failed", detectErr);
          if (cancelled || gen !== sourceGenRef.current) return;
          setDetection(null);
        }
      } catch (err) {
        console.error("[V3] Failed to decode source", err);
        if (!cancelled) {
          setWorkingImageData(null);
          workingRef.current = null;
          setDetection(null);
          setIsReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.sourceImageSrc, workingMaxLongEdge, requestDetect]);

  const maskEdgeInitRef = useRef(false);
  useEffect(() => {
    if (!maskEdgeInitRef.current) {
      maskEdgeInitRef.current = true;
      return;
    }
    const image = workingRef.current;
    if (!image) return;

    let cancelled = false;
    const detectGen = ++detectGenRef.current;
    (async () => {
      try {
        const result = await requestDetect(image, {
          maxLongEdge: maskMaxLongEdge,
        });
        if (cancelled || detectGen !== detectGenRef.current) return;
        setDetection(toDetection(result));
      } catch (detectErr) {
        console.warn("[V3] Sky detect (mask edge) failed", detectErr);
        if (cancelled || detectGen !== detectGenRef.current) return;
        setDetection(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [maskMaxLongEdge, requestDetect]);

  const setSourceSrc = useCallback((src: string) => {
    const prevSrc = stateRef.current.sourceImageSrc;
    if (prevSrc.startsWith("blob:") && prevSrc !== src) {
      URL.revokeObjectURL(prevSrc);
    }
    setState((prev) => ({ ...prev, sourceImageSrc: src }));
    if (!src.startsWith("blob:")) {
      clearV3SourceImage().catch(() => {});
      try {
        localStorage.removeItem(V3_SOURCE_FILENAME_KEY);
      } catch {
        // ignore
      }
      setFilename(null);
    }
  }, []);

  const setSourceFromFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    const prevSrc = stateRef.current.sourceImageSrc;
    if (prevSrc.startsWith("blob:")) {
      URL.revokeObjectURL(prevSrc);
    }
    setState((prev) => ({ ...prev, sourceImageSrc: url }));
    try {
      localStorage.setItem(V3_SOURCE_FILENAME_KEY, file.name);
    } catch {
      // ignore
    }
    setFilename(file.name);
    try {
      await saveV3SourceImage(file);
    } catch (err) {
      console.warn("[V3] Failed to persist source image", err);
    }
  }, []);

  const setView = useCallback((view: V3ViewMode) => {
    setState((prev) => ({ ...prev, view }));
  }, []);

  const redetect = useCallback(() => {
    const image = workingRef.current;
    if (!image) return;
    const detectGen = ++detectGenRef.current;
    (async () => {
      try {
        const result = await requestDetect(image, {
          maxLongEdge: maskMaxLongEdgeRef.current,
        });
        if (detectGen !== detectGenRef.current) return;
        setDetection(toDetection(result));
      } catch (detectErr) {
        console.warn("[V3] Re-detect failed", detectErr);
        if (detectGen !== detectGenRef.current) return;
        setDetection(null);
      }
    })();
  }, [requestDetect]);

  const stateValue = useMemo<V3StateContextValue>(
    () => ({
      state,
      filename,
      workingImageData,
      detection,
      isReady,
      skyDetect,
    }),
    [state, filename, workingImageData, detection, isReady, skyDetect],
  );

  const actionsValue = useMemo<V3Actions>(
    () => ({
      setSourceSrc,
      setSourceFromFile,
      setView,
      setWorkingMaxLongEdge,
      setMaskMaxLongEdge,
      redetect,
    }),
    [setSourceSrc, setSourceFromFile, setView, redetect],
  );

  return (
    <V3StateContext value={stateValue}>
      <V3ActionsContext value={actionsValue}>{children}</V3ActionsContext>
    </V3StateContext>
  );
};

export const useV3State = (): V3StateContextValue => {
  const value = use(V3StateContext);
  if (!value) throw new Error("useV3State must be used within V3Provider");
  return value;
};

export const useV3Actions = (): V3Actions => {
  const value = use(V3ActionsContext);
  if (!value) throw new Error("useV3Actions must be used within V3Provider");
  return value;
};
