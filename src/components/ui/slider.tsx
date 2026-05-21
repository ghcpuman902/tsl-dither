"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  resetValue?: number
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  resetValue,
  onValueChange,
  disabled,
  ...props
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min],
    [value, defaultValue, min]
  )

  const handleDoubleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (disabled || resetValue === undefined) return
    e.preventDefault()
    onValueChange?.([resetValue])
  }

  return (
    <SliderPrimitive.Root
      className={cn(
        "group/slider relative flex w-full touch-none items-center py-2 select-none data-[disabled]:opacity-50 data-[orientation=horizontal]:min-h-7 data-[orientation=horizontal]:cursor-ew-resize data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:cursor-ns-resize",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onValueChange={onValueChange}
      onDoubleClick={handleDoubleClick}
      title={
        resetValue !== undefined && !disabled
          ? "Drag to adjust · double-click to reset"
          : undefined
      }
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-muted select-none data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="relative block size-3.5 shrink-0 rounded-full border border-ring bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-4 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
