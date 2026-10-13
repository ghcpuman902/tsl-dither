"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { V2_SAMPLE_IMAGES } from "@/lib/v2/types";
import { Slider } from "@/components/ui/slider";
import {
  ADE20K_SKY_CLASS_ID,
  adeLabelName,
  summarizeClassMap,
  type AdeClassStat,
} from "@/lib/lab/ade20k-labels";
import {
  DEFAULT_MAX_LONG_EDGE,
  DEFAULT_SKY_REFINE,
  SkyDetector,
  compositeMaskedPreview,
  imageDataToObjectUrl,
  loadImageToCanvas,
  refineSkyMask,
  type SkyDetectDevice,
  type SkyDetectResult,
  type SkyRefineParams,
} from "@/lib/lab/sky-detector";

type RowStatus = "idle" | "running" | "done" | "error";

type RowState = {
  src: string;
  label: string;
  source: string;
  status: RowStatus;
  error?: string;
  originalUrl?: string;
  skyOnlyUrl?: string;
  nonSkyUrl?: string;
  rawSegUrl?: string;
  /** Top ADE20K classes in this image (hard argmax). */
  labelStats?: AdeClassStat[];
  /** Per-pixel class map for hover probe (kept on row so we don't read cacheRef in render). */
  classMap?: Uint16Array;
  meta?: {
    inferenceMs: number;
    width: number;
    height: number;
    inferWidth: number;
    inferHeight: number;
    logitWidth: number;
    logitHeight: number;
    skyPixels: number;
    device: SkyDetectDevice;
  };
};

type CachedDetect = {
  sourceRgba: Uint8ClampedArray;
  skyMargin: Float32Array;
  classMap: Uint16Array;
  colorSegRgba: Uint8ClampedArray;
  width: number;
  height: number;
  inferWidth: number;
  inferHeight: number;
  logitWidth: number;
  logitHeight: number;
  inferenceMs: number;
  device: SkyDetectDevice;
};

const buildInitialRows = (): RowState[] =>
  V2_SAMPLE_IMAGES.map((s) => ({
    src: s.src,
    label: s.label,
    source: s.source,
    status: "idle",
  }));

const countSky = (mask: Uint8ClampedArray): number => {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 127) n++;
  return n;
};

const toImageData = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): ImageData => {
  const copy = new Uint8ClampedArray(rgba.length);
  copy.set(rgba);
  return new ImageData(copy, width, height);
};

const urlsFromCache = (
  cached: CachedDetect,
  refine: SkyRefineParams,
): Pick<RowState, "skyOnlyUrl" | "nonSkyUrl" | "rawSegUrl"> & {
  skyPixels: number;
} => {
  const { sourceRgba, skyMargin, colorSegRgba, width, height } = cached;
  const skyMask = refineSkyMask(skyMargin, sourceRgba, width, height, refine);
  const skyOnly = compositeMaskedPreview(sourceRgba, skyMask, "sky");
  const nonSky = compositeMaskedPreview(sourceRgba, skyMask, "non-sky");
  return {
    skyOnlyUrl: imageDataToObjectUrl(toImageData(skyOnly, width, height)),
    nonSkyUrl: imageDataToObjectUrl(toImageData(nonSky, width, height)),
    rawSegUrl: imageDataToObjectUrl(toImageData(colorSegRgba, width, height)),
    skyPixels: countSky(skyMask),
  };
};

const cacheFromResult = (
  sourceRgba: Uint8ClampedArray,
  result: SkyDetectResult,
): CachedDetect => ({
  sourceRgba: new Uint8ClampedArray(sourceRgba),
  skyMargin: result.skyMargin,
  classMap: result.classMap,
  colorSegRgba: result.colorSegRgba,
  width: result.width,
  height: result.height,
  inferWidth: result.inferWidth,
  inferHeight: result.inferHeight,
  logitWidth: result.logitWidth,
  logitHeight: result.logitHeight,
  inferenceMs: result.inferenceMs,
  device: result.device,
});

