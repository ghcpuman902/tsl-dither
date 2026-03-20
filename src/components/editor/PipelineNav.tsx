"use client";

import { ChevronRight } from "lucide-react";
import { usePipeline } from "@/lib/pipeline-context";
import { PIPELINE_STAGES } from "@/lib/types";
import { cn } from "@/lib/utils";

export const PipelineNav = () => {
  const { state, setActiveStage } = usePipeline();

  return (
    <nav
      className="flex h-11 shrink-0 items-center border-b border-border bg-background px-3 gap-0.5"
      aria-label="Pipeline stages"
    >
      {PIPELINE_STAGES.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-0.5">
          {index > 0 && (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
              aria-hidden="true"
            />
          )}
          <button
            onClick={() => setActiveStage(stage.id)}
            className={cn(
              "rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              state.activeStage === stage.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
