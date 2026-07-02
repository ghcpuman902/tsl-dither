"use client";

import {
  MorphingDialog,
  MorphingDialogContainer,
} from "@/components/core/morphing-dialog";
import { cn } from "@/lib/utils";
import { FloatingInsightProvider, useFloatingInsight } from "./floating-insight-context";
import {
  FloatingInsightCollapsedLayout,
  FloatingInsightExpandedView,
} from "./floating-insight-variants";
import type { FloatingInsightCardProps } from "./floating-insight-types";

export type {
  FloatingInsightView,
  FloatingInsightContent,
  FloatingInsightCardProps,
} from "./floating-insight-types";

const MORPH_TRANSITION = {
  type: "tween" as const,
  duration: 0.28,
  ease: [0.645, 0.045, 0.355, 1] as const,
};

const FloatingInsightCardFrame = ({
  className,
  positionClassName,
}: {
  className?: string;
  positionClassName: string;
}) => {
  const { view, handleExpandedChange } = useFloatingInsight();

  return (
    <div className={cn(positionClassName, className)}>
      <MorphingDialog
        open={view === "expanded"}
        onOpenChange={handleExpandedChange}
        transition={MORPH_TRANSITION}
      >
        <FloatingInsightCollapsedLayout />
        <MorphingDialogContainer>
          <FloatingInsightExpandedView />
        </MorphingDialogContainer>
      </MorphingDialog>
    </div>
  );
};

export const FloatingInsightCard = ({
  content,
  className,
  defaultView = "card",
  positionClassName = "fixed bottom-4 left-4 z-40",
}: FloatingInsightCardProps) => (
  <FloatingInsightProvider content={content} defaultView={defaultView}>
    <FloatingInsightCardFrame
      className={className}
      positionClassName={positionClassName}
    />
  </FloatingInsightProvider>
);
