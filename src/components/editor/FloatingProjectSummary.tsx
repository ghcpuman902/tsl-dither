"use client";

import {
  FloatingInsightCard,
  type FloatingInsightContent,
} from "@/components/core/floating-insight-card";

const TSL_DITHER_INSIGHT: FloatingInsightContent = {
  eyebrow: "What am I seeing?",
  title:
    "A browser image editor for retro, high-saturation dithering experiments, built around bright P3 dots on black and the implied depth high-contrast inputs give them",
  subtitle: "TSL Dither",
  cardPreview:
    "TSL Dither started as a visual experiment with the current taste for 8-bit retro dithering, pushed toward the kind of high-saturation P3 colors that pop on modern phone screens: bright magenta, yellow, and blue dots scattered across a black field. On high-contrast source images the dots float in the shadows and the result drifts toward a lidar-like scan, bright and noisy and dimensional, but still produced through a normal photo-editor flow. Along the way we landed on per-channel white-noise dithering, and discovered that for 2D work in the browser, CPU thread isolation (Web Worker) mattered more than the GPU shader path the name hints at.",
  expandedMarkdown: `I started this by wanting to experiment visually with a trend and a hunch about modern displays.

- 🎨 **8-bit retro dithering** + **high contrast** + **high saturation** as one combined look
- 📱 **P3 phone screens make bright dots pop**; vivid magenta, yellow, and blue read as light sources on black, where a full screen of the same colour would just feel overwhelming
- 🌑 **High-contrast inputs help**. When shadows are hard and pure black, the dithered dots float and the brain reads a kind of implied 3D depth, almost like a lidar scan

That visual hunch is the reason the tool exists. The rest is just a controlled flow: load, downsize, tone, dither, export, for producing that effect on real photos.

## Getting the dither to feel right

- 🟦 **Pure threshold** is too harsh. Every gradient collapses to one of two values and the image goes brittle
- ▦ **Ordered dithering (Bayer)** has the opposite problem; the pattern is regular enough that the frequency reads as a grid, not as texture
- 🎲 **Per-channel white noise before thresholding** was the move. Add independent white noise to R, G, and B, threshold each channel, then recombine. The recombined RGB jitter dissolves the obvious pattern and keeps gradients legible

## TSL, and what we actually shipped

- 🧵 **TSL** = Three.js Shading Language; one shader model that targets **WebGPU/WGSL** and **WebGL/GLSL**
- 🎯 **Original plan**: a GPU shader pipeline through TSL for the whole effect
- 🧠 **What we learned**: for a 2D image editor in the browser, the bottleneck isn't shader throughput, it's main-thread responsiveness. **CPU thread isolation** (a Web Worker) kept sliders smooth in a way the GPU experiments didn't
- ⚙️ **Settled solution**: canvas previews, staged downscale, and a Web Worker driving the tone and dither passes. Still on Three.js, **no WebGPU path in this build**

## Next stage

- 🧱 Apply the same white-noise dither as a **post-process pass on a 3D scene**. That's where TSL/WebGPU actually earns its place, because the input already lives on the GPU and the per-frame cost matters
`,
};

export const FloatingProjectSummary = () => {
  return (
    <FloatingInsightCard
      content={TSL_DITHER_INSIGHT}
      positionClassName="fixed left-4 top-[calc(var(--mobile-nav-h)+0.75rem)] z-40 md:left-4 md:top-auto md:bottom-4"
    />
  );
};
