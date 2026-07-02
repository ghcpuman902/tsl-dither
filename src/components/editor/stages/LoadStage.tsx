"use client";

import { useRef } from "react";
import Image from "next/image";
import { ImageIcon, Upload } from "lucide-react";
import { usePipelineActions, usePipelineState, SOURCE_IMAGE_FILENAME_KEY } from "@/lib/pipeline-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const DEFAULT_IMAGE_SRC = "/DSC04192_LowRes.jpg";

type SampleImage = {
  label: string;
  src: string;
  source: string;
};

const SAMPLE_IMAGES: SampleImage[] = [
  {
    label: "Default photo",
    src: DEFAULT_IMAGE_SRC,
    source: "Local sample",
  },
  {
    label: "Statue of Liberty",
    src: "/samples/statue-of-liberty.jpg",
    source: "Wikimedia Commons, public domain",
  },
  {
    label: "Colosseum",
    src: "/samples/colosseum.jpg",
    source: "Wikimedia Commons, public domain",
  },
  {
    label: "Eiffel Tower",
    src: "/samples/eiffel-tower.jpg",
    source: "Wikimedia Commons, public domain",
  },
];

export const LoadStage = () => {
  const { state } = usePipelineState();
  const { setSourceImageFromFile, setSourceImageSrc } = usePipelineActions();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await setSourceImageFromFile(file);
    e.target.value = "";
  };

  const handleResetToDefault = () => {
    if (state.sourceImageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(state.sourceImageSrc);
    }
    setSourceImageSrc(DEFAULT_IMAGE_SRC);
  };

  const handleSelectSampleImage = (src: string) => {
    if (state.sourceImageSrc === src) return;
    if (state.sourceImageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(state.sourceImageSrc);
    }
    setSourceImageSrc(src);
  };

  const filename =
    state.sourceImageSrc.startsWith("blob:")
      ? (typeof localStorage !== "undefined"
          ? localStorage.getItem(SOURCE_IMAGE_FILENAME_KEY)
          : null) ?? "Uploaded image"
      : state.sourceImageSrc.split("/").pop() ?? "Unknown";

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Source
        </Label>
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{filename}</span>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => inputRef.current?.click()}
          aria-label="Load a different image file"
        >
          <Upload className="h-3.5 w-3.5" />
          Load Image…
        </Button>

        {state.sourceImageSrc !== DEFAULT_IMAGE_SRC && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={handleResetToDefault}
            aria-label="Reset to default image"
          >
            Reset to default
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Image file input"
        tabIndex={-1}
      />

      <Separator />

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Sample images
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {SAMPLE_IMAGES.map((image) => {
            const isSelected = state.sourceImageSrc === image.src;

            return (
              <button
                key={image.src}
                type="button"
                className={`overflow-hidden rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary/60"
                }`}
                onClick={() => handleSelectSampleImage(image.src)}
                aria-label={`Use ${image.label} sample image`}
                aria-pressed={isSelected}
              >
                <span className="relative block h-20 w-full">
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes="10rem"
                    className="object-cover"
                  />
                </span>
                <span className="flex flex-col gap-0.5 px-2 py-1.5">
                  <span className="truncate text-xs font-medium text-foreground">
                    {image.label}
                  </span>
                  <span className="line-clamp-2 text-[10px] leading-tight">
                    {image.source}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/60">Preview shows original image.</p>
        <p>Tone adjustments are applied on the Tone tab.</p>
      </div>
    </div>
  );
};
