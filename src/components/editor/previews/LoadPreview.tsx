"use client";

import { PreviewCanvas } from "@/components/editor/PreviewCanvas";

type LoadPreviewProps = {
  onProcessed: (imageData: ImageData) => void;
  isActive: boolean;
};

export const LoadPreview = ({ onProcessed, isActive }: LoadPreviewProps) => (
  <div
    className="h-full w-full"
    style={{
      visibility: isActive ? "visible" : "hidden",
      position: isActive ? "relative" : "absolute",
      inset: 0,
    }}
    aria-hidden={!isActive}
  >
    <PreviewCanvas onProcessed={onProcessed} />
  </div>
);
