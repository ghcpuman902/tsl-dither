"use client";

import { type KeyboardEvent, type ReactNode } from "react";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  id: T;
  label: ReactNode;
  ariaLabel?: string;
};

type AnimatedSegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  listClassName?: string;
  itemClassName?: string;
};

const SEGMENT_TRANSITION = {
  type: "spring" as const,
  bounce: 0.2,
  duration: 0.3,
};

export const AnimatedSegmentedControl = <T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  listClassName,
  itemClassName,
}: AnimatedSegmentedControlProps<T>) => {
  const handleKeyDown = (event: KeyboardEvent, id: T) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onValueChange(id);
  };

  return (
    <div
      className={cn(
        "flex w-fit flex-wrap gap-1 rounded-lg border border-border p-1",
        listClassName
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      <AnimatedBackground
        defaultValue={value}
        onValueChange={(id) => {
          if (id) onValueChange(id as T);
        }}
        className="rounded-md bg-primary"
        transition={SEGMENT_TRANSITION}
      >
        {options.map(({ id, label, ariaLabel: itemAriaLabel }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              data-id={id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              aria-label={itemAriaLabel}
              onKeyDown={(event) => handleKeyDown(event, id)}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "text-muted-foreground hover:text-foreground data-[checked=true]:text-primary-foreground",
                itemClassName
              )}
            >
              {label}
            </button>
          );
        })}
      </AnimatedBackground>
    </div>
  );
};
