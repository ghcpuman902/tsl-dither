# AGENTS.md

## Cursor Cloud specific instructions

TSL Dither is a single Next.js (App Router) app — a browser image editor with a
`Load → Downsize → Tone → Dither → Export` pipeline. All heavy image processing
runs in a Web Worker (`src/lib/processing.worker.ts`). There is no backend/database;
the only "service" is the Next.js dev server. Package manager is **pnpm** (see
`package.json` `packageManager`).

Standard lint/test/build/run commands live in `package.json` `scripts` and the
`README.md`. Non-obvious caveats for this repo:

- **Dev server runs on port 3737, not 3000** (`pnpm dev`). The app is at
  `http://localhost:3737`. There is a repo rule
  (`.cursor/rules/never-start-the-dev-server-please.mdc`) asking agents not to
  auto-start the dev server because a human may already be running one locally;
  only start it when the task explicitly requires running the app, and reuse an
  existing server if one is up.
- **`pnpm lint` exits non-zero on unmodified code.** It reports 3 pre-existing
  `react-hooks/set-state-in-effect` errors (in `src/components/ui/carousel.tsx`
  and `src/hooks/use-mobile.ts`) plus warnings. A failing `pnpm lint` is expected
  and is not caused by your changes — compare against the base branch before
  attributing lint failures to your work.
- **Tests** (`pnpm test`, Vitest + jsdom) and **build** (`pnpm build`, Turbopack)
  pass cleanly. The build prints a harmless Turbopack NFT tracing warning about
  `next.config.ts` / the `/api/3d-model` route; it does not fail the build.
- `NEXT_PUBLIC_SITE_URL` (see `README.md`) is only needed for correct production
  metadata/OG/sitemap URLs. It is **not required** for local dev, lint, test, or build.
- Ignore `CONTEXT.md`'s mention of `bun` — the repo uses pnpm (lockfile is
  `pnpm-lock.yaml`).
