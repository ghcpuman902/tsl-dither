"use client";

import { useCallback, useState } from "react";
import { usePipelineActions, usePipelineState } from "@/lib/pipeline-context";
import {
  useDownsizeResult,
  useDitherResult,
  useProcessingWorkerActions,
  useToneResult,
} from "@/lib/processing-worker-context";
import { usePipelineCoordinator } from "@/lib/use-pipeline-coordinator";
import { PipelineNav } from "./PipelineNav";
import { FloatingProjectSummary } from "./FloatingProjectSummary";
import { PipelinePreview } from "./previews/PipelinePreview";
import {
  LoadStagePanel,
  DownsizeStagePanel,
  ToneStagePanel,
  DitherStagePanel,
  ExportStagePanel,
} from "./stage-panels";

const StagePanel = ({ sourceImageData }: { sourceImageData: ImageData | null }) => {
  const { state } = usePipelineState();

  switch (state.activeStage) {
    case "load":
      return <LoadStagePanel />;
    case "downsize":
      return (
        <DownsizeStagePanel
          sourceWidth={sourceImageData?.width ?? 0}
          sourceHeight={sourceImageData?.height ?? 0}
        />
      );
    case "tone":
      return <ToneStagePanel />;
    case "dither":
      return <DitherStagePanel />;
    case "export":
      return <ExportStagePanel />;
  }
};

export const EditorLayout = () => {
  const { state, pipelineOutput } = usePipelineState();
  const { setPipelineOutput } = usePipelineActions();
  const workerActions = useProcessingWorkerActions();
  const downsizeResult = useDownsizeResult();
  const toneResult = useToneResult();
  const ditherResult = useDitherResult();
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null);

  const handleProcessed = useCallback((imageData: ImageData) => {
    setSourceImageData(imageData);
  }, []);

  const { processedImageData, downsizePreviewOutput, tonePreviewOutput } =
    usePipelineCoordinator({
      sourceImageData,
      state,
      setPipelineOutput,
      workerActions,
      downsizeResult,
      toneResult,
      ditherResult,
    });

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <PipelineNav />

      <div className="flex flex-1 overflow-hidden">
        <PipelinePreview
          activeStage={state.activeStage}
          onProcessed={handleProcessed}
          downsizePreviewOutput={downsizePreviewOutput}
          tonePreviewOutput={tonePreviewOutput}
          processedImageData={processedImageData}
          pipelineOutput={pipelineOutput}
        />

        <aside
          className="fixed inset-x-0 bottom-0 z-30 flex h-[var(--mobile-panel-h)] flex-col overflow-y-auto border-t border-border bg-background/95 backdrop-blur-sm md:static md:h-auto md:w-[288px] md:border-t-0 md:border-l md:bg-background md:backdrop-blur-none"
          aria-label="Stage controls"
        >
          <StagePanel sourceImageData={sourceImageData} />
        </aside>
      </div>

      <FloatingProjectSummary />
    </div>
  );
};
