"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import type { Rgb } from "@/lib/color-lab/types";

type PixelCanvasProps = {
  rgba: Uint8ClampedArray | null;
  width: number;
  height: number;
  className?: string;
  /** CSS image-rendering for magnifiers. */
  pixelated?: boolean;
  label?: string;
  onClickPixel?: (x: number, y: number) => void;
};

export const PixelCanvas = ({
  rgba,
  width,
  height,
  className,
  pixelated = false,
  label,
  onClickPixel,
}: PixelCanvasProps) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !rgba || width <= 0 || height <= 0) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      width,
      height,
    );
    ctx.putImageData(imageData, 0, 0);
  }, [rgba, width, height]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!onClickPixel || !rgba) return;
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * height);
    onClickPixel(
      Math.max(0, Math.min(width - 1, x)),
      Math.max(0, Math.min(height - 1, y)),
    );
  };

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label ?? "Processed image"}
      tabIndex={onClickPixel ? 0 : undefined}
      className={className}
      style={
        pixelated
          ? { imageRendering: "pixelated", width: "100%", height: "auto" }
          : { width: "100%", height: "auto" }
      }
      onClick={handleClick}
    />
  );
};

export const PaletteStrip = ({
  colors,
  highlight,
  onHover,
  className,
}: {
  colors: readonly Rgb[];
  highlight?: number | null;
  onHover?: (index: number | null) => void;
  className?: string;
}) => (
  <div
    className={`flex flex-wrap gap-1 ${className ?? ""}`}
    role="list"
    aria-label="Output palette"
  >
    {colors.map((c, i) => (
      <button
        key={`${c[0]}-${c[1]}-${c[2]}-${i}`}
        type="button"
        role="listitem"
        aria-label={`Colour ${i + 1}: rgb(${c[0]}, ${c[1]}, ${c[2]})`}
        tabIndex={0}
        className={`size-5 border transition-transform ${
          highlight === i
            ? "scale-125 border-foreground ring-1 ring-foreground"
            : "border-border"
        }`}
        style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
        onMouseEnter={() => onHover?.(i)}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(i)}
        onBlur={() => onHover?.(null)}
      />
    ))}
  </div>
);

export const ControlRow = ({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) => (
  <label className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <div>{children}</div>
    {value != null ? (
      <span className="tabular-nums text-muted-foreground">{value}</span>
    ) : (
      <span />
    )}
  </label>
);
