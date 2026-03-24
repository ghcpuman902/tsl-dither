"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { usePipeline } from "@/lib/pipeline-context";
import { applyTone } from "@/lib/tone-processor";
import { PipelineOutputFitCanvas } from "@/components/editor/PipelineOutputFitCanvas";
import type { CanvasPreviewMode } from "@/lib/canvas-preview";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type ExportFormat = "png" | "jpeg" | "webp";

export const ExportStage = () => {
  const { state, pipelineOutput } = usePipeline();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(92);
  const [isExporting, setIsExporting] = useState(false);
  const [previewMode, setPreviewMode] = useState<CanvasPreviewMode>("fit");

  const handleExport = () => {
    setIsExporting(true);

    if (pipelineOutput) {
      const imageData = new ImageData(
        new Uint8ClampedArray(pipelineOutput.buffer),
        pipelineOutput.width,
        pipelineOutput.height
      );
      const canvas = document.createElement("canvas");
      canvas.width = pipelineOutput.width;
      canvas.height = pipelineOutput.height;
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(imageData, 0, 0);

      const mimeType = `image/${format}`;
      const qualityVal = format === "png" ? undefined : quality / 100;
      const dataUrl = canvas.toDataURL(mimeType, qualityVal);

      const link = document.createElement("a");
      link.download = `export.${format}`;
      link.href = dataUrl;
      link.click();

      setIsExporting(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const processed = applyTone(imageData, state.tone, state.toneVisible);
      ctx.putImageData(processed, 0, 0);

      const mimeType = `image/${format}`;
      const qualityVal = format === "png" ? undefined : quality / 100;
      const dataUrl = canvas.toDataURL(mimeType, qualityVal);

      const link = document.createElement("a");
      link.download = `export.${format}`;
      link.href = dataUrl;
      link.click();

      setIsExporting(false);
    };

    img.onerror = () => setIsExporting(false);
    img.src = state.sourceImageSrc;
  };

  const showQuality = format !== "png";

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Preview
        </Label>
        <div
          className="flex w-fit flex-wrap gap-1 rounded-lg border border-border p-1"
          role="tablist"
          aria-label="Export preview zoom mode"
        >
          {([
            { id: "fit", label: "Fit" },
            { id: "pixel-perfect", label: "1:1 px" },
          ] as const).map(({ id, label }) => {
            const selected = previewMode === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                aria-label={id === "fit" ? "Fit preview to panel" : "Show one source pixel per screen pixel"}
                onClick={() => setPreviewMode(id)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div
          className="aspect-square w-full overflow-hidden rounded-md border border-border bg-black"
          aria-label="What will be exported"
        >
          <PipelineOutputFitCanvas
            pipelineOutput={pipelineOutput}
            mode={previewMode}
            className="h-full w-full"
            aria-label="Export preview thumbnail"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {previewMode === "pixel-perfect"
            ? "1:1 mode maps one source pixel to one physical display pixel (retina-aware)."
            : "Fit mode uses high-quality downsampling to reduce moire in dense dither patterns."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Format
        </Label>
        <Select
          value={format}
          onValueChange={(v) => setFormat(v as ExportFormat)}
        >
          <SelectTrigger aria-label="Export format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">PNG — lossless</SelectItem>
            <SelectItem value="jpeg">JPEG — lossy</SelectItem>
            <SelectItem value="webp">WebP — lossy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showQuality && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Quality</Label>
            <span className="tabular-nums text-xs text-muted-foreground">
              {quality}%
            </span>
          </div>
          <Slider
            min={10}
            max={100}
            step={1}
            value={[quality]}
            onValueChange={(v) => setQuality(Array.isArray(v) ? v[0] : (v as number))}
            aria-label="Export quality"
          />
        </div>
      )}

      <Separator />

      <Button
        className="w-full gap-2"
        onClick={handleExport}
        disabled={isExporting}
        aria-label="Export processed image"
      >
        <Download className="h-4 w-4" />
        {isExporting ? "Exporting…" : "Export Image"}
      </Button>

      <p className="text-xs text-muted-foreground">
        {pipelineOutput
          ? "Exports what you see above: dithered RGB if you opened Dither, otherwise the latest Load/Tone preview."
          : "Load an image so the preview pipeline can produce a frame, then export."}
      </p>
    </div>
  );
};
