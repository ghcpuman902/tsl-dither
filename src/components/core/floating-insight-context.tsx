"use client";

import * as React from "react";
import type { FloatingInsightContent, FloatingInsightView } from "./floating-insight-types";

export type FloatingInsightContextValue = {
  content: FloatingInsightContent;
  view: FloatingInsightView;
  setView: React.Dispatch<React.SetStateAction<FloatingInsightView>>;
  isCircleHovered: boolean;
  showCapsuleTitle: boolean;
  eyebrow: string;
  eyebrowLabel: string;
  handleExpand: (event: React.MouseEvent<HTMLButtonElement>) => void;
  handleExpandedChange: (open: boolean) => void;
  handleLayoutMouseEnter: () => void;
  handleLayoutMouseLeave: () => void;
  handleLayoutClick: () => void;
};

const FloatingInsightContext = React.createContext<FloatingInsightContextValue | null>(null);

export const useFloatingInsight = (): FloatingInsightContextValue => {
  const ctx = React.useContext(FloatingInsightContext);
  if (!ctx) {
    throw new Error("FloatingInsight components must be used within FloatingInsightProvider");
  }
  return ctx;
};

const INITIAL_SHRINK_MS = 3000;
const CARD_SHRINK_MS = 1000;
const CAPSULE_TITLE_DELAY_MS = 1200;

const clearTimer = (timerRef: React.RefObject<number | null>) => {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
};

export type FloatingInsightProviderProps = {
  content: FloatingInsightContent;
  defaultView?: FloatingInsightView;
  children: React.ReactNode;
};

export const FloatingInsightProvider = ({
  content,
  defaultView = "card",
  children,
}: FloatingInsightProviderProps) => {
  const [view, setView] = React.useState<FloatingInsightView>(defaultView);
  const [isCircleHovered, setIsCircleHovered] = React.useState(false);
  const [showCapsuleTitle, setShowCapsuleTitle] = React.useState(false);

  const eyebrow = content.eyebrow ?? "What am I seeing?";
  const eyebrowLabel = eyebrow.endsWith("?") ? eyebrow.slice(0, -1) : eyebrow;

  const initialShrinkTimerRef = React.useRef<number | null>(null);
  const cardShrinkTimerRef = React.useRef<number | null>(null);
  const capsuleTitleTimerRef = React.useRef<number | null>(null);
  const hasInteractedRef = React.useRef(false);

  const resetCapsuleState = React.useCallback(() => {
    setIsCircleHovered(false);
    setShowCapsuleTitle(false);
    clearTimer(capsuleTitleTimerRef);
  }, []);

  const clearAllTimers = React.useCallback(() => {
    clearTimer(initialShrinkTimerRef);
    clearTimer(cardShrinkTimerRef);
    clearTimer(capsuleTitleTimerRef);
  }, []);

  React.useEffect(() => {
    initialShrinkTimerRef.current = window.setTimeout(() => {
      setView((currentView) => {
        if (currentView !== "card" || hasInteractedRef.current) return currentView;
        resetCapsuleState();
        return "circle";
      });
    }, INITIAL_SHRINK_MS);

    return () => {
      clearTimer(initialShrinkTimerRef);
    };
  }, [resetCapsuleState]);

  const handleExpand = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    clearAllTimers();
    setView("expanded");
  }, [clearAllTimers]);

  const handleExpandedChange = React.useCallback((open: boolean) => {
    if (!open) {
      resetCapsuleState();
      setView("circle");
    }
  }, [resetCapsuleState]);

  const handleLayoutMouseEnter = React.useCallback(() => {
    if (view === "card") {
      hasInteractedRef.current = true;
      clearTimer(initialShrinkTimerRef);
      clearTimer(cardShrinkTimerRef);
      return;
    }

    if (view === "circle") {
      setIsCircleHovered(true);
      clearTimer(capsuleTitleTimerRef);
      capsuleTitleTimerRef.current = window.setTimeout(() => {
        setShowCapsuleTitle(true);
      }, CAPSULE_TITLE_DELAY_MS);
    }
  }, [view]);

  const handleLayoutMouseLeave = React.useCallback(() => {
    if (view === "card") {
      clearTimer(cardShrinkTimerRef);
      cardShrinkTimerRef.current = window.setTimeout(() => {
        setView((currentView) => {
          if (currentView !== "card") return currentView;
          resetCapsuleState();
          return "circle";
        });
      }, CARD_SHRINK_MS);
      return;
    }

    if (view === "circle") {
      resetCapsuleState();
    }
  }, [view, resetCapsuleState]);

  const handleLayoutClick = React.useCallback(() => {
    if (view !== "circle") return;
    clearAllTimers();
    resetCapsuleState();
    setView("card");
  }, [view, clearAllTimers, resetCapsuleState]);

  const value = React.useMemo<FloatingInsightContextValue>(
    () => ({
      content,
      view,
      setView,
      isCircleHovered,
      showCapsuleTitle,
      eyebrow,
      eyebrowLabel,
      handleExpand,
      handleExpandedChange,
      handleLayoutMouseEnter,
      handleLayoutMouseLeave,
      handleLayoutClick,
    }),
    [
      content,
      view,
      isCircleHovered,
      showCapsuleTitle,
      eyebrow,
      eyebrowLabel,
      handleExpand,
      handleExpandedChange,
      handleLayoutMouseEnter,
      handleLayoutMouseLeave,
      handleLayoutClick,
    ],
  );

  return (
    <FloatingInsightContext.Provider value={value}>
      {children}
    </FloatingInsightContext.Provider>
  );
};
