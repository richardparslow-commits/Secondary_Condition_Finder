# Concept 1 — The Digital Trap & The Prescription Audit

**Production prompt pack.** Pair this with the rendered frame at
[01-digital-trap-prescription-audit.html](01-digital-trap-prescription-audit.html), which shows the intended
composition, tonal hierarchy and palette. Use the frame as an art-direction proof and layout reference; use the
prompts below to generate photographic variants.

Aspect: **16:10 master** (1600×1000). Deliver 1:1 and 9:16 crops from the same setup for social and mobile.
Camera height: table plane, slightly above, lens axis ~8° down so the screen face stays readable.

---

## The narrative in one line

An automated underwriting engine condemns an applicant in four seconds on the strength of a single prescription
line — and the human response to it is a hand-tooled ledger. The machine is bright, flat and certain. The leather
is warm, deep and disputed.

---

## Master prompt (model-agnostic, long form)

> Dramatic close-up product photograph on a hand-hewn dark Texas mesquite conference table, shallow depth of
> field. Foreground: a sleek matte-black tablet lying angled on the table with a brightly lit automated life
> insurance triage portal on screen, dominated by a stark crimson alert window. Resting across the edge of the
> tablet, half overlapping it, a heavy hand-tooled saddle-leather notebook embossed with a bold Texas Lone Star
> motif and crisp contrast stitching, with a rugged brass bolt-action pen lying in its spine. Background, in soft
> focus: a full-size vintage canvas Texas flag with weathered textured weave hanging against an exposed limestone
> brick wall. Shafts of warm late-afternoon Hill Country sunlight cut across the table from camera right,
> illuminating drifting dust motes and throwing deep rich amber reflections on the polished wood grain. Crisp
> modern digital technology colliding with rugged uncompromising Texas resilience; vivid contrast between the
> stark red warning on the screen and the timeless navy, white and red of the flag. Photorealistic, editorial
> product photography, 85mm macro, f/2, natural window light mixed with screen glow, fine film grain, no text
> legible on the screen.

## Midjourney dialect

```
dramatic close-up on a hand-hewn dark mesquite conference table, matte-black tablet angled on the wood
displaying a bright insurance triage portal with a stark crimson alert window, heavy hand-tooled saddle-leather
notebook with an embossed Texas Lone Star and contrast stitching resting across the tablet edge, rugged brass
bolt-action pen in the notebook spine, soft-focus background of a weathered vintage canvas Texas flag against
exposed limestone brick, warm late-afternoon Hill Country sun shafts, drifting dust motes, deep amber
reflections in the wood grain, modern technology against rugged Texas resilience --ar 16:10 --style raw
--stylize 250 --quality 2 --no text letters logos watermark
```

Vary with `--s 100` for a quieter, more restrained frame and `--s 400` for a poster-bright one. Add `--seed`
once you have a composition you want to reproduce across the series.

## DALL·E / GPT-image dialect (natural language)

> A dramatic close-up product photo on a dark, hand-hewn mesquite conference table, photographed with a shallow
> depth of field so the background is softly out of focus. A sleek matte-black tablet lies at a slight angle on
> the table, its screen glowing brightly with a modern automated underwriting portal; a bold crimson alert panel
> dominates the interface. A heavy saddle-leather notebook with a large embossed Texas Lone Star and contrast
> stitching rests across the edge of the tablet, and a rugged brass bolt-action pen lies in the notebook's spine.
> Behind, softly blurred, a vintage canvas Texas flag hangs on an exposed limestone brick wall. Warm
> late-afternoon sunlight slants across the table, catching dust in the air and throwing amber reflections across
> the polished wood. The mood is crisp modern technology meeting rugged Texas resilience. Photorealistic
> editorial photography, 85mm lens, f/2, no readable text anywhere in the image.

## Stable Diffusion / SDXL dialect

Prompt (front-load the subject, then the light, then the mood) plus:

```
Negative: text, letters, words, watermark, signature, logo, garbled UI, extra fingers, floating objects,
double pen, warped tablet bezel, fisheye distortion, plastic sheen, hdr halo, over-sharpened, cgi render,
flat lighting, cluttered background, oversaturated red
```

Settings: 1344×840 native, steps 36–48, CFG 5–6.5, sampler DPM++ 2M Karras, then upscale. Add a
leather/canvas LoRA only if it does not flatten the wood grain.

---

## Text handling: the decision that matters most

Generators reliably garble typography, and the two lines this concept depends on are:

```
ACCELERATED UNDERWRITING INELIGIBLE
PRESCRIPTION FLAG: CLOPIDOGREL / PLAVIX
```

Two routes:

1. **Composite in post (recommended for anything published).** Generate the frame with *no* legible text —
   `no text` in the negative, and prompt the screen only as "a bright software interface with a red alert panel."
   Then set the type yourself over the screen quadrilateral in Photoshop, Figma or After Effects. This keeps the
   exact wording under version control, lets you match any brand's UI kit, and removes the retouching tell of a
   slightly wrong glyph. The HTML frame in this folder is built the same way: the screen is a drawn UI, so the
   copy is editable text rather than pixels.
2. **Prompt the text directly** only for quick explorations and moodboards, accepting that it will need repair.

**Compliance note.** "Accelerated underwriting ineligible" over a named prescription reads as a real adverse
underwriting determination about a real person's medication. If this image is used externally, keep the mock
applicant identifier obviously fictional (as drawn: `#TX-4471`), retain the "not a final adverse action" line on
the interface, and have the wording cleared by whoever owns marketing compliance. Do not ship a variant where the
screen implies a specific applicant was declined because they take clopidogrel.

---

## Variants for the series

| Ref | Framing | Purpose |
|---|---|---|
| 1 | Master: tablet dominant, notebook across its edge, flag soft behind | Hero, web masthead, slide opener |
| 1a | Tight macro on the crimson alert only, bezel cropped out, leather edge intruding | Thumbnail-proof social crop; pairs with a one-line claim |
| 1b | Notebook-forward, tablet demoted to out-of-focus glow behind | The "audit" beat; quiet, premium, human |
| 1c | Flag and limestone dominant, table as a warm horizon with the tablet small and far | The "Texas" beat; wide establishing frame |
| 1d | Overhead flat-lay: tablet, ledger, pen, and a printed prescription trace arranged as an exhibit | Print, one-pager, document header |
| 1e | Same master at blue hour: screen only light source, flag desaturated | Dark-mode/technical variant of the same story |

## Materials and light, for whoever shoots this

- **Mesquite**: quarter-sawn, oiled not lacquered — you need sheen, not varnish. Ask for visible knots and
  hairline checks; a flawless board kills the concept.
- **Leather**: 4–5mm vegetable-tanned saddle leather, hand-tooled Lone Star, saddle-stitched at 6–7 stitches per
  inch with waxed linen thread in cream or natural. The stitching must be *contrast*, so no tonal monofilament.
- **Pen**: one solid brass bolt-action body, tumbled or lightly aged. Not chrome, not brushed steel — the metal
  has to sit in the same warm family as the wood and the thread.
- **Flag**: actual cotton or hemp canvas with a visible weave and sun-fading; avoid a polyester flag, which will
  flare and read as plastic under raking sun.
- **Light**: one hard source, low and raking, plus a silver card at camera left for the leather. Let the screen
  bounce a cool rim onto the notebook's top edge — that cool/warm boundary is what sells "technology meets Texas".
- **Air**: real dust in a real beam beats a particle pass. If you add motes in post, keep them inside the shafts
  and slightly out of focus; minted specks that stay sharp read as damage.
