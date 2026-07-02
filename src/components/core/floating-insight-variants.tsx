"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { SquareArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MorphingDialogClose,
  MorphingDialogContent,
  MorphingDialogLayout,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
} from "@/components/core/morphing-dialog";
import { LightweightMarkdown } from "@/components/core/lightweight-markdown";
import { cn } from "@/lib/utils";
import { useFloatingInsight } from "./floating-insight-context";

const iconButtonClassName =
  "flex border-none p-0! shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const MARQUEE_START_DELAY_S = 1;
const MARQUEE_SPEED_PX_PER_S = 40;
const CAPSULE_TEXT_MAX_WIDTH = "14rem";
const MARQUEE_SCROLL_MARGIN_PX = 16;
const SCROLL_FADE_HEIGHT_REM = 2.5;

const MarqueeText = ({
  text,
  active,
  className,
}: {
  text: string;
  active: boolean;
  className?: string;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [scrollOffset, setScrollOffset] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!active || !containerRef.current || !textRef.current) {
      setScrollOffset(0);
      return;
    }

    const containerWidth = containerRef.current.clientWidth;
    const textWidth = textRef.current.scrollWidth - MARQUEE_SCROLL_MARGIN_PX * 2;
    setScrollOffset(Math.max(0, textWidth - containerWidth));
  }, [active, text]);

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-w-0 flex-1 items-center overflow-hidden", className)}
      style={{
        maskImage:
          scrollOffset > 0
            ? `linear-gradient(to right, transparent 0px, black ${MARQUEE_SCROLL_MARGIN_PX}px, black calc(100% - ${MARQUEE_SCROLL_MARGIN_PX}px), transparent 100%)`
            : "none",
        WebkitMaskImage:
          scrollOffset > 0
            ? `linear-gradient(to right, transparent 0px, black ${MARQUEE_SCROLL_MARGIN_PX}px, black calc(100% - ${MARQUEE_SCROLL_MARGIN_PX}px), transparent 100%)`
            : "none",
      }}
    >
      <motion.span
        ref={textRef}
        className="inline-block whitespace-nowrap text-xs font-medium leading-none"
        style={{
          paddingLeft: `calc(0.625rem + ${MARQUEE_SCROLL_MARGIN_PX}px)`,
          paddingRight: `calc(0.25rem + ${MARQUEE_SCROLL_MARGIN_PX}px)`,
          marginLeft: `-${MARQUEE_SCROLL_MARGIN_PX}px`,
        }}
        initial={false}
        animate={{
          transform:
            scrollOffset > 0 && active && !shouldReduceMotion
              ? `translateX(-${scrollOffset}px)`
              : "translateX(0)",
        }}
        transition={
          scrollOffset > 0 && active && !shouldReduceMotion
            ? {
                delay: MARQUEE_START_DELAY_S,
                duration: scrollOffset / MARQUEE_SPEED_PX_PER_S,
                ease: "linear",
              }
            : { duration: 0 }
        }
      >
        {text}
      </motion.span>
    </div>
  );
};

const ScrollFadePanel = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showBottomFade, setShowBottomFade] = React.useState(false);

  const updateBottomFade = React.useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const hasOverflow = element.scrollHeight > element.clientHeight + 1;
    const isAtBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 4;
    setShowBottomFade(hasOverflow && !isAtBottom);
  }, []);

  React.useEffect(() => {
    updateBottomFade();

    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener("scroll", updateBottomFade, { passive: true });

    const resizeObserver = new ResizeObserver(updateBottomFade);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", updateBottomFade);
      resizeObserver.disconnect();
    };
  }, [updateBottomFade, children]);

  const fadeMaskStyle = showBottomFade
    ? {
        maskImage: `linear-gradient(to bottom, black 0%, black calc(100% - ${SCROLL_FADE_HEIGHT_REM}rem), transparent 100%)`,
        WebkitMaskImage: `linear-gradient(to bottom, black 0%, black calc(100% - ${SCROLL_FADE_HEIGHT_REM}rem), transparent 100%)`,
      }
    : undefined;

  return (
    <div
      ref={scrollRef}
      className={cn(
        "scrollbar-thin-transparent min-h-0 flex-1 overflow-y-auto scroll-pb-8",
        className,
      )}
      style={fadeMaskStyle}
    >
      {children}
    </div>
  );
};

export const FloatingInsightCardView = () => {
  const { content, eyebrow, handleExpand } = useFloatingInsight();

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase leading-none tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={iconButtonClassName}
          onClick={handleExpand}
          aria-label="Expand project summary"
        >
          <SquareArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <ScrollFadePanel className="mt-3">
        <MorphingDialogTitle className="text-lg font-medium leading-tight">
          {content.title}
        </MorphingDialogTitle>
        <MorphingDialogSubtitle className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {content.subtitle}
        </MorphingDialogSubtitle>
        <p className="mt-4 scroll-mb-8 pb-8 text-xs leading-relaxed text-muted-foreground">
          {content.cardPreview}
        </p>
      </ScrollFadePanel>
    </>
  );
};

