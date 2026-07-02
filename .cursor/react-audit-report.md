# React Best Practices & Composition Patterns Audit

**Project:** tsl-dither  
**Date:** 2026-07-02  
**Skills applied:** [react-best-practices](../.agents/skills/vercel-react-best-practices/SKILL.md), [vercel-composition-patterns](../.agents/skills/vercel-composition-patterns/SKILL.md)  
**Scope:** `src/` application code (editor, 3D lab, lib, app routes). Shadcn UI primitives noted only where they affect app bundles.

---

## Executive summary

The editor is architecturally sound: Web Worker isolation, direct imports (no barrels), and `next/dynamic` for the heavy editor shell are all aligned with Vercel guidance. The main gaps are **client-side processing waterfalls**, **broad context subscriptions causing unnecessary re-renders**, **missing transition/deferred-value patterns for slider UX**, and **composition opportunities** in `EditorLayout` and pipeline state.

| Area | Grade | Notes |
|------|-------|-------|
| Bundle / code splitting | B+ | Editor dynamically loaded; stages and `/3d` are not |
| Waterfalls & async | C | Sequential effect chain in `EditorLayout`; API route is fine |
| Server / RSC boundaries | B | Minimal server surface; root client providers are broad |
| Re-render optimization | C+ | No `startTransition` / `useDeferredValue`; monolithic contexts |
| Composition patterns | B− | Good compound dialog; editor uses stage switches + dead code |
| React 19 alignment | A− | No `forwardRef` in app code; still on `useContext` |

**Recommended focus (highest ROI):**

1. Split pipeline + worker contexts so UI only subscribes to what it needs.
2. Wrap param updates in `startTransition` and defer preview reads with `useDeferredValue`.
3. Lazy-load stage panels and the `/3d` Three.js stack.
4. Refactor `EditorLayout` preview area into explicit stage preview components (composition over `activeStage` conditionals).

---

## What already follows the skills

### React best practices

| Rule | Evidence |
|------|----------|
| `bundle-dynamic-imports` | `HomeClient` dynamically imports `EditorLayout` with `ssr: false` and a loading shell (`src/app/HomeClient.tsx`). |
| `bundle-barrel-imports` | No `index.ts` barrel files under `src/`; imports are direct (e.g. `@/components/ui/button`). |
| `client-passive-event-listeners` | Scroll/pointer listeners use `{ passive: true }` in `floating-insight-card.tsx`, `app/3d/page.tsx`. |
| `rerender-lazy-state-init` | `PipelineProvider` initializes from `localStorage` via lazy `useState` (`pipeline-context.tsx`). |
| `rerender-functional-setstate` | Pipeline updaters consistently use functional `setState`. |
| `advanced-init-once` | Web Worker created once per mount in `use-processing-worker.ts`. |
| `js-early-exit` | Worker message handler discards stale responses by request id. |

### Composition patterns

| Rule | Evidence |
|------|----------|
| `architecture-compound-components` | `MorphingDialog` + subcomponents with shared context (`morphing-dialog.tsx`) — reference implementation. |
| `state-lift-state` | Pipeline state lifted in `PipelineProvider`; processing state in `ProcessingWorkerProvider`. |
| `react19-no-forwardref` | App-authored components avoid `forwardRef`. |

---

## Findings by priority

### P0 — Critical (bundle & waterfalls)

#### 1. Client processing waterfall in `EditorLayout`

**Rules:** `async-parallel`, `rerender-derived-state-no-effect`, `rerender-move-effect-to-event`

**Location:** `src/components/editor/EditorLayout.tsx` (lines 104–214)

**Issue:** Nine `useEffect` hooks form a serial pipeline:

```
sourceImageData → downsize → tone → histogram + setSource → dither queue → pipelineOutput
```

Each stage waits for the previous effect + worker round-trip. Slider changes on Downsize/Tone re-trigger the full chain even when the user is on an unrelated stage.

