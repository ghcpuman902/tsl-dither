"use client";

import dynamic from "next/dynamic";

const ColorLab = dynamic(
  () =>
    import("@/components/color-lab/ColorLab").then((mod) => ({
      default: mod.ColorLab,
    })),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Loading color lab…
      </main>
    ),
  },
);

export const ColorLabClient = () => <ColorLab />;