/** Map pointer in an object-contain box to image pixel coords. */
const pointerToImagePixel = (
  clientX: number,
  clientY: number,
  box: DOMRect,
  imgW: number,
  imgH: number,
): { x: number; y: number } | null => {
  if (imgW <= 0 || imgH <= 0 || box.width <= 0 || box.height <= 0) return null;
  const scale = Math.min(box.width / imgW, box.height / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  const offX = (box.width - dispW) / 2;
  const offY = (box.height - dispH) / 2;
  const lx = clientX - box.left - offX;
  const ly = clientY - box.top - offY;
  if (lx < 0 || ly < 0 || lx >= dispW || ly >= dispH) return null;
  return {
    x: Math.min(imgW - 1, Math.max(0, Math.floor(lx / scale))),
    y: Math.min(imgH - 1, Math.max(0, Math.floor(ly / scale))),
  };
};

export const SkyDetectLab = () => {
  const detectorRef = useRef<SkyDetector | null>(null);
  const cacheRef = useRef<Map<string, CachedDetect>>(new Map());
  const [rows, setRows] = useState<RowState[]>(buildInitialRows);
  const [initStatus, setInitStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("loading");
  const [initError, setInitError] = useState<string | null>(null);
  const [webGpuError, setWebGpuError] = useState<string | null>(null);
  const [device, setDevice] = useState<SkyDetectDevice | null>(null);
  const [maxLongEdge, setMaxLongEdge] = useState(DEFAULT_MAX_LONG_EDGE);
  const [refine, setRefine] = useState<SkyRefineParams>(DEFAULT_SKY_REFINE);
  const [runningAll, setRunningAll] = useState(false);
  const cancelledRef = useRef(false);
  const refineRef = useRef(refine);

  useEffect(() => {
    refineRef.current = refine;
  }, [refine]);

  useEffect(() => {
    cancelledRef.current = false;
    const detector = new SkyDetector();
    detectorRef.current = detector;

    void (async () => {
      try {
        const active = await detector.initialize();
        if (cancelledRef.current) return;
        setDevice(active);
        setWebGpuError(detector.lastWebGpuError);
        setInitStatus("ready");
      } catch (err) {
        if (cancelledRef.current) return;
        setInitStatus("error");
        setInitError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelledRef.current = true;
      detectorRef.current = null;
    };
  }, []);

  const applyRefine = (next: SkyRefineParams) => {
    setRefine(next);
    refineRef.current = next;
    if (cacheRef.current.size === 0) return;
    setRows((prev) =>
      prev.map((row) => {
        const cached = cacheRef.current.get(row.src);
        if (!cached || row.status !== "done") return row;
        const urls = urlsFromCache(cached, next);
        return {
          ...row,
          skyOnlyUrl: urls.skyOnlyUrl,
          nonSkyUrl: urls.nonSkyUrl,
          rawSegUrl: urls.rawSegUrl,
          meta: row.meta
            ? { ...row.meta, skyPixels: urls.skyPixels }
            : row.meta,
        };
      }),
    );
  };

  const updateRow = (src: string, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.src === src ? { ...r, ...patch } : r)));
  };

  const runOne = async (src: string): Promise<void> => {
    const detector = detectorRef.current;
    if (!detector) throw new Error("Detector not ready");
    if (initStatus !== "ready") throw new Error("Model still loading");

    updateRow(src, { status: "running", error: undefined });

    try {
      const canvas = await loadImageToCanvas(src);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("2D context unavailable");
      const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const originalUrl = imageDataToObjectUrl(source);

      const result = await detector.generateSkyMask(canvas, { maxLongEdge });
      const cached = cacheFromResult(source.data, result);
      cacheRef.current.set(src, cached);
      const urls = urlsFromCache(cached, refineRef.current);
      const labelStats = summarizeClassMap(result.classMap);

      updateRow(src, {
        status: "done",
        originalUrl,
        skyOnlyUrl: urls.skyOnlyUrl,
        nonSkyUrl: urls.nonSkyUrl,
        rawSegUrl: urls.rawSegUrl,
        labelStats,
        classMap: result.classMap,
        meta: {
          inferenceMs: result.inferenceMs,
          width: result.width,
          height: result.height,
          inferWidth: result.inferWidth,
          inferHeight: result.inferHeight,
          logitWidth: result.logitWidth,
          logitHeight: result.logitHeight,
          skyPixels: urls.skyPixels,
          device: result.device,
        },
      });
    } catch (err) {
      updateRow(src, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleRunAll = async () => {
    if (initStatus !== "ready" || runningAll) return;
    setRunningAll(true);
    try {
      for (const row of rows) {
        if (cancelledRef.current) break;
        await runOne(row.src);
      }
    } finally {
      setRunningAll(false);
    }
  };

  const handleRunOne = (src: string) => {
    if (initStatus !== "ready" || runningAll) return;
    void runOne(src);
  };

  const handleIncludeMore = (value: number[]) => {
    applyRefine({ ...refineRef.current, includeMore: value[0] ?? 0 });
  };

  const handleBrightFill = (value: number[]) => {
    applyRefine({ ...refineRef.current, brightFill: value[0] ?? 0 });
  };

  const handleResetRefine = () => {
    applyRefine(DEFAULT_SKY_REFINE);
  };

  return (
    <main className="min-h-svh bg-background px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sky detect lab
            </h1>
            <Link
              href="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={0}
              aria-label="Back to home"
            >
              Home
            </Link>
          </div>
          <p className="max-w-3xl text-muted-foreground">
            Native-resolution SegFormer-B0 ADE20K via onnxruntime-web. Sliders
            refine the mask from cached scores — no re-inference (pull in
            near-miss sky / fill bright sunset clouds).
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <StatusPill status={initStatus} device={device} error={initError} />
            <label className="flex items-center gap-2 text-foreground">
              <span className="text-muted-foreground">Max long edge</span>
              <input
                type="number"
                min={256}
                max={2048}
                step={16}
                name="maxLongEdge"
                id="maxLongEdge"
                value={maxLongEdge}
                onChange={(e) =>
                  setMaxLongEdge(
                    Math.max(256, Math.min(2048, Number(e.target.value) || 256)),
                  )
                }
                className="w-24 rounded-md border border-border bg-background px-2 py-1"
                aria-label="Maximum long edge for inference"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleRunAll()}
              disabled={initStatus !== "ready" || runningAll}
              className="rounded-md border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Run sky detection on all samples"
            >
              {runningAll ? "Running…" : "Run all samples"}
            </button>
          </div>

          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <RefineSlider
              id="includeMore"
              label="Include more"
              hint="Pull in weak / near-miss sky"
              value={refine.includeMore}
              onValueChange={handleIncludeMore}
            />
            <RefineSlider
              id="brightFill"
              label="Bright fill"
              hint="Flood bright / near-miss blobs connected to sky"
              value={refine.brightFill}
              onValueChange={handleBrightFill}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={handleResetRefine}
              className="rounded-md border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Reset sky refine sliders"
            >
              Reset refine
            </button>
            <span className="text-muted-foreground">
              Double-click a slider thumb to zero it. Adjust after Run — updates
              all finished rows instantly.
            </span>
          </div>

          {webGpuError && device === "wasm" ? (
            <p className="text-sm text-muted-foreground" role="status">
              WebGPU unavailable — using WASM. ({webGpuError})
            </p>
          ) : null}
          {initError ? (
            <p className="text-sm text-destructive" role="alert">
              {initError}
            </p>
          ) : null}
        </header>

        <div className="flex flex-col gap-10">
          {rows.map((row) => (
            <SampleRow
              key={row.src}
              row={row}
              busy={runningAll || initStatus !== "ready"}
              onRun={() => handleRunOne(row.src)}
            />
          ))}
        </div>
      </div>
    </main>
  );
};

const RefineSlider = ({
  id,
  label,
  hint,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onValueChange: (value: number[]) => void;
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
      <span className="tabular-nums text-sm text-muted-foreground">{value}</span>
    </div>
    <Slider
      id={id}
      min={0}
      max={100}
      step={1}
      value={[value]}
      resetValue={0}
      onValueChange={onValueChange}
      aria-label={label}
    />
    <p className="text-xs text-muted-foreground">{hint}</p>
  </div>
);

const StatusPill = ({
  status,
  device,
  error,
}: {
  status: "idle" | "loading" | "ready" | "error";
  device: SkyDetectDevice | null;
  error: string | null;
}) => {
  const label =
    status === "loading"
      ? "Loading ONNX model…"
      : status === "ready"
        ? `Ready (${device ?? "?"})`
        : status === "error"
          ? "Init failed"
          : "Idle";
  return (
    <span
      className="rounded-md border border-border px-2 py-1 text-foreground"
      title={error ?? undefined}
      aria-live="polite"
    >
      {label}
    </span>
  );
};

const SampleRow = ({
  row,
  busy,
  onRun,
}: {
  row: RowState;
  busy: boolean;
  onRun: () => void;
}) => {
  const skyPct =
    row.meta && row.meta.width * row.meta.height > 0
      ? (
          (100 * row.meta.skyPixels) /
          (row.meta.width * row.meta.height)
        ).toFixed(1)
      : null;

  return (
    <section className="flex flex-col gap-3" aria-label={row.label}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-medium text-foreground">{row.label}</h2>
          <p className="text-sm text-muted-foreground">{row.source}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {row.meta ? (
            <span className="text-muted-foreground">
              {row.meta.width}×{row.meta.height} → infer{" "}
              {row.meta.inferWidth}×{row.meta.inferHeight} → logits{" "}
              {row.meta.logitWidth}×{row.meta.logitHeight} ·{" "}
              {row.meta.inferenceMs.toFixed(0)}ms · sky {skyPct}% ·{" "}
              {row.meta.device}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRun}
            disabled={busy || row.status === "running"}
            className="rounded-md border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Run sky detection on ${row.label}`}
          >
            {row.status === "running" ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {row.status === "error" && row.error ? (
        <p className="text-sm text-destructive" role="alert">
          {row.error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <PreviewCell
          title="Original"
          src={row.originalUrl ?? row.src}
          alt={`${row.label} original`}
        />
        <PreviewCell
          title="Sky only"
          src={row.skyOnlyUrl}
          alt={`${row.label} sky only`}
          placeholder={row.status === "running" ? "Inferring…" : "Run to see"}
        />
        <PreviewCell
          title="Non-sky only"
          src={row.nonSkyUrl}
          alt={`${row.label} non-sky only`}
          placeholder={row.status === "running" ? "Inferring…" : "Run to see"}
        />
        <SegPreviewCell
          title="Raw seg (ADE20K)"
          src={row.rawSegUrl}
          alt={`${row.label} raw segmentation`}
          placeholder={row.status === "running" ? "Inferring…" : "Run to see"}
          classMap={row.classMap}
          width={row.meta?.width}
          height={row.meta?.height}
        />
      </div>

      {row.labelStats && row.labelStats.length > 0 ? (
        <ClassLegend stats={row.labelStats} />
      ) : null}
    </section>
  );
};

const ClassLegend = ({ stats }: { stats: AdeClassStat[] }) => (
  <div className="flex flex-col gap-1.5" aria-label="ADE20K class legend">
    <p className="text-xs text-muted-foreground">
      ADE20K labels in this image (hover raw seg to probe a pixel)
    </p>
    <ul className="flex flex-wrap gap-1.5">
      {stats.map((stat) => {
        const isSky = stat.id === ADE20K_SKY_CLASS_ID;
        return (
          <li key={stat.id}>
            <span
              className={
                isSky
                  ? "inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-foreground"
                  : "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground"
              }
              title={`id ${stat.id} · ${stat.pixels.toLocaleString()} px`}
            >
              <span
                className="size-2.5 shrink-0 rounded-sm border border-border"
                style={{
                  backgroundColor: `rgb(${stat.rgb[0]}, ${stat.rgb[1]}, ${stat.rgb[2]})`,
                }}
                aria-hidden
              />
              <span>{stat.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {stat.pct.toFixed(1)}%
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);

const PreviewCell = ({
  title,
  src,
  alt,
  placeholder,
}: {
  title: string;
  src?: string;
  alt: string;
  placeholder?: string;
}) => (
  <figure className="flex flex-col gap-1.5">
    <figcaption className="text-xs text-muted-foreground">{title}</figcaption>
    <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- lab preview of canvas data URLs
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
          {placeholder ?? "—"}
        </div>
      )}
    </div>
  </figure>
);

const SegPreviewCell = ({
  title,
  src,
  alt,
  placeholder,
  classMap,
  width,
  height,
}: {
  title: string;
  src?: string;
  alt: string;
  placeholder?: string;
  classMap?: Uint16Array;
  width?: number;
  height?: number;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [probe, setProbe] = useState<{
    name: string;
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!classMap || !width || !height || !boxRef.current) {
      setProbe(null);
      return;
    }
    const pixel = pointerToImagePixel(
      e.clientX,
      e.clientY,
      boxRef.current.getBoundingClientRect(),
      width,
      height,
    );
    if (!pixel) {
      setProbe(null);
      return;
    }
    const id = classMap[pixel.y * width + pixel.x] ?? 0;
    setProbe({ name: adeLabelName(id), id, x: pixel.x, y: pixel.y });
  };

  const handlePointerLeave = () => {
    setProbe(null);
  };

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>{title}</span>
        {probe ? (
          <span className="truncate tabular-nums text-foreground" aria-live="polite">
            {probe.name}{" "}
            <span className="text-muted-foreground">
              #{probe.id} · {probe.x},{probe.y}
            </span>
          </span>
        ) : src && classMap ? (
          <span>hover to label</span>
        ) : null}
      </figcaption>
      <div
        ref={boxRef}
        className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- lab preview of canvas data URLs
          <img
            src={src}
            alt={alt}
            className="pointer-events-none h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
            {placeholder ?? "—"}
          </div>
        )}
      </div>
    </figure>
  );
};
