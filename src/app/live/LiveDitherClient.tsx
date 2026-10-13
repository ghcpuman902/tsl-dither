"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import type { LiveDitherSettings, LiveSubject } from "./live-dither-types";

const LiveDitherScene = dynamic(
  () => import("./LiveDitherScene").then((mod) => ({ default: mod.LiveDitherScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Starting live dither…
      </div>
    ),
  },
);

const DEFAULT_SETTINGS: LiveDitherSettings = {
  subject: "statue",
  threshold: 0.42,
  noise: 0.85,
  pixelSize: 3,
};

export const LiveDitherClient = () => {
  const [settings, setSettings] = useState<LiveDitherSettings>(DEFAULT_SETTINGS);
  const [photoUrl, setPhotoUrl] = useState("/samples/statue-of-liberty.jpg");
  const [lightDegrees, setLightDegrees] = useState(64);
  const [status, setStatus] = useState("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubject = (subject: LiveSubject) => {
    setSettings((current) => ({ ...current, subject }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    setPhotoUrl(url);
    setSettings((current) => ({ ...current, subject: "photo" }));
    event.target.value = "";
  };

  const handleNudgeLight = () => {
    const stage = document.querySelector<HTMLElement>("[data-testid='live-stage']");
    stage?.dispatchEvent(new CustomEvent("live-nudge-light"));
  };

  return (
    <main className="fixed inset-0 h-svh w-svw overflow-hidden bg-background text-foreground">
      <LiveDitherScene
        settings={settings}
        photoUrl={photoUrl}
        onLightDegrees={setLightDegrees}
        onStatus={setStatus}
        onError={setErrorMessage}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="flex items-start justify-between gap-4 p-4">
          <div className="pointer-events-auto flex flex-col gap-1">
            <Link
              href="/"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back
            </Link>
            <h1 className="text-base font-medium">Live dither</h1>
            <p className="max-w-sm text-xs text-muted-foreground">
              Hard side light, then independent white noise on R, G, and B before each channel is thresholded. Drag to move the light. Noise loops at 18 fps.
            </p>
          </div>
          <p
            className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm"
            data-testid="light-readout"
          >
            Light {lightDegrees}°
          </p>
        </header>

        <div className="mt-auto flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
          <div
            data-ui="controls"
            className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-md border border-border bg-background/90 p-3 text-sm"
          >
            <div className="flex gap-1" role="group" aria-label="Subject">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  settings.subject === "statue"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={settings.subject === "statue"}
                onClick={() => handleSubject("statue")}
              >
                Statue
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  settings.subject === "photo"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={settings.subject === "photo"}
                data-testid="photo-mode"
                onClick={() => handleSubject("photo")}
              >
                Photo relief
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Threshold
              <input
                type="range"
                min={0.15}
                max={0.75}
                step={0.01}
                value={settings.threshold}
                aria-label="Dither threshold"
                className="accent-primary"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    threshold: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Noise
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.noise}
                aria-label="White noise amount"
                className="accent-primary"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    noise: Number(event.target.value),
                  }))
                }
              />
            </label>

            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="nudge-light"
              onClick={handleNudgeLight}
            >
              Nudge light
            </button>

            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Upload a photo to relight"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              tabIndex={-1}
              aria-label="Photo file input"
              onChange={handleFileChange}
            />
          </div>

          <p className="text-xs text-muted-foreground" data-testid="live-status">
            {errorMessage ?? status}
          </p>
        </div>
      </div>
    </main>
  );
};
