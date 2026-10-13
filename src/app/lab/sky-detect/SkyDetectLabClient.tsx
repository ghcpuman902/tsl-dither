"use client";

import dynamic from "next/dynamic";

const SkyDetectLab = dynamic(
  () =>
    import("./SkyDetectLab").then((mod) => ({ default: mod.SkyDetectLab })),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Loading sky detect lab…
      </main>
    ),
  },
);

export const SkyDetectLabClient = () => <SkyDetectLab />;
