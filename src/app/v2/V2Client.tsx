"use client";

import dynamic from "next/dynamic";

const V2Shell = dynamic(
  () => import("@/components/v2/V2Shell").then((mod) => ({ default: mod.V2Shell })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-svh items-center justify-center bg-background"
        aria-label="Loading V2 editor"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export const V2Client = () => <V2Shell />;