**Impact:** Latency stacks on every param tweak; main thread still busy converting buffers (`useMemo` + `slice` on every result).

**Suggested improvement:**

- Introduce a small **pipeline coordinator** (module or hook) that accepts intents (`"source-changed"`, `"downsize-changed"`, …) and schedules worker jobs with explicit dependency graph, coalescing rapid slider updates.
- Run **downsize + tone requests in parallel** when inputs are independent (e.g. histogram can run off tone output without blocking dither).
- Debounce worker posts at the coordinator layer (PreviewCanvas already debounces source frames at 200ms — align pipeline debouncing).

---

#### 2. `/3d` route loads Three.js eagerly

**Rules:** `bundle-dynamic-imports`, `bundle-conditional`

**Location:** `src/app/3d/page.tsx` (top-level `three/webgpu`, `GLTFLoader`, TSL imports)

**Issue:** ~900-line client page with heavy deps is not code-split beyond the route boundary. First visit to `/3d` pulls the full WebGPU stack immediately.

**Suggested improvement:**

- Extract scene bootstrap to `ThreeLabScene.tsx` and load via `next/dynamic({ ssr: false })`.
- Optionally preload on link hover to `/3d` (`bundle-preload`).

---

#### 3. All stage panels bundled with `EditorLayout`

**Rules:** `bundle-dynamic-imports`, `bundle-conditional`

**Location:** `src/components/editor/EditorLayout.tsx` (static imports of all five stages)

**Issue:** Load/Downsize/Tone/Dither/Export panels ship together even though only one renders at a time.

**Suggested improvement:**

```tsx
const ToneStage = dynamic(() =>
  import("./stages/ToneStage").then((m) => ({ default: m.ToneStage }))
);
```

Apply per stage in `StagePanel` switch. Preload adjacent stage on `PipelineNav` hover/focus.

---

### P1 — High (re-renders & context shape)

#### 4. Monolithic `PipelineContext` forces wide re-renders

**Rules:** `rerender-derived-state`, `state-context-interface`, `state-decouple-implementation`

**Location:** `src/lib/pipeline-context.tsx`, `src/lib/types.ts` (`PipelineContextType`)

**Issue:** Single context value bundles `state`, `pipelineOutput`, and nine actions. Any `state` change (e.g. one tone slider) re-renders every `usePipeline()` consumer — `PipelineNav`, all mounted previews, `FloatingProjectSummary`, etc.

**Suggested improvement:**

- Split into **`PipelineStateContext`** + **`PipelineActionsContext`** (actions stable via `useCallback`, state isolated).
- Better: adopt **`state-context-interface`** — `{ state, actions, meta }` with selectors or split contexts per stage (`useDownsizeState`, `useToneState`).
- Consider `useSyncExternalStore` or a lightweight store (Zustand/Jotai) if selector granularity becomes important; keep worker logic decoupled in the provider only.

---

#### 5. `ProcessingWorkerContext` exposes full worker state

**Rules:** `rerender-defer-reads`, `state-context-interface`

**Location:** `src/lib/processing-worker-context.tsx`, consumers in `EditorLayout`, `DitherPreview`, `Histogram`, `ToneStage`

**Issue:** Subscribers receive `downsizeResult`, `ditherResult`, `histogramResult`, `toneResult` together. Histogram updates re-render `EditorLayout` even when only the tone panel needs them.

**Suggested improvement:**

- Export focused hooks: `useToneResult()`, `useDitherResult()`, `useHistogramResult()`.
- Or split provider children so `Histogram` subtree reads histogram context only.

---

#### 6. No `startTransition` / `useDeferredValue` for param edits

**Rules:** `rerender-transitions`, `rerender-use-deferred-value`, `rendering-usetransition-loading`

**Location:** Stage panels (`ParamSlider`, `ToneSliders`, `DownsizeStage`), `EditorLayout` preview memos

