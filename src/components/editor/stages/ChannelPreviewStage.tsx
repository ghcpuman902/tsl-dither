"use client";

import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";

type Props = {
  processedImageData: ImageData | null;
};

type ChannelKind = "rgb" | "r" | "g" | "b";

const CHANNEL_CELLS: { kind: ChannelKind; label: string }[] = [
  { kind: "rgb", label: "RGB" },
  { kind: "r", label: "R" },
  { kind: "g", label: "G" },
  { kind: "b", label: "B" },
];

const MAX_PREVIEW = 128;

const drawChannel = (
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  kind: ChannelKind
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height, data } = imageData;
  const scale = Math.min(1, MAX_PREVIEW / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  canvas.width = w;
  canvas.height = h;

  const out = ctx.createImageData(w, h);
  const dst = out.data;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const sx = Math.floor((px / w) * width);
      const sy = Math.floor((py / h) * height);
      const si = (sy * width + sx) * 4;
      const di = (py * w + px) * 4;

      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      const a = data[si + 3];

      if (kind === "rgb") {
        dst[di] = r;
        dst[di + 1] = g;
        dst[di + 2] = b;
        dst[di + 3] = a;
      } else if (kind === "r") {
        dst[di] = r;
        dst[di + 1] = r;
        dst[di + 2] = r;
        dst[di + 3] = a;
      } else if (kind === "g") {
        dst[di] = g;
        dst[di + 1] = g;
        dst[di + 2] = g;
        dst[di + 3] = a;
      } else {
        dst[di] = b;
        dst[di + 1] = b;
        dst[di + 2] = b;
        dst[di + 3] = a;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
};

const ChannelCell = ({
  kind,
  label,
  imageData,
}: {
  kind: ChannelKind;
  label: string;
  imageData: ImageData | null;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    drawChannel(canvas, imageData, kind);
  }, [kind, imageData]);

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="aspect-square w-full overflow-hidden rounded-md border border-border bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          style={{ imageRendering: "auto" }}
          aria-label={`Channel ${label}`}
        />
      </div>
    </div>
  );
};

export const ChannelPreviewStage = ({ processedImageData }: Props) => {
  const emptyCells = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs text-muted-foreground">
        RGB and per-channel preview before export. Add controls here later.
      </p>
      <div
        className="grid grid-cols-4 gap-2"
        role="grid"
        aria-label="Channel preview grid"
      >
        {CHANNEL_CELLS.map(({ kind, label }) => (
          <div key={kind} className="min-h-0" role="gridcell">
            <ChannelCell
              kind={kind}
              label={label}
              imageData={processedImageData}
            />
          </div>
        ))}
        {emptyCells.map((i) => (
          <div
            key={`empty-${i}`}
            className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border bg-muted/30"
            role="gridcell"
            aria-label="Empty control slot"
          >
            <span className="text-xs text-muted-foreground/50">—</span>
          </div>
        ))}
      </div>
    </div>
  );
};
