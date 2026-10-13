"use client";

import dynamic from "next/dynamic";

const V3Shell = dynamic(
  () =>
    import("@/components/v3/V3Shell").then((mod) => ({ default: mod.V3Shell })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-svh items-center justify-center bg-background"
        aria-label="Loading V3 editor"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export const V3Client = () => <V3Shell />;