**Issue:** Slider moves are synchronous React updates that immediately trigger worker requests and expensive preview memos (`ImageData` reconstruction, buffer slices).

**Suggested improvement:**

- Wrap `updateTone` / `updateDownsize` / `updateDither` calls in `startTransition`.
- In preview components, `const deferredTone = useDeferredValue(state.tone)` and key worker requests off deferred values.
- Keeps slider thumb responsive while previews catch up.

---

#### 7. `PipelineProvider` wraps entire app including `/3d`

**Rules:** `server-serialization`, `bundle-conditional`

**Location:** `src/app/layout.tsx`

**Issue:** 3D lab page mounts pipeline context, localStorage hydration, and IndexedDB restore logic it never uses.

**Suggested improvement:**

- Move `PipelineProvider` + `ProcessingWorkerProvider` to a `(editor)` route group layout (`app/(editor)/layout.tsx`) and keep `/3d` outside that group.
- Reduces client JS work on unrelated routes.

---

### P2 — Medium (rendering & composition)

#### 8. `EditorLayout` preview uses stage conditionals instead of composition

**Rules:** `architecture-avoid-boolean-props`, `patterns-explicit-variants`, `rendering-conditional-render`

**Location:** `src/components/editor/EditorLayout.tsx` (lines 224–264)

**Issue:** Five `state.activeStage === …` branches duplicate wrapper markup. `PreviewCanvas` stays mounted with visibility hacks — good for state, but hard to extend.

**Suggested improvement:**

- Define explicit preview variants: `LoadPreview`, `DownsizePreview`, `TonePreview`, `DitherPreview`, `ExportPreview`.
- Compose in `StagePanel`-like switch or a `PipelinePreview.Frame` compound component.
- Replace `&&` conditionals with ternary where falsy values are possible (`rendering-conditional-render`).

---

#### 9. `FloatingInsightCard` internal view state machine

**Rules:** `architecture-avoid-boolean-props`, `patterns-explicit-variants`

**Location:** `src/components/core/floating-insight-card.tsx`

**Issue:** `view: "card" | "circle" | "expanded"` drives many `isCard` / `isCircle` branches. Manageable today, but matches the anti-pattern at scale.

**Suggested improvement (optional):**

- Extract `FloatingInsightCardView`, `FloatingInsightCapsuleView`, `FloatingInsightExpandedView` as explicit variants sharing `FloatingInsightProvider` context (mirror `MorphingDialog` pattern already in repo).

---

#### 10. `Histogram` optional boolean prop

**Rules:** `architecture-avoid-boolean-props`

**Location:** `src/components/editor/Histogram.tsx` (`smooth?: boolean`), `ToneStage` (`showRawSpikes`)

**Issue:** Minor — parent toggles smoothing via boolean.

**Suggested improvement:** `Histogram.Smoothed` vs `Histogram.Raw` variant components, or pass `mode: "smooth" | "raw"` enum (explicit variant).

---

#### 11. `PreviewCanvas` allocates offscreen canvas every render

**Rules:** `js-batch-dom-css`, `rerender-use-ref-transient-values`

**Location:** `src/components/editor/PreviewCanvas.tsx` (`render` callback, line 71)

**Issue:** `document.createElement("canvas")` on each animation frame / resize is GC pressure.

**Suggested improvement:**

- Reuse one offscreen canvas in a `useRef`.
- Consider `requestAnimationFrame` coalescing when multiple deps change in one frame.

---

#### 12. `localStorage` persistence without schema version

**Rules:** `client-localstorage-schema`

**Location:** `src/lib/pipeline-context.tsx` (`STORAGE_KEY`, `loadFromStorage`)

**Issue:** Partial migration exists (`channel-preview` → `dither`) but no version field. Future shape changes risk silent corruption.

**Suggested improvement:**

```ts
type StoredPipeline = { v: 1; state: PipelineState };
// On read: if v !== CURRENT_VERSION, merge defaults or reset
```

---

