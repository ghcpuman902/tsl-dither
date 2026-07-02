"use client";

import { DitherPreview } from "@/components/editor/DitherPreview";

type DitherStagePreviewProps = {
  processedImageData: ImageData | null;
};

export const DitherStagePreview = ({ processedImageData }: DitherStagePreviewProps) => (
  <div className="absolute inset-0">
    <DitherPreview processedImageData={processedImageData} />
  </div>
);
