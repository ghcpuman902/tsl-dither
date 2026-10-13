"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import {
  BitComboLegend,
  OklabVolumeDiagram,
  RgbCubeDiagram,
} from "@/components/color-lab/Diagrams";
import {
  ExperimentFrame,
  FloatRangeSlider,
  FloatSlider,
  SelectControl,
  ToggleControl,
} from "@/components/color-lab/ExperimentFrame";
import { PaletteStrip, PixelCanvas } from "@/components/color-lab/PixelCanvas";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { compressedCubeLevels } from "@/lib/color-lab/experiments/compressed-rgb";
import { processCompressedRgb } from "@/lib/color-lab/experiments/compressed-rgb";
import { processGifIndexed } from "@/lib/color-lab/experiments/gif-indexed";
import {
  noiseFieldsPreview,
  processNoiseFrequency,
} from "@/lib/color-lab/experiments/noise-frequency";
import { processOklabCube } from "@/lib/color-lab/experiments/oklab-cube";
import {
  probeMixturePixel,
  processPaletteMixture,
} from "@/lib/color-lab/experiments/palette-mixture";
import { processRgbBitplane } from "@/lib/color-lab/experiments/rgb-bitplane";
import { computePaletteStats, extractCrop } from "@/lib/color-lab/image-utils";
import {
  DEFAULT_LAB_PARAMS,
  LAB_PRESETS,
  type LabParamsBundle,
  type PresetId,
} from "@/lib/color-lab/presets";
import { EXPERIMENT_META, IMPLEMENTED_IDS, metaById } from "@/lib/color-lab/registry";
import {
  COLOR_LAB_SOURCES,
  imageDataFromFile,
  loadSourceImage,
} from "@/lib/color-lab/sources";
import type {
  CropRect,
  ExperimentId,
  ProcessResult,
  SourceSpec,
} from "@/lib/color-lab/types";
import { DEFAULT_CROP, WORKING_LONG_EDGE } from "@/lib/color-lab/types";

const NOISE_KIND_OPTIONS = [
  { value: "white", label: "White noise" },
  { value: "blue-approx", label: "Blue-approx" },
  { value: "ordered", label: "Ordered (Bayer)" },
  { value: "scaled", label: "Scaled-up" },
  { value: "blurred", label: "Blurred" },
];

const CORRELATION_OPTIONS = [
  { value: "independent", label: "Independent" },
  { value: "partial", label: "Partial" },
  { value: "shared", label: "Shared" },
];

type TabId = ExperimentId | "source" | "compare";

const processExperiment = (
  id: ExperimentId,
  source: ImageData,
  params: LabParamsBundle,
): ProcessResult | null => {
  switch (id) {
    case "rgb-bitplane":
      return processRgbBitplane(source, params.rgbBitplane);
    case "compressed-rgb":
      return processCompressedRgb(source, params.compressedRgb);
    case "oklab-cube":
      return processOklabCube(source, params.oklabCube);
    case "gif-indexed":
      return processGifIndexed(source, params.gifIndexed);
    case "palette-mixture":
      return processPaletteMixture(source, params.paletteMixture);
    case "noise-frequency":
      return processNoiseFrequency(source, params.noiseFrequency);
    default:
      return null;
  }
};

