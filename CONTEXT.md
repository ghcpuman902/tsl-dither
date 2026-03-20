# TSL Dither – Project Context

This repo is a **fresh Next.js + Shadcn + Three.js (TSL) + Tailwind** app for building a **point-cloud photo / dither** effect with full control.

## Stack

- **Next.js** (App Router), **React**, **Tailwind CSS**, **Shadcn UI**, **Three.js** (WebGPU + TSL).
- Use **bun** for install/run/build (`bun add`, `bun run dev`, etc.).

## Goals (to implement later)

- **Pipeline:** Photo → tone (contrast, exposure, highlight/falloff) → optional histogram → **dither** (e.g. blue-noise or ordered/Bayer) → point cloud.
- **Renderer:** Three.js WebGPU + TSL: point cloud with per-channel (R/G/B) toggles, **blend mode** (additive / normal / screen), optional chromatic aberration, rounded dots on black.
- **Aspect ratio:** Letterbox with black padding (no stretch).
- **Reference:** Dither logic and color quantization from [The Art of Dithering and Retro Shading for the Web](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/) (use for correct threshold/pattern behaviour; can keep blue-noise unordered dither).

## Cursor / AI context

- **Rules:** `.cursor/rules/` (tech stack, never start dev server, TSL rules, optional keep-a-note).
- **Knowledge:** `.cursor/knowledge/tsl.md` – TSL (Three.js Shading Language) reference (imports, init, types, Fn(), materials, etc.). Use `three/webgpu` and `three/tsl` only.

## Current state

- Empty landing page; no effect code yet. Implement after moving work here from the institutional-frontend TSL page.
