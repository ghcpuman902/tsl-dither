# TSL Dither

TSL Dither is a browser-based image editor for experimenting with saturated
8-bit and retro dithering styles. It works especially well on high-contrast
images, where tone controls and pixel patterns can create a lidar-like visual
effect: bright, graphic, noisy, and intentionally synthetic.

The project is also a design engineering study in making heavy image processing
feel immediate inside a React interface. Browser image tools are challenging
because every adjustment can involve millions of pixels, so the app uses a
staged pipeline, canvas previews, and Web Worker processing to keep controls
responsive while images are resized, toned, dithered, previewed, and exported.

The same approach can carry into future media-heavy projects: keep the UI model
simple, process only the resolution you need, move expensive work off the main
thread, and treat performance as part of the user experience.

## Features

- Load local images or choose bundled public-domain sample images.
- Resize source images before heavier processing.
- Adjust tone controls before dithering.
- Preview dither output interactively.
- Export the current processed image.
- Run CPU-heavy processing in a dedicated Web Worker.

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
```

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