export const ColorLab = () => {
  const [sourceId, setSourceId] = useState("landscape");
  const [upload, setUpload] = useState<ImageData | null>(null);
  const [source, setSource] = useState<ImageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>(DEFAULT_CROP);
  const [params, setParams] = useState<LabParamsBundle>(DEFAULT_LAB_PARAMS);
  const [pinned, setPinned] = useState<ExperimentId[]>([
    "rgb-bitplane",
    "compressed-rgb",
    "gif-indexed",
  ]);
  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null);
  const [tab, setTab] = useState<TabId>("rgb-bitplane");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const deferredParams = useDeferredValue(params);

  const sourceSpec: SourceSpec = useMemo(() => {
    if (sourceId === "upload") {
      return { id: "upload", kind: "upload", label: "Upload", src: null };
    }
    return (
      COLOR_LAB_SOURCES.find((s) => s.id === sourceId) ?? COLOR_LAB_SOURCES[1]
    );
  }, [sourceId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const img = await loadSourceImage(
          sourceSpec,
          WORKING_LONG_EDGE,
          upload,
        );
        if (!cancelled) {
          setSource(img);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceSpec, upload]);

  /** Only process the visible experiment — or pinned set on Compare. */
  const activeResult = useMemo(() => {
    if (!source) return null;
    if (tab === "source" || tab === "compare") return null;
    if (!IMPLEMENTED_IDS.includes(tab)) return null;
    return processExperiment(tab, source, deferredParams);
  }, [source, deferredParams, tab]);

  const pinnedResults = useMemo(() => {
    if (!source || tab !== "compare") return null;
    const out: Partial<Record<ExperimentId, ProcessResult>> = {};
    for (const id of pinned) {
      const result = processExperiment(id, source, deferredParams);
      if (result) out[id] = result;
    }
    return out;
  }, [source, deferredParams, tab, pinned]);

  const noisePreview = useMemo(() => {
    if (!source || tab !== "noise-frequency") return null;
    return noiseFieldsPreview(
      Math.min(96, source.width),
      Math.min(96, source.height),
      deferredParams.noiseFrequency,
    );
  }, [source, deferredParams.noiseFrequency, tab]);

  const mixtureProbe = useMemo(() => {
    if (!source || !probe || tab !== "palette-mixture") return null;
    return probeMixturePixel(
      source,
      deferredParams.paletteMixture,
      probe.x,
      probe.y,
    );
  }, [source, probe, deferredParams.paletteMixture, tab]);

  const handlePreset = (id: PresetId) => {
    const preset = LAB_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    startTransition(() => {
      setParams(preset.apply(params));
      setActivePreset(id);
    });
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await imageDataFromFile(file);
      setUpload(data);
      setSourceId("upload");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  const togglePin = (id: ExperimentId) => {
    setPinned((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const update = <K extends keyof LabParamsBundle>(
    key: K,
    patch: Partial<LabParamsBundle[K]>,
  ) => {
    startTransition(() => {
      setActivePreset(null);
      setParams((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
    });
  };

  const compressedLevels = compressedCubeLevels(
    params.compressedRgb.compression,
    params.compressedRgb.centre,
  );

  const handleTabChange = (value: string | number | null) => {
    if (value == null) return;
    setTab(String(value) as TabId);
  };

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <div className="mr-auto">
            <div className="flex items-baseline gap-3">
              <Link
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Apps
              </Link>
              <h1 className="text-base font-semibold tracking-tight md:text-lg">
                Color Lab
              </h1>
              {isPending ? (
                <span className="text-[10px] text-muted-foreground">…</span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              One experiment at a time — pin results to compare.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Source image"
          >
            {COLOR_LAB_SOURCES.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="xs"
                variant={sourceId === s.id ? "default" : "outline"}
                onClick={() => setSourceId(s.id)}
                aria-pressed={sourceId === s.id}
              >
                {s.label}
              </Button>
            ))}
            <Button
              type="button"
              size="xs"
              variant={sourceId === "upload" ? "default" : "outline"}
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 border-t border-border/40 px-4 py-2 md:px-6">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Presets
          </span>
          {LAB_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="xs"
              variant={activePreset === p.id ? "default" : "ghost"}
              onClick={() => handlePreset(p.id)}
              title={p.description}
              aria-label={p.label}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        {loadError ? (
          <p className="mb-3 text-sm text-destructive">{loadError}</p>
        ) : null}

        <Tabs value={tab} onValueChange={handleTabChange} className="gap-4">
          <TabsList
            variant="line"
            className="h-auto w-full flex-wrap justify-start gap-1"
            aria-label="Color Lab sections"
          >
            <TabsTrigger value="source" className="px-2.5 text-xs">
              Source
            </TabsTrigger>
            {EXPERIMENT_META.filter((e) => e.implemented).map((e) => (
              <TabsTrigger
                key={e.id}
                value={e.id}
                className="px-2.5 text-xs"
              >
                {e.short}
              </TabsTrigger>
            ))}
            <TabsTrigger value="compare" className="px-2.5 text-xs">
              Compare
              {pinned.length > 0 ? (
                <span className="ml-1 tabular-nums opacity-60">
                  {pinned.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="source" className="outline-none">
            {tab === "source" ? (
              <SourcePanel
                source={source}
                crop={crop}
                onCropChange={setCrop}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="rgb-bitplane" className="outline-none">
            {tab === "rgb-bitplane" ? (
              <>
                <ExperimentFrame
                  name={metaById("rgb-bitplane").name}
                  blurb={metaById("rgb-bitplane").blurb}
                  source={source}
                  result={activeResult}
                  crop={crop}
                  pinned={pinned.includes("rgb-bitplane")}
                  onTogglePin={() => togglePin("rgb-bitplane")}
                  diagram={
                    <div className="space-y-2">
                      <RgbCubeDiagram title="RGB cube corners" />
                      <BitComboLegend />
                    </div>
                  }
                  controls={
                    <>
                      <FloatSlider
                        label="Noise strength"
                        value={params.rgbBitplane.noiseStrength}
                        min={0}
                        max={1}
                        onChange={(v) =>
                          update("rgbBitplane", { noiseStrength: v })
                        }
                      />
                      <FloatSlider
                        label="Threshold"
                        value={params.rgbBitplane.threshold}
                        min={0}
                        max={1}
                        onChange={(v) =>
                          update("rgbBitplane", { threshold: v })
                        }
                      />
                      <FloatSlider
                        label="Frequency"
                        value={params.rgbBitplane.frequency}
                        min={0.05}
                        max={1}
                        onChange={(v) =>
                          update("rgbBitplane", { frequency: v })
                        }
                      />
                      <SelectControl
                        label="Noise"
                        value={params.rgbBitplane.noiseKind}
                        options={NOISE_KIND_OPTIONS}
                        onChange={(v) =>
                          update("rgbBitplane", {
                            noiseKind:
                              v as LabParamsBundle["rgbBitplane"]["noiseKind"],
                          })
                        }
                      />
                      <SelectControl
                        label="Channels"
                        value={params.rgbBitplane.correlation}
                        options={CORRELATION_OPTIONS}
                        onChange={(v) =>
                          update("rgbBitplane", {
                            correlation:
                              v as LabParamsBundle["rgbBitplane"]["correlation"],
                          })
                        }
                      />
                      <ToggleControl
                        label="Shared seed"
                        checked={params.rgbBitplane.sharedSeed}
                        onChange={(v) =>
                          update("rgbBitplane", { sharedSeed: v })
                        }
                      />
                      <ToggleControl
                        label="Preserve B/W"
                        checked={params.rgbBitplane.preserveBw}
                        onChange={(v) =>
                          update("rgbBitplane", { preserveBw: v })
                        }
                      />
                    </>
                  }
                />
                <CompactCropBar
                  source={source}
                  crop={crop}
                  onCropChange={setCrop}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="compressed-rgb" className="outline-none">
            {tab === "compressed-rgb" ? (
              <>
                <ExperimentFrame
                  name={metaById("compressed-rgb").name}
                  blurb={metaById("compressed-rgb").blurb}
                  source={source}
                  result={activeResult}
                  crop={crop}
                  pinned={pinned.includes("compressed-rgb")}
                  onTogglePin={() => togglePin("compressed-rgb")}
                  diagram={
                    <RgbCubeDiagram
                      low={compressedLevels.low}
                      high={compressedLevels.high}
                      title="Compressed cube"
                    />
                  }
                  controls={
                    <>
                      <FloatSlider
                        label="Compression"
                        value={params.compressedRgb.compression}
                        min={0}
                        max={0.9}
                        onChange={(v) =>
                          update("compressedRgb", { compression: v })
                        }
                      />
                      <FloatSlider
                        label="Centre"
                        value={params.compressedRgb.centre}
                        min={0.15}
                        max={0.85}
                        onChange={(v) =>
                          update("compressedRgb", { centre: v })
                        }
                      />
                      <FloatSlider
                        label="Chroma limit"
                        value={params.compressedRgb.chromaLimit}
                        min={0}
                        max={1}
                        onChange={(v) =>
                          update("compressedRgb", { chromaLimit: v })
                        }
                      />
                      <FloatSlider
                        label="Noise strength"
                        value={params.compressedRgb.noiseStrength}
                        min={0}
                        max={1}
                        onChange={(v) =>
                          update("compressedRgb", { noiseStrength: v })
                        }
                      />
                      <ToggleControl
                        label="Preserve B/W"
                        checked={params.compressedRgb.preserveBw}
                        onChange={(v) =>
                          update("compressedRgb", { preserveBw: v })
                        }
                      />
                    </>
                  }
                />
                <CompactCropBar
                  source={source}
                  crop={crop}
                  onCropChange={setCrop}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="oklab-cube" className="outline-none">
            {tab === "oklab-cube" ? (
              <>
                <ExperimentFrame
                  name={metaById("oklab-cube").name}
                  blurb={metaById("oklab-cube").blurb}
                  source={source}
                  result={activeResult}
                  crop={crop}
                  pinned={pinned.includes("oklab-cube")}
                  onTogglePin={() => togglePin("oklab-cube")}
                  diagram={
                    activeResult ? (
                      <OklabVolumeDiagram colors={activeResult.palette} />
                    ) : null
                  }
                  controls={
                    <>
                      <FloatRangeSlider
                        label="Lightness L"
                        low={params.oklabCube.lLow}
                        high={params.oklabCube.lHigh}
                        min={0}
                        max={1}
                        step={0.01}
                        resetValue={[0.15, 0.88]}
                        onChange={(lLow, lHigh) =>
                          update("oklabCube", { lLow, lHigh })
                        }
                      />
                      <FloatSlider
                        label="a amp"
                        value={params.oklabCube.aAmp}
                        min={0.01}
                        max={0.2}
                        step={0.005}
                        resetValue={0.08}
                        format={(v) => v.toFixed(3)}
                        onChange={(v) => update("oklabCube", { aAmp: v })}
                      />
                      <FloatSlider
                        label="b amp"
                        value={params.oklabCube.bAmp}
                        min={0.01}
                        max={0.2}
                        step={0.005}
                        resetValue={0.08}
                        format={(v) => v.toFixed(3)}
                        onChange={(v) => update("oklabCube", { bAmp: v })}
                      />
                      <FloatSlider
                        label="Chroma ×"
                        value={params.oklabCube.chromaConstraint}
                        min={0}
                        max={1}
                        resetValue={1}
                        onChange={(v) =>
                          update("oklabCube", { chromaConstraint: v })
                        }
                      />
                      <ToggleControl
                        label="Preserve L"
                        checked={params.oklabCube.preserveSourceL}
                        onChange={(v) =>
                          update("oklabCube", { preserveSourceL: v })
                        }
                      />
                      <ToggleControl
                        label="Scale by source C"
                        checked={params.oklabCube.scaleChromaBySource}
                        onChange={(v) =>
                          update("oklabCube", { scaleChromaBySource: v })
                        }
                      />
                    </>
                  }
                />
                <CompactCropBar
                  source={source}
                  crop={crop}
                  onCropChange={setCrop}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="gif-indexed" className="outline-none">
            {tab === "gif-indexed" ? (
              <>
                <ExperimentFrame
                  name={metaById("gif-indexed").name}
                  blurb={metaById("gif-indexed").blurb}
                  source={source}
                  result={activeResult}
                  crop={crop}
                  pinned={pinned.includes("gif-indexed")}
                  onTogglePin={() => togglePin("gif-indexed")}
                  diagram={
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      GIF stores an indexed palette (≤256). Encoders cluster
                      colours; dithering picks nearby entries — not three
                      independent 1-bit RGB channels.
                    </p>
                  }
                  controls={
                    <>
                      <SelectControl
                        label="Palette size"
                        value={String(params.gifIndexed.paletteSize)}
                        options={[2, 4, 8, 16, 32, 256].map((n) => ({
                          value: String(n),
                          label: String(n),
                        }))}
                        onChange={(v) =>
                          update("gifIndexed", {
                            paletteSize: Number(v) as
                              | 2
                              | 4
                              | 8
                              | 16
                              | 32
                              | 256,
                          })
                        }
                      />
                      <SelectControl
                        label="Dither"
                        value={params.gifIndexed.dither}
                        options={[
                          { value: "nearest", label: "Nearest" },
                          { value: "ordered", label: "Ordered" },
                          { value: "noise", label: "Noise" },
                          {
                            value: "error-diffusion",
                            label: "Error diffusion",
                          },
                        ]}
                        onChange={(v) =>
                          update("gifIndexed", {
                            dither:
                              v as LabParamsBundle["gifIndexed"]["dither"],
                          })
                        }
                      />
                      <FloatSlider
                        label="Strength"
                        value={params.gifIndexed.noiseStrength}
                        min={0}
                        max={1}
                        onChange={(v) =>
                          update("gifIndexed", { noiseStrength: v })
                        }
                      />
                    </>
                  }
                />
                <CompactCropBar
                  source={source}
                  crop={crop}
                  onCropChange={setCrop}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="palette-mixture" className="outline-none">
            {tab === "palette-mixture" ? (
              <>
                <ExperimentFrame
                  name={metaById("palette-mixture").name}
                  blurb={metaById("palette-mixture").blurb}
                  source={source}
                  result={activeResult}
                  crop={crop}
                  pinned={pinned.includes("palette-mixture")}
                  onTogglePin={() => togglePin("palette-mixture")}
                  onResultPixelClick={(x, y) => setProbe({ x, y })}
                  diagram={
                    <div className="space-y-2 text-[11px] text-muted-foreground">
                      <p>Click the processed image to probe a pixel.</p>
                      {mixtureProbe ? (
                        <div className="space-y-1.5 rounded border border-border p-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-4 border border-border"
                              style={{
                                backgroundColor: `rgb(${mixtureProbe.source.join(",")})`,
                              }}
                            />
                            <span>source</span>
                            <span
                              className="size-4 border border-border"
                              style={{
                                backgroundColor: `rgb(${mixtureProbe.selectedColor.join(",")})`,
                              }}
                            />
                            <span>selected</span>
                          </div>
                          <div className="tabular-nums">
                            noise {mixtureProbe.noise.toFixed(3)}
                          </div>
                          {mixtureProbe.indices.map((idx, i) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span
                                className="size-3 border border-border"
                                style={{
                                  backgroundColor: `rgb(${mixtureProbe.palette[idx].join(",")})`,
                                }}
                              />
                              <span>
                                w={mixtureProbe.weights[i].toFixed(2)} · #{idx}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  }
                  controls={
                    <>
                      <SelectControl
                        label="Palette"
                        value={params.paletteMixture.paletteSource}
                        options={[
                          { value: "rgb8", label: "RGB8 corners" },
                          { value: "image-8", label: "Image median-cut 8" },
                        ]}
                        onChange={(v) =>
                          update("paletteMixture", {
                            paletteSource:
                              v as LabParamsBundle["paletteMixture"]["paletteSource"],
                          })
                        }
                      />
                      <SelectControl
                        label="Mixture"
                        value={params.paletteMixture.mode}
                        options={[
                          { value: "nearest", label: "Nearest" },
                          { value: "two", label: "2-colour" },
                          { value: "four", label: "4-colour" },
                        ]}
                        onChange={(v) =>
                          update("paletteMixture", {
                            mode: v as LabParamsBundle["paletteMixture"]["mode"],
                          })
                        }
                      />
                      <SelectControl
                        label="Noise"
                        value={params.paletteMixture.noiseKind}
                        options={NOISE_KIND_OPTIONS}
                        onChange={(v) =>
                          update("paletteMixture", {
                            noiseKind:
                              v as LabParamsBundle["paletteMixture"]["noiseKind"],
                          })
                        }
                      />
                      <FloatSlider
                        label="Frequency"
                        value={params.paletteMixture.frequency}
                        min={0.05}
                        max={1}
                        onChange={(v) =>
                          update("paletteMixture", { frequency: v })
                        }
                      />
                      <ToggleControl
                        label="Error diffusion"
                        checked={params.paletteMixture.useErrorDiffusion}
                        onChange={(v) =>
                          update("paletteMixture", { useErrorDiffusion: v })
                        }
                      />
                    </>
                  }
                />
                <CompactCropBar
                  source={source}
                  crop={crop}
                  onCropChange={setCrop}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="noise-frequency" className="outline-none">
            {tab === "noise-frequency" ? (
              <>
                <ExperimentFrame
                  name={metaById("noise-frequency").name}
                  blurb={metaById("noise-frequency").blurb}
                  source={source}
                  result={activeResult}
                  crop={crop}
                  pinned={pinned.includes("noise-frequency")}
                  onTogglePin={() => togglePin("noise-frequency")}
                  diagram={
                    noisePreview ? (
                      <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">
                          R · G · B · tint
                        </p>
                        <PixelCanvas
                          rgba={noisePreview.data}
                          width={noisePreview.width}
                          height={noisePreview.height}
                          pixelated
                          label="Noise fields"
                        />
                      </div>
                    ) : null
                  }
                  controls={
                    <>
                      <SelectControl
                        label="Noise"
                        value={params.noiseFrequency.noiseKind}
                        options={NOISE_KIND_OPTIONS}
                        onChange={(v) =>
                          update("noiseFrequency", {
                            noiseKind:
                              v as LabParamsBundle["noiseFrequency"]["noiseKind"],
                          })
                        }
                      />
                      <SelectControl
                        label="Correlation"
                        value={params.noiseFrequency.correlation}
                        options={CORRELATION_OPTIONS}
                        onChange={(v) =>
                          update("noiseFrequency", {
                            correlation:
                              v as LabParamsBundle["noiseFrequency"]["correlation"],
                          })
                        }
                      />
                      <FloatSlider
                        label="Luma freq"
                        value={params.noiseFrequency.lumaFrequency}
                        min={0.05}
                        max={1}
                        onChange={(v) =>
                          update("noiseFrequency", { lumaFrequency: v })
                        }
                      />
                      <FloatSlider
                        label="Chroma freq"
                        value={params.noiseFrequency.chromaFrequency}
                        min={0.05}
                        max={1}
                        onChange={(v) =>
                          update("noiseFrequency", { chromaFrequency: v })
                        }
                      />
                      <FloatSlider
                        label="Strength"
                        value={params.noiseFrequency.noiseStrength}
                        min={0}
                        max={1}
                        onChange={(v) =>
                          update("noiseFrequency", { noiseStrength: v })
                        }
                      />
                      <ToggleControl
                        label="Split L / C"
                        checked={params.noiseFrequency.splitLumaChroma}
                        onChange={(v) =>
                          update("noiseFrequency", { splitLumaChroma: v })
                        }
                      />
                    </>
                  }
                />
                <CompactCropBar
                  source={source}
                  crop={crop}
                  onCropChange={setCrop}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="compare" className="outline-none">
            {tab === "compare" ? (
              <ComparisonSection
                pinned={pinned}
                results={pinnedResults}
                source={source}
                crop={crop}
                onCropChange={setCrop}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

const SourcePanel = ({
  source,
  crop,
  onCropChange,
}: {
  source: ImageData | null;
  crop: CropRect;
  onCropChange: (c: CropRect) => void;
}) => (
  <section className="grid gap-6 py-2 lg:grid-cols-[1fr_14rem]">
    <div>
      <h2 className="mb-1 text-sm font-medium">Shared source</h2>
      <p className="mb-3 max-w-xl text-xs text-muted-foreground">
        Drag to move the magnifier crop used by every experiment.
      </p>
      {source ? (
        <CropSource source={source} crop={crop} onCropChange={onCropChange} />
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Loading source…
        </div>
      )}
    </div>
    <aside className="space-y-2 text-xs text-muted-foreground">
      <p>
        Core question: does the harsh magenta/green sparkle come from the RGB
        cube corners, the quantiser, or the spatial noise?
      </p>
      <p>Open an experiment tab to process — only that method runs.</p>
    </aside>
  </section>
);

const CompactCropBar = ({
  source,
  crop,
  onCropChange,
}: {
  source: ImageData | null;
  crop: CropRect;
  onCropChange: (c: CropRect) => void;
}) => {
  if (!source) return null;
  const cropPx = extractCrop(source.data, source.width, source.height, crop);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
      <span className="text-[11px] text-muted-foreground">Shared crop</span>
      <div className="size-14 overflow-hidden border border-border">
        <PixelCanvas
          rgba={cropPx.rgba}
          width={cropPx.size}
          height={cropPx.size}
          pixelated
          label="Crop"
        />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
        Zoom
        <input
          type="range"
          min={0.04}
          max={0.35}
          step={0.01}
          value={crop.half}
          onChange={(e) =>
            onCropChange({ ...crop, half: Number(e.target.value) })
          }
          className="w-28"
          aria-label="Crop zoom"
        />
      </label>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => onCropChange(DEFAULT_CROP)}
      >
        Reset crop
      </Button>
    </div>
  );
};

const CropSource = ({
  source,
  crop,
  onCropChange,
}: {
  source: ImageData;
  crop: CropRect;
  onCropChange: (c: CropRect) => void;
}) => {
  const dragging = useRef(false);

  const handlePointer = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const cx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const cy = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onCropChange({ ...crop, cx, cy });
  };

  const cropPx = extractCrop(source.data, source.width, source.height, crop);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
      <div
        className="relative max-w-lg cursor-crosshair overflow-hidden border border-border"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          handlePointer(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          handlePointer(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        role="application"
        aria-label="Source image — drag to move crop"
        tabIndex={0}
      >
        <PixelCanvas
          rgba={source.data}
          width={source.width}
          height={source.height}
          label="Shared source"
        />
        <div
          className="pointer-events-none absolute border border-foreground/80"
          style={{
            left: `${(crop.cx - crop.half * (Math.min(source.width, source.height) / source.width)) * 100}%`,
            top: `${(crop.cy - crop.half * (Math.min(source.width, source.height) / source.height)) * 100}%`,
            width: `${crop.half * 2 * (Math.min(source.width, source.height) / source.width) * 100}%`,
            height: `${crop.half * 2 * (Math.min(source.width, source.height) / source.height) * 100}%`,
          }}
        />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Crop preview</p>
        <PixelCanvas
          rgba={cropPx.rgba}
          width={cropPx.size}
          height={cropPx.size}
          pixelated
          label="Crop"
        />
        <label className="mt-2 block text-[11px] text-muted-foreground">
          Zoom
          <input
            type="range"
            min={0.04}
            max={0.35}
            step={0.01}
            value={crop.half}
            onChange={(e) =>
              onCropChange({ ...crop, half: Number(e.target.value) })
            }
            className="mt-1 w-full"
            aria-label="Crop zoom"
          />
        </label>
      </div>
    </div>
  );
};

const ComparisonSection = ({
  pinned,
  results,
  source,
  crop,
  onCropChange,
}: {
  pinned: ExperimentId[];
  results: Partial<Record<ExperimentId, ProcessResult>> | null;
  source: ImageData | null;
  crop: CropRect;
  onCropChange: (c: CropRect) => void;
}) => {
  if (pinned.length === 0) {
    return (
      <section className="py-6">
        <h2 className="text-lg font-medium">Comparison</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pin 3–6 experiments from their tabs, then open Compare.
        </p>
      </section>
    );
  }

  return (
    <section className="py-2">
      <h2 className="mb-1 text-lg font-medium">Comparison</h2>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Metrics are guides — colour fidelity, palette coherence, texture and
        aesthetic character all matter. Processing only runs while this tab is
        open.
      </p>
      <CompactCropBar source={source} crop={crop} onCropChange={onCropChange} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pinned.map((id) => {
          const result = results?.[id];
          const meta = metaById(id);
          if (!result || !source) {
            return (
              <article key={id} className="border border-border p-3">
                <h3 className="text-sm font-medium">{meta.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground">Processing…</p>
              </article>
            );
          }
          const stats = computePaletteStats(source.data, result.rgba);
          const cropPx = extractCrop(
            result.rgba,
            result.width,
            result.height,
            crop,
          );
          const recon = result.reconstruction
            ? extractCrop(
                result.reconstruction,
                result.width,
                result.height,
                crop,
              )
            : null;
          return (
            <article key={id} className="min-w-0 border border-border p-3">
              <h3 className="text-sm font-medium">{meta.name}</h3>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <PixelCanvas
                  rgba={result.rgba}
                  width={result.width}
                  height={result.height}
                  label={meta.name}
                />
                <div className="grid gap-1">
                  <PixelCanvas
                    rgba={cropPx.rgba}
                    width={cropPx.size}
                    height={cropPx.size}
                    pixelated
                    label="Zoom"
                  />
                  {recon ? (
                    <PixelCanvas
                      rgba={recon.rgba}
                      width={recon.size}
                      height={recon.size}
                      pixelated
                      label="Reconstruction"
                    />
                  ) : null}
                </div>
              </div>
              <PaletteStrip colors={result.palette} className="mt-2" />
              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
                <dt>Colours</dt>
                <dd>{stats.uniqueCount}</dd>
                <dt>ΔL</dt>
                <dd>{stats.luminanceError.toFixed(3)}</dd>
                <dt>ΔE₀ₖ</dt>
                <dd>{stats.perceptualError.toFixed(3)}</dd>
                <dt>C̄</dt>
                <dd>{stats.averageChroma.toFixed(3)}</dd>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
};
