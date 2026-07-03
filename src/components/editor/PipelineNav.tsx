"use client";

import { useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { usePipelineActions, usePipelineState } from "@/lib/pipeline-context";
import { PIPELINE_STAGES, type StageId } from "@/lib/types";
import { preloadAdjacentStages, preloadStagePanel } from "@/components/editor/stage-panels";
import { cn } from "@/lib/utils";

export const PipelineNav = () => {
  const { state } = usePipelineState();
  const { setActiveStage } = usePipelineActions();

  const handleStageFocus = useCallback((stageId: StageId) => {
    preloadStagePanel(stageId);
    preloadAdjacentStages(stageId);
  }, []);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-40 flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-background/90 px-3 backdrop-blur-sm scrollbar-thin-transparent md:static md:bg-background md:backdrop-blur-none"
      aria-label="Pipeline stages"
    >
      {PIPELINE_STAGES.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-0.5">
          {index > 0 ? (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
              aria-hidden="true"
            />
          ) : null}
          <button
            onClick={() => setActiveStage(stage.id)}
            onMouseEnter={() => handleStageFocus(stage.id)}
            onFocus={() => handleStageFocus(stage.id)}
            className={cn(
              "rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              state.activeStage === stage.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-label={`Switch to ${stage.label} stage`}
            aria-current={state.activeStage === stage.id ? "page" : undefined}
            tabIndex={0}
          >
            {stage.label}
          </button>
        </div>
      ))}
    </nav>
  );
};
