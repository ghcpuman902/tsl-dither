"use client";

import type { Rgb } from "@/lib/color-lab/types";

/** Isometric-ish RGB cube with eight corners. */
export const RgbCubeDiagram = ({
  low = 0,
  high = 255,
  highlight,
  title = "RGB cube",
}: {
  low?: number;
  high?: number;
  highlight?: Rgb | null;
  title?: string;
}) => {
  // Project cube: x→right, y→up, z→depth
  const project = (r: number, g: number, b: number) => {
    const rn = (r - low) / Math.max(1, high - low);
    const gn = (g - low) / Math.max(1, high - low);
    const bn = (b - low) / Math.max(1, high - low);
    const x = 70 + rn * 70 + bn * 36;
    const y = 110 - gn * 70 - bn * 28;
    return { x, y };
  };

  const corners: Rgb[] = [
    [low, low, low],
    [high, low, low],
    [low, high, low],
    [low, low, high],
    [high, high, low],
    [high, low, high],
    [low, high, high],
    [high, high, high],
  ];

  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [1, 5],
    [2, 4],
    [2, 6],
    [3, 5],
    [3, 6],
    [4, 7],
    [5, 7],
    [6, 7],
  ];

  const pts = corners.map((c) => project(c[0], c[1], c[2]));

  return (
    <svg
      viewBox="0 0 200 140"
      className="h-auto w-full max-w-[200px]"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={pts[a].x}
          y1={pts[a].y}
          x2={pts[b].x}
          y2={pts[b].y}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
      ))}
      {corners.map((c, i) => {
        const p = pts[i];
        const isHi =
          highlight &&
          highlight[0] === c[0] &&
          highlight[1] === c[1] &&
          highlight[2] === c[2];
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isHi ? 7 : 5}
            fill={`rgb(${c[0]},${c[1]},${c[2]})`}
            stroke="currentColor"
            strokeWidth={isHi ? 1.5 : 0.75}
            strokeOpacity={0.5}
          />
        );
      })}
      <text x="8" y="16" className="fill-current text-[10px] opacity-60">
        {title}
      </text>
      <text x="8" y="132" className="fill-current text-[9px] opacity-40">
        R→ G↑ B↗
      </text>
    </svg>
  );
};

/** Simple OKLab-ish 3-axis volume sketch. */
export const OklabVolumeDiagram = ({
  colors,
}: {
  colors: readonly Rgb[];
}) => {
  const project = (i: number) => {
    // Scatter palette points in a loose 3D projection
    const angle = (i / Math.max(1, colors.length)) * Math.PI * 2;
    const x = 100 + Math.cos(angle) * 50;
    const y = 70 + Math.sin(angle) * 28 - (i % 3) * 12;
    return { x, y };
  };

  return (
    <svg
      viewBox="0 0 200 140"
      className="h-auto w-full max-w-[200px]"
      role="img"
      aria-label="OKLab palette points"
    >
      <ellipse
        cx="100"
        cy="70"
        rx="62"
        ry="38"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <line
        x1="100"
        y1="20"
        x2="100"
        y2="120"
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <text x="8" y="16" className="fill-current text-[10px] opacity-60">
        OKLab states → RGB
      </text>
      {colors.map((c, i) => {
        const p = project(i);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={`rgb(${c[0]},${c[1]},${c[2]})`}
            stroke="currentColor"
            strokeWidth={0.75}
            strokeOpacity={0.4}
          />
        );
      })}
      <text x="8" y="132" className="fill-current text-[9px] opacity-40">
        {colors.length} RGB after convert
      </text>
    </svg>
  );
};

/** Bit labels 000–111. */
export const BitComboLegend = () => {
  const bits = ["000", "100", "010", "001", "110", "101", "011", "111"];
  const colors: Rgb[] = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255],
  ];
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="RGB bit combinations">
      {bits.map((b, i) => (
        <div key={b} className="flex items-center gap-1 text-[10px] tabular-nums">
          <span
            className="size-3 border border-border"
            style={{
              backgroundColor: `rgb(${colors[i][0]},${colors[i][1]},${colors[i][2]})`,
            }}
          />
          <span className="text-muted-foreground">{b}</span>
        </div>
      ))}
    </div>
  );
};
