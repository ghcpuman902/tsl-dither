"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DEFAULT_CONTROLS, type PostEffectControls } from "./three-lab-types";
import { ThreeLabControls } from "./ThreeLabControls";

const ThreeLabScene = dynamic(
  () => import("./ThreeLabScene").then((mod) => ({ default: mod.ThreeLabScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
        Loading WebGPU scene…
      </div>
    ),
  },
);

export default function ThreeDPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [controls, setControls] = useState<PostEffectControls>(DEFAULT_CONTROLS);
  const normalizedControls = useMemo(
    () => ({ ...DEFAULT_CONTROLS, ...controls }),
    [controls],
  );

  return (
    <main className="fixed inset-0 h-svh w-svw overflow-hidden bg-black">
      <ThreeLabScene controls={normalizedControls} onError={setErrorMessage} />
      <ThreeLabControls controls={normalizedControls} onControlsChange={setControls} />
      {errorMessage ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <p className="max-w-xl text-center text-sm text-red-300">
            Failed to initialize `/3d`: {errorMessage}
          </p>
        </div>
      ) : null}
    </main>
  );
}
