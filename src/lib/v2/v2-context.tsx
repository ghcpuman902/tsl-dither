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
import { decodeToWorkingImageData } from "./decode-image";
import {
  clearV2SourceImage,
  getV2SourceImage,
  saveV2SourceImage,
} from "./source-image-db";
import {
  useV2SkyDetect,
  type SkyDetectResult,
  type SkyDetectState,
} from "./use-v2-sky-detect";
import {
  DEFAULT_V2_STATE,
  V2_DEFAULT_OUTPUT_LONG_EDGE,
  V2_SAFE_MAX_LONG_EDGE,
  V2_SOURCE_FILENAME_KEY,
  V2_STORAGE_KEY,
  V2_STORAGE_VERSION,
  type V2PersistedState,
  type V2ViewMode,
} from "./types";

type StoredEnvelope = {
  v: number;
  state: Partial<V2PersistedState> | Record<string, unknown>;
};

export type V2Detection = {
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

type V2StateContextValue = {
  state: V2PersistedState;
  filename: string | null;
  workingImageData: ImageData | null;
  detection: V2Detection | null;
  isReady: boolean;
  skyDetect: SkyDetectState;
};

type V2Actions = {
  setSourceSrc: (src: string) => void;
  setSourceFromFile: (file: File) => Promise<void>;
  setView: (view: V2ViewMode) => void;
  setWorkingMaxLongEdge: (edge: number) => void;
  setMaskMaxLongEdge: (edge: number) => void;
  redetect: () => void;
};

const V2StateContext = createContext<V2StateContextValue | null>(null);
const V2ActionsContext = createContext<V2Actions | null>(null);

const normalizeState = (parsed: Partial<V2PersistedState>): V2PersistedState => {
  const sourceImageSrc =
    typeof parsed.sourceImageSrc === "string" && parsed.sourceImageSrc.startsWith("blob:")
      ? DEFAULT_V2_STATE.sourceImageSrc
      : (parsed.sourceImageSrc ?? DEFAULT_V2_STATE.sourceImageSrc);

  const view: V2ViewMode =
    parsed.view === "source" || parsed.view === "mask" || parsed.view === "result"
      ? parsed.view
      : DEFAULT_V2_STATE.view;

  return { sourceImageSrc, view };
};

const loadFromStorage = (): V2PersistedState => {
  try {
    const stored = localStorage.getItem(V2_STORAGE_KEY);
    if (!stored) return DEFAULT_V2_STATE;
    const parsed = JSON.parse(stored) as StoredEnvelope | Record<string, unknown>;
    if ("v" in parsed && typeof parsed.v === "number") {
      if (parsed.v !== V2_STORAGE_VERSION) return DEFAULT_V2_STATE;
      return normalizeState((parsed.state ?? {}) as Partial<V2PersistedState>);
    }
    return normalizeState(parsed as Partial<V2PersistedState>);
  } catch {
    return DEFAULT_V2_STATE;
  }
};

const toDetection = (result: SkyDetectResult): V2Detection => ({
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

export const V2Provider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<V2PersistedState>(() => {
    if (typeof window === "undefined") return DEFAULT_V2_STATE;
    return loadFromStorage();
  });
  const [filename, setFilename] = useState<string | null>(null);
  const [workingImageData, setWorkingImageData] = useState<ImageData | null>(null);
  const [detection, setDetection] = useState<V2Detection | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [workingMaxLongEdge, setWorkingMaxLongEdge] = useState(
    V2_DEFAULT_OUTPUT_LONG_EDGE,
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

  // Free the active object URL when the provider unmounts.
  useEffect(() => {
    return () => {
      const url = blobUrlRef.current;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    warmup();
  }, [warmup]);

  // Persist source + view only (DialKit owns params).
  useEffect(() => {
    const timer = setTimeout(() => {
      const envelope: StoredEnvelope = { v: V2_STORAGE_VERSION, state };
      try {
        localStorage.setItem(V2_STORAGE_KEY, JSON.stringify(envelope));
      } catch {
        // ignore quota
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  // Restore uploaded source from IndexedDB.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getV2SourceImage();
        if (cancelled || !stored) return;
        const url = URL.createObjectURL(stored.blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        try {
          localStorage.setItem(V2_SOURCE_FILENAME_KEY, stored.filename);
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

  // Decode source → working ImageData → sky detect.
  // Output long-edge is optional (0 = native). Mask long-edge only affects inference.
  useEffect(() => {
    let cancelled = false;
    const gen = ++sourceGenRef.current;

    (async () => {
      try {
        const imageData = await decodeToWorkingImageData(
          state.sourceImageSrc,
          workingMaxLongEdge,
          V2_SAFE_MAX_LONG_EDGE,
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
          console.warn("[V2] Sky detect failed", detectErr);
          if (cancelled || gen !== sourceGenRef.current) return;
          setDetection(null);
        }
      } catch (err) {
        console.error("[V2] Failed to decode source", err);
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

  // Re-run sky detect when mask max long edge changes (working pixels unchanged).
  // Skip the initial mount — decode effect already detects with the current ref.
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
        console.warn("[V2] Sky detect (mask edge) failed", detectErr);
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
      clearV2SourceImage().catch(() => {});
      try {
        localStorage.removeItem(V2_SOURCE_FILENAME_KEY);
      } catch {
        // ignore
      }
      setFilename(null);
    }
  }, []);

  const setSourceFromFile = useCallback(async (file: File) => {
    // Create the object URL first so decode can start while IndexedDB writes.
    const url = URL.createObjectURL(file);
    const prevSrc = stateRef.current.sourceImageSrc;
    if (prevSrc.startsWith("blob:")) {
      URL.revokeObjectURL(prevSrc);
    }
    setState((prev) => ({ ...prev, sourceImageSrc: url }));
    try {
      localStorage.setItem(V2_SOURCE_FILENAME_KEY, file.name);
    } catch {
      // ignore
    }
    setFilename(file.name);
    try {
      await saveV2SourceImage(file);
    } catch (err) {
      console.warn("[V2] Failed to persist source image", err);
    }
  }, []);

  const setView = useCallback((view: V2ViewMode) => {
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
        console.warn("[V2] Re-detect failed", detectErr);
        if (detectGen !== detectGenRef.current) return;
        setDetection(null);
      }
    })();
  }, [requestDetect]);

  const stateValue = useMemo<V2StateContextValue>(
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

  const actionsValue = useMemo<V2Actions>(
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
    <V2StateContext value={stateValue}>
      <V2ActionsContext value={actionsValue}>{children}</V2ActionsContext>
    </V2StateContext>
  );
};

export const useV2State = (): V2StateContextValue => {
  const value = use(V2StateContext);
  if (!value) throw new Error("useV2State must be used within V2Provider");
  return value;
};

export const useV2Actions = (): V2Actions => {
  const value = use(V2ActionsContext);
  if (!value) throw new Error("useV2Actions must be used within V2Provider");
  return value;
};