#### 13. Dead / orphaned stage code

**Rules:** `bundle-conditional`

**Location:** `src/components/editor/stages/ChannelPreviewStage.tsx` (not imported in `EditorLayout`)

**Issue:** Unused stage adds maintenance surface; may confuse future composition work.

**Suggested improvement:** Delete or wire into pipeline if still planned; document in README if intentional WIP.

---

#### 14. `DitherPreview` grid cells re-render together

**Rules:** `rerender-memo`, `rerender-split-combined-hooks`

**Location:** `src/components/editor/DitherPreview.tsx` (`DitherChannelCell`)

**Issue:** Four channel cells share parent state; any `ditherResult` or `previewMode` change redraws all canvases (GPU + CPU paths).

**Suggested improvement:**

- Memoize `DitherChannelCell` with stable props.
- Split `previewMode` into context so only the tablist re-renders on mode change.

---

### P3 — Low (nice-to-have)

| # | Rule | Location | Suggestion |
|---|------|----------|------------|
| 15 | `rendering-hoist-jsx` | `EditorLayout`, stage panels | Hoist static labels / section headers outside components where props don't vary. |
| 16 | `js-min-max-loop` | `Histogram.tsx` (`Math.max(...sourceR, ...)`) | Use loop for 256-bin max (micro-optimization). |
| 17 | `react19-no-forwardref` | `morphing-dialog.tsx` uses `function` declarations | Align with const + ref-as-prop when touching files. |
| 18 | `rendering-resource-hints` | App routes | Preload default hero image (`/DSC04192_LowRes.jpg`) via `<link rel="preload">` in `page.tsx` or metadata. |
| 19 | `server-hoist-static-io` | `app/api/3d-model/route.ts` | Dev-only absolute path; use env var + `React.cache` if model path is stable per deploy. |
| 20 | Unused shadcn deps | `package.json` (`recharts`, `embla-carousel`, many UI files) | Not imported by editor — safe today; run bundle analyzer before adding barrel re-exports. |

---

## Composition patterns — detailed assessment

### Strong examples (keep as templates)

1. **`MorphingDialog`** — Compound API (`MorphingDialog`, `MorphingDialogLayout`, `MorphingDialogContent`, …) with context, controlled/uncontrolled open state, and portal container. Use as the pattern for any new multi-part UI.

2. **`FloatingProjectSummary`** — Thin wrapper composing `FloatingInsightCard` with static content. Good separation of content vs chrome.

3. **Stage components** — Each stage (`LoadStage`, `DownsizeStage`, …) is a focused unit; `StagePanel` switch is clearer than one mega-form with booleans.

### Gaps vs skill guidelines

| Guideline | Current state | Target state |
|-----------|---------------|--------------|
| `state-context-interface` | Flat `PipelineContextType` | `{ state, actions, meta }` or split contexts |
| `state-decouple-implementation` | UI hooks know about localStorage + IndexedDB | Persistence adapter hidden inside provider |
| `patterns-children-over-render-props` | Mostly good; no render-prop APIs in editor | Keep preferring children (already done in dialog) |
| `patterns-explicit-variants` | Dither method uses conditional blocks | Extract `ThresholdControls`, `WhiteNoiseControls`, `BayerControls` components |

---

## React best practices — category checklist

### 1. Eliminating waterfalls — **needs work**

