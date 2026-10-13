# Roadmap — multi-app dither, layered V2

The flat V1 pipeline is powerful, but one dither method over the whole image does not match what people want from photos like the saturated landscape sample: busy dark foliage can keep noisy RGB artifacts; sky and cloud fields should stay hue-pure and stable.

Do **not** reshape the current pipeline in place. Freeze it as V1. Ship new apps beside it.

## Product shape

Landing page becomes a **grid of apps**. Each cell is a different aesthetic contract, not a mode toggle inside one editor.

| App | Role |
| --- | --- |
| **V1 — Flat 2D** | Current load → downsize → tone → white-noise RGB dither → export. Untouched. |
| **V2 — Layers** | Hard labels for sky / cloud / foreground. Fitted single-colour sky lightness gradient + Bayer; fg white-noise. |
| **V3 — Palette** | Same sky/fg layers, but dither into a target palette (ordered or noise). Strength 0 = hard nearest snap. |
| Later | 3D / TSL post, print, more recipes |

Shared libraries (dither kernels, tone ops, worker plumbing) are fine. App UX and pipeline state stay separate.

## V2 goal: better first pass

Optimize for a strong default on typical photo → dither use, especially landscapes with a clear sky.

Constraints:

1. **Hard edges only.** Every pixel is exactly one label. Soft mattes can wait. The compositor needs a decisive answer: which dither method owns this pixel?
2. **Three hard labels:** `sky`, `cloud`, `fg`. (Earlier five-label / bg-fg splits are superseded.)
3. Segmentation comes from **in-browser SegFormer-B0 ADE20K** (Transformers.js). Only the ADE `sky` class becomes sky; everything else is `fg`. Luminance threshold is fallback only when the model fails.

### Sky assumption (segregation models)

Treat sky as the ADE `sky` class, then keep only the component connected to the top edge. Clouds are derived from sky pixels whose luminance sits above the fitted plane residual threshold — not a separate ADE class.

## Processing recipes

| Label | Source treatment | Dither |
| --- | --- | --- |
| **`sky`** | One mean sky colour + **lightness-only** plane (`L = a + b·x + g·y`); colour scaled to that luma | Ordered **Bayer** on the fitted field |
| **`cloud`** | Keep source pixels | Ordered **Bayer** |
| **`fg`** | Keep source pixels | Default: **white-noise** RGB |

### Why this split

- White-noise RGB on foliage: green dots in dark structure read as depth / lidar texture.
- Same noise on sky or pure cloud: wrong hues appear (green in blue sky, green in warm cloud).
- Replacing `sky` with a single-colour lightness gradient, then Bayer-dithering that field, keeps sky as stable hue dots only.
- Bayer on cloud keeps ordered, hue-stable texture.

## Suggested build order

1. **Landing grid** — done. `/` is the app grid; V1 lives at `/v1`; V2 card gated at `/v2`.
2. **V2 shell** — done. Import image, hard labels, brush paint.
3. **Per-label dither** — done. Multi-layer composite by hard labels.
4. **`sky` linear fit** — done. Mean sky colour + lightness plane; Bayer the field; residual cloud split.
5. **Auto mask** — done. SegFormer-B0 ADE20K in a worker; top-connected sky; luminance fallback.
6. **Cloud recipe** — done. Cloud is its own hard label with Bayer.
7. **Presets / tone** — per-label tone controls once the first-pass look locks in.

Prove the look on `public/samples/saturated-abstract-landscape.png` before chasing model quality.

## Non-goals (for now)

- Soft alpha between layers
- Reworking or “improving” V1 in situ
- Requiring a network API for the first good V2 pass (browser model preferred; API optional later)
- Perfect ADE classes beyond sky vs everything else

## Open questions

- Whether a larger SegFormer (B1/B2) is worth the download on first visit
- Gradient blend vs pure fitted field as the default sky look
- Whether V2 starts as `/v2` route or a separate app entry in the monorepo sense (same Next app, different route, is enough)
