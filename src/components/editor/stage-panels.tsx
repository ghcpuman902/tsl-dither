"use client";

import type React from "react";
import dynamic from "next/dynamic";
import type { StageId } from "@/lib/types";

const stageLoaders: Record<
  Exclude<StageId, "load">,
  () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>
> = {
  downsize: () =>
    import("./stages/DownsizeStage").then((m) => ({
      default: m.DownsizeStage as React.ComponentType<Record<string, unknown>>,
    })),
  tone: () =>
    import("./stages/ToneStage").then((m) => ({
      default: m.ToneStage as React.ComponentType<Record<string, unknown>>,
    })),
  dither: () =>
    import("./stages/DitherStage").then((m) => ({
      default: m.DitherStage as React.ComponentType<Record<string, unknown>>,
    })),
  export: () =>
    import("./stages/ExportStage").then((m) => ({
      default: m.ExportStage as React.ComponentType<Record<string, unknown>>,
    })),
};

export const LoadStagePanel = dynamic(
  () => import("./stages/LoadStage").then((m) => ({ default: m.LoadStage })),
  { loading: () => <StagePanelSkeleton /> },
);

export const DownsizeStagePanel = dynamic(
  () => import("./stages/DownsizeStage").then((m) => ({ default: m.DownsizeStage })),
  { loading: () => <StagePanelSkeleton /> },
);

export const ToneStagePanel = dynamic(
  () => import("./stages/ToneStage").then((m) => ({ default: m.ToneStage })),
  { loading: () => <StagePanelSkeleton /> },
);

export const DitherStagePanel = dynamic(
  () => import("./stages/DitherStage").then((m) => ({ default: m.DitherStage })),
  { loading: () => <StagePanelSkeleton /> },
);

export const ExportStagePanel = dynamic(
  () => import("./stages/ExportStage").then((m) => ({ default: m.ExportStage })),
  { loading: () => <StagePanelSkeleton /> },
);

const StagePanelSkeleton = () => (
  <div className="flex flex-col gap-3 p-4" aria-hidden="true">
    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
    <div className="h-10 w-full animate-pulse rounded bg-muted" />
    <div className="h-10 w-full animate-pulse rounded bg-muted" />
  </div>
);

export const preloadStagePanel = (stageId: StageId): void => {
  if (stageId === "load") return;
  void stageLoaders[stageId]();
};

export const preloadAdjacentStages = (activeStage: StageId): void => {
  const order: StageId[] = ["load", "downsize", "tone", "dither", "export"];
  const index = order.indexOf(activeStage);
  if (index === -1) return;
  if (index > 0) preloadStagePanel(order[index - 1]);
  if (index < order.length - 1) preloadStagePanel(order[index + 1]);
};