- [ ] Coalesce pipeline worker scheduling (see P0 #1)
- [x] Worker stale-response guards
- [ ] Parallel independent worker ops where safe

### 2. Bundle size — **good base, gaps on stages/3d**

- [x] Dynamic editor shell
- [ ] Dynamic stage imports
- [ ] Dynamic 3D scene module
- [x] Direct component imports

### 3. Server-side — **N/A / minimal app**

- [x] Metadata hoisted in layouts
- [ ] Scope client providers to editor routes only
- N/A Server Actions (none in app)

### 4. Client data fetching — **acceptable**

- N/A SWR (no remote client fetch in editor)
- [ ] Version localStorage schema

### 5. Re-render optimization — **primary improvement area**

- [ ] Context splitting / selectors
- [ ] `startTransition` on param updates
- [ ] `useDeferredValue` for previews
- [x] Functional setState in pipeline

### 6. Rendering performance — **mixed**

- [x] Passive scroll listeners
- [x] `useReducedMotion` in motion components
- [ ] Reuse offscreen canvas in PreviewCanvas
- [ ] Memoize heavy grid cells

### 7. JavaScript performance — **acceptable for image app**

- Worker handles CPU-heavy paths (good)
- Minor histogram max-loop opportunity

### 8. Advanced patterns — **partially applied**

- [x] Worker init once
- [ ] Event handler refs for pipeline coordinator callbacks invoked from effects

---

## Suggested improvement roadmap

### Phase 1 — Quick wins (1–2 days)

1. Move `PipelineProvider` to editor-only layout route group.
2. Add `STORAGE_VERSION` to pipeline localStorage read/write.
3. Reuse offscreen canvas ref in `PreviewCanvas`.
4. Remove or integrate `ChannelPreviewStage.tsx`.
5. Wrap slider-driven `updateTone` / `updateDownsize` / `updateDither` in `startTransition`.

### Phase 2 — Performance (3–5 days)

1. Split `PipelineContext` into state vs actions (or per-stage selectors).
2. Split worker context hooks by result type.
3. Dynamic-import stage panels; preload on nav hover.
4. Add `useDeferredValue` for tone/downsize/dither params feeding worker requests.
5. Memoize `DitherChannelCell` + isolate preview mode state.

### Phase 3 — Composition refactor (5+ days)

1. Extract `PipelinePreview.*` compound components from `EditorLayout`.
2. Extract dither method control variants from conditional blocks in `DitherStage`.
3. Optional: refactor `FloatingInsightCard` view modes into explicit variant components.
4. Dynamic-import `/3d` scene module; document WebGPU loading strategy.

### Phase 4 — Verification

1. Run `pnpm build` and compare route chunk sizes before/after.
2. Profile slider interaction in Performance panel (main thread blocking, long tasks).
3. Use existing `pnpm bench:cpu` / `pnpm bench:gpu` scripts after pipeline coordinator changes.

---

## Key file reference map

| File | Role | Primary rules |
|------|------|---------------|
| `src/app/HomeClient.tsx` | Editor entry, dynamic import | `bundle-dynamic-imports` ✓ |
| `src/app/layout.tsx` | Root providers | Scope providers narrower |
| `src/components/editor/EditorLayout.tsx` | Pipeline orchestration + preview | Waterfall, composition, transitions |
| `src/lib/pipeline-context.tsx` | App state + persistence | Context shape, localStorage schema |
| `src/lib/use-processing-worker.ts` | Worker protocol | ✓ Stale guards; split subscriptions |
| `src/components/core/morphing-dialog.tsx` | Compound component template | ✓ Reference pattern |
| `src/components/core/floating-insight-card.tsx` | Marketing UX overlay | Explicit variants (optional) |
| `src/app/3d/page.tsx` | WebGPU demo | Dynamic import, route isolation |
| `src/components/editor/PreviewCanvas.tsx` | Source frame extraction | Canvas reuse, debounce ✓ |

---

## Conclusion

tsl-dither already demonstrates strong instincts where this app is unique: **worker isolation**, **dynamic editor loading**, and **compound dialog composition**. The audit findings concentrate on scaling those patterns to the **pipeline orchestration layer** and **context boundaries** — the places where slider-driven editing will otherwise pay compounding re-render and latency costs as features grow.

Implement **Phase 1 + Phase 2** before adding new pipeline stages or 3D integration; that keeps the architecture ready for the TSL/WebGPU post-process path described in `FloatingProjectSummary` without entangling more state in `EditorLayout` effects.