export const FloatingInsightCapsuleView = () => {
  const { content, isCircleHovered, showCapsuleTitle, eyebrowLabel } = useFloatingInsight();

  return (
    <>
      <div
        className="relative min-w-0 overflow-hidden ml-3"
        style={{
          maxWidth: isCircleHovered ? CAPSULE_TEXT_MAX_WIDTH : "0px",
          transitionProperty: "max-width",
          transitionDuration: !isCircleHovered ? "280ms" : "0ms",
          transitionTimingFunction: "cubic-bezier(0.645, 0.045, 0.355, 1)",
        }}
      >
        <span
          className="block text-xs font-medium leading-none whitespace-nowrap"
          style={{
            opacity: isCircleHovered && !showCapsuleTitle ? 1 : 0,
            transitionProperty: "opacity",
            transitionDuration:
              isCircleHovered && showCapsuleTitle ? "0ms" : !isCircleHovered ? "0ms" : "150ms",
          }}
          aria-hidden={!isCircleHovered || showCapsuleTitle}
        >
          {eyebrowLabel}
        </span>
      </div>

      <span
        className="flex h-6 mr-3 shrink-0 items-center justify-center text-sm font-semibold leading-none text-primary transition-opacity"
        style={{
          opacity: isCircleHovered && showCapsuleTitle ? 0 : 1,
          transitionDuration: isCircleHovered && showCapsuleTitle ? "150ms" : !isCircleHovered ? "0ms" : "200ms",
        }}
        aria-hidden={isCircleHovered && showCapsuleTitle}
      >
        ?
      </span>

      <div
        className="absolute inset-0 flex min-w-0 items-center overflow-hidden"
        style={{
          opacity: isCircleHovered && showCapsuleTitle ? 1 : 0,
          transitionProperty: "opacity",
          transitionDuration: isCircleHovered && showCapsuleTitle ? "150ms" : "0ms",
          pointerEvents: isCircleHovered && showCapsuleTitle ? "auto" : "none",
        }}
        aria-hidden={!showCapsuleTitle}
      >
        <MarqueeText
          text={content.title}
          active={isCircleHovered && showCapsuleTitle}
          className="w-full min-w-0"
        />
      </div>
    </>
  );
};

export const FloatingInsightExpandedView = () => {
  const { content, eyebrow } = useFloatingInsight();

  return (
    <MorphingDialogContent className="flex max-h-[min(85vh,calc(100vw/1.618))] w-[min(calc(100vw-2rem),26rem)] flex-col sm:w-[min(calc(100vw-3rem),36rem)] lg:w-[min(calc(100vw-4rem),44rem)]">
      <div className="scrollbar-thin-transparent flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-7 sm:gap-8 sm:p-10 lg:gap-10 lg:p-14">
        <div className="flex flex-col gap-2 sm:gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <MorphingDialogTitle className="pr-10 text-2xl leading-tight text-balance sm:pr-14 sm:text-3xl lg:pr-16">
            {content.title}
          </MorphingDialogTitle>
          <MorphingDialogSubtitle className="pr-10 text-sm text-muted-foreground sm:pr-14 lg:pr-16">
            {content.subtitle}
          </MorphingDialogSubtitle>
        </div>

        <LightweightMarkdown className="w-full" content={content.expandedMarkdown} />
      </div>
      <MorphingDialogClose />
    </MorphingDialogContent>
  );
};

export const FloatingInsightCollapsedLayout = () => {
  const {
    view,
    handleLayoutMouseEnter,
    handleLayoutMouseLeave,
    handleLayoutClick,
  } = useFloatingInsight();

  const isCard = view === "card";
  const isCircle = view === "circle";

  if (!isCard && !isCircle) return null;

  return (
    <MorphingDialogLayout
      className={cn(
        "overflow-hidden border border-border bg-background/95 text-foreground shadow-lg ring-1 ring-foreground/5 backdrop-blur",
        isCard &&
          "flex h-[min(20rem,calc(100vh-2rem))] w-[min(16rem,calc(100vw-2rem))] flex-col rounded-xl p-4",
        isCircle &&
          "relative flex h-9 cursor-pointer items-center rounded-full min-w-9 outline-none focus-visible:ring-2 focus-visible:ring-ring max-w-[min(calc(100vw-2rem),20rem)]",
      )}
      onMouseEnter={handleLayoutMouseEnter}
      onMouseLeave={handleLayoutMouseLeave}
      onClick={isCircle ? handleLayoutClick : undefined}
      aria-label={isCircle ? "Open project summary card" : undefined}
      role={isCircle ? "button" : undefined}
      tabIndex={isCircle ? 0 : undefined}
      onKeyDown={
        isCircle
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleLayoutClick();
              }
            }
          : undefined
      }
    >
      {isCard ? <FloatingInsightCardView /> : <FloatingInsightCapsuleView />}
    </MorphingDialogLayout>
  );
};
