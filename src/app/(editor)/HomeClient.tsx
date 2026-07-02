"use client";

import dynamic from "next/dynamic";

const EditorLayout = dynamic(
  () =>
    import("@/components/editor/EditorLayout").then((mod) => ({
      default: mod.EditorLayout,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-screen items-center justify-center bg-background"
        aria-label="Loading editor"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export const HomeClient = () => <EditorLayout />;
