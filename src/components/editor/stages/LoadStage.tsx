"use client";

import { useRef } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { usePipeline, SOURCE_IMAGE_FILENAME_KEY } from "@/lib/pipeline-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const LoadStage = () => {
  const { state, setSourceImageFromFile, setSourceImageSrc } = usePipeline();
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
    setSourceImageSrc("/DSC04192_LowRes.jpg");
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

        {state.sourceImageSrc !== "/DSC04192_LowRes.jpg" && (
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

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/60">Preview shows original image.</p>
        <p>Tone adjustments are applied on the Tone tab.</p>
      </div>
    </div>
  );
};
