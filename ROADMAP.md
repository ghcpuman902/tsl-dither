# Roadmap — multi-app dither, layered V2

The flat V1 pipeline is powerful, but one dither method over the whole image does not match what people want from photos like the saturated landscape sample: busy dark foliage can keep noisy RGB artifacts; sky and cloud fields should stay hue-pure and stable.

Do **not** reshape the current pipeline in place. Freeze it as V1. Ship new apps beside it.

## Product shape

Landing page becomes a **grid of apps**. Each cell is a different aesthetic contract, not a mode toggle inside one editor.

| App | Role |
| --- | --- |
| **V1 — Flat 2D** | Current load → downsize → tone → white-noise RGB dither → export. Untouched. |
| **V2 — BG / FG** | Hard pixel labels, then different recipes per label. First target for “better first pass.” |
| Later | 3D / TSL post, print, more recipes |

Shared libraries (dither kernels, tone ops, worker plumbing) are fine. App UX and pipeline state stay separate.

## V2 goal: better first pass

Optimize for a strong default on typical photo → dither use, especially landscapes with a clear sky.

Constraints:

1. **Hard edges only.** Every pixel is exactly one label. Soft mattes can wait. The compositor needs a decisive answer: which dither method owns this pixel?
2. **Two labels: `bg` and `fg`.** No third “cloud” layer type.
3. Segmentation may come from **depth or semantic segregation**. Either is fine if the output is a pixel-hard mask.

### Sky assumption (segregation models)

If the model is semantic / region-based rather than depth, treat sky as the region that includes a **top-left or top-right** seed pixel and extends downward through contiguous sky-class (or similar) pixels. That is the `bg` region. Everything else is `fg`.

Depth-based splits can threshold far / near into the same two labels; still snap to hard pixels before dither.

## Processing recipes

| Label | Source treatment | Dither |
| --- | --- | --- |
| **`bg`** | Auto **linear gradient fit** from the masked sky pixels (prefer **2 stops**; allow more later if needed) | Ordered **Bayer** on the fitted field |
| **`fg`** | Keep source pixels (tone as needed) | Default: **white-noise threshold** per RGB channel (current V1 look) |

Clouds are **not** a separate label. They stay in `fg`. For cloud-like `fg` regions we want **ordered Bayer** instead of white-noise, so you do not get green channel speckles in white / red / orange cloud fields. Subject `fg` (trees, ground, complex dark detail) keeps white-noise so the noisy RGB artifact remains.

So: two mask labels, but `fg` may use more than one dither recipe (subject vs cloud-like). How we distinguish cloud-like `fg` from subject `fg` is an open implementation detail (second pass, luminance/chroma heuristic, user paint, or a finer model class collapsed into `fg` with a recipe flag). It must not become a third soft layer in the compositor.

### Why this split

- White-noise RGB on foliage: green dots in dark structure read as depth / lidar texture.
- Same noise on sky or pure cloud: wrong hues appear (green in blue sky, green in warm cloud).
- Replacing `bg` with a fitted gradient, then Bayer-dithering that gradient, keeps sky as stable blue (or sunset) dots only.
- Bayer on cloud `fg` keeps ordered, hue-stable texture without inventing a full third pipeline stage.

## Suggested build order

1. **Landing grid** — V1 card points at the existing editor; V2 card can be stubbed or gated.
2. **V2 shell** — import image, show hard `bg`/`fg` mask (manual paint or threshold is enough to prove compositing).
3. **Per-label dither** — `fg` → white-noise; `bg` → identity or flat color + Bayer first, then gradient fit.
4. **`bg` linear fit** — sample masked sky, fit 2-stop linear gradient (axis from image or from mask), Bayer the result, composite over `fg`.
5. **Auto mask** — depth or segregation → hard labels; segregation path uses top-corner sky seed.
6. **Cloud-like `fg` recipe** — Bayer on those pixels; leave subject `fg` on white-noise.
7. **Presets / tone** — per-label tone controls once the first-pass look locks in.

Prove the look on `public/samples/saturated-abstract-landscape.png` before chasing model quality.

## Non-goals (for now)

- Soft alpha between layers
- Reworking or “improving” V1 in situ
- Requiring a network API for the first good V2 pass (browser model preferred; API optional later)
- Perfect semantic classes beyond what we need to assign `bg` vs `fg` (+ cloud-like recipe inside `fg`)

## Open questions

- Depth vs segregation for the default auto mask on mobile-class hardware
- Exact rule that marks cloud-like `fg` vs subject `fg` without a third label
- Gradient axis: vertical only vs fitted angle from sky mask
- Whether V2 starts as `/v2` route or a separate app entry in the monorepo sense (same Next app, different route, is enough)
