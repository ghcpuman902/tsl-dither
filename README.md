# TSL Dither

TSL Dither is a browser image editor for retro, high-saturation dithering
experiments. The visual target is bright magenta/yellow/blue dots on black,
especially on high-contrast source images where the result can feel noisy,
dimensional, and lidar-like while still following a normal photo-editor flow.

The core editing flow is:

1. Load
2. Downsize
3. Tone
4. Dither
5. Export

The project started as a visual experiment, then evolved into a UX/performance
exercise: keeping controls responsive while processing large images in-browser.
In practice, staged previews + CPU thread isolation in a dedicated Web Worker
delivered smoother interaction than the original GPU-first direction.

## Features

- Browser-based staged image pipeline: load, downsize, tone, dither, export.
- High-contrast + high-saturation look tuned for bright dot patterns on black.
- Per-channel white-noise dithering to keep gradients more legible than pure
  thresholding and less grid-like than ordered Bayer patterns.
- Interactive previews backed by canvas rendering and Web Worker processing.
- Local image import plus bundled sample images in `public/samples`.
- Export of the currently processed image.

## Dither Approach

- **Pure threshold**: too harsh; gradients collapse and feel brittle.
- **Ordered dithering (Bayer)**: too regular; reads as a visible grid.
- **Current method**: add independent white noise to R/G/B before
  thresholding each channel, then recombine. This RGB jitter reduces obvious
  patterning while keeping tonal structure readable.

## TSL in This Project

TSL stands for Three.js Shading Language (a model that can target WebGPU/WGSL
and WebGL/GLSL). The original intent was a GPU shader-heavy pipeline, but this
build does **not** ship a WebGPU path. The shipped pipeline prioritizes
main-thread responsiveness via Web Worker-based CPU processing.

## Next Stage

Apply the same white-noise dither as a post-process pass on 3D scenes, where a
GPU/TSL path is a better fit because inputs already live on the GPU and
per-frame cost matters.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3737](http://localhost:3737) in your browser.

## Scripts

```bash
pnpm lint
pnpm test
pnpm build
pnpm start
```

## Deployment

This app is a standard Next.js App Router project and deploys cleanly to
[Vercel](https://vercel.com) or any Node.js host that runs `pnpm build` +
`pnpm start`.

Before deploying, set the public site URL so metadata, sitemap, and Open Graph
tags resolve correctly:

```bash
cp .env.example .env.local
# edit NEXT_PUBLIC_SITE_URL to your production domain
```

Example:

```bash
NEXT_PUBLIC_SITE_URL=https://tsl-dither.example
```

Included for demo/public deployment:

- App Router metadata (title, description, Open Graph, Twitter cards)
- `robots.txt`, `sitemap.xml`, and web manifest
- Generated favicon, Apple touch icon, and social preview image
- Basic security headers via `next.config.ts`

After deploy, verify:

- `/` loads the editor
- `/robots.txt` and `/sitemap.xml` are reachable
- `/opengraph-image` renders the social preview card

## Tech Stack

- [Next.js](https://nextjs.org) App Router
- React
- TypeScript
- Tailwind CSS
- Shadcn-style UI components
- Canvas and Web Worker image processing

## Image Samples

Bundled sample images include a local photo plus public-domain images from
Wikimedia Commons. They are stored in `public/samples` so the editor can load
them reliably without depending on remote redirects.

