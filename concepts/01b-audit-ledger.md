# Concept 1b — The Audit (prompt pack)

Frame 1b of Concept 1. Read alongside [01b-audit-ledger.html](01b-audit-ledger.html) (the rendered frame) and
[01-digital-trap-prescription-audit.md](01-digital-trap-prescription-audit.md) (materials, shoot notes and the
master frame's prompts — those still apply here).

**Aspect:** 16:10 master (1600×1000). Crop matches the master frame exactly so the two can be cut together.

The frame's job in one line: the machine has already spoken; this is the hand reaching for the pen. Camera in and
down on the ledger, the tablet demoted to a cold glowing slab behind it.

---

## Continuity rules across the series

Keep identical between 1 and 1b or the pair will not cut together:

- Same table, same board — quarter-sawn oiled mesquite, same two knots visible in the lower third.
- Same three props in the same physical relationship: tablet mid-table, ledger overlapping its near edge, pen in
  the ledger's spine groove.
- Same palette anchors: `#C8102E` alert red, `#002868` flag navy, `#E6A549` late-afternoon amber, `#B98A3C` brass.
- Same red discipline: exactly one crimson event besides the ribbon. If a second red appears, the frame is wrong.

Change only these: camera distance and height, light direction, and which copy is legible.

## Master prompt (model-agnostic, long form)

> Extreme close-up of a heavy hand-tooled saddle-leather audit ledger lying on a dark hand-hewn mesquite
> conference table, shot with a shallow depth of field. A large Texas Lone Star is embossed into the leather and
> reads in relief under a hard raking shaft of late-afternoon sunlight coming from camera left at a low angle;
> crisp contrasting cream saddle stitching runs along the tooled border and a rugged brass bolt-action pen lies
> sharp in the notebook's spine, its bolt handle catching a specular highlight. Behind it, far out of focus, a
> sleek matte-black tablet lies angled on the table, its screen glowing cold and washing the wood with a pale blue
> spill, a crimson alert panel reduced to a soft red shape. In the defocused background a vintage canvas Texas
> flag with weathered weave hangs against an exposed limestone brick wall, dim and desaturated. Dust motes drift
> in the shaft of light. Warm amber and deep leather browns dominate; the only cold things in frame are the
> screen and its spill. Photorealistic editorial macro photography, 100mm macro lens at f/2.8, single hard light
> source, fine film grain, no legible text on the screen.

## Midjourney dialect

```
extreme close-up hand-tooled saddle-leather audit ledger on dark mesquite table, large embossed Texas Lone Star
reading in raking relief, contrast cream saddle stitching, rugged brass bolt-action pen sharp in the spine,
hard low raking sunlight from camera left, drifting dust motes, out-of-focus matte-black tablet glowing cold pale
blue behind with a soft red alert panel, defocused weathered canvas Texas flag on limestone brick wall in the dim
background, warm amber and deep leather browns against one cold screen glow --ar 16:10 --style raw --stylize 200
--no text letters logos watermark
```

To keep the pair visually consistent, reuse the master frame's seed and change only the camera and light
phrasing.

## DALL·E / GPT-image dialect (natural language)

> A photorealistic extreme close-up of a heavy hand-tooled saddle-leather notebook on a dark, hand-hewn mesquite
> table. A large Texas Lone Star is embossed into the leather, and a hard, low shaft of late-afternoon sunlight
> rakes across it from the left so the embossing stands out in relief; cream contrast stitching follows the
> tooled border, and a rugged brass bolt-action pen lies in the notebook's spine, catching the light. Well behind
> it and heavily out of focus, a matte-black tablet lies on the table with a cold glowing screen and a soft red
> alert panel, spilling pale blue light onto the wood. In the blurry background a weathered canvas Texas flag
> hangs on a limestone brick wall, dim and desaturated. Dust drifts in the beam. Warm leather browns and amber
> dominate, with the screen as the only cool light. 100mm macro, f/2.8, no readable text anywhere.

## Stable Diffusion / SDXL dialect

```
Negative: text, letters, words, watermark, signature, logo, garbled embossing, duplicated stitching, floating
pen, two pens, plastic leather, glossy vinyl, hdr halo, cgi render, flat frontal light, over-sharpened,
saturated background, extra red objects
```

Settings: 1344×840, steps 40, CFG 6, DPM++ 2M Karras, then upscale. Leather LoRAs tend to flatten the emboss —
check that the star still casts its own shadow before accepting a result.

---

## Text handling, inverted from the master

In this frame the **legible** copy is the tooling on the leather, not the screen:

```
UNDERWRITING AUDIT LEDGER
EXHIBIT A · PRESCRIPTION TRACE · 04/2026
NDC 63653-1171-6 · RULE CU-7712 · 90-DAY SUPPLY
```

Treat it the same way as the master treats the alert: generate the leather with *no* lettering at all (a clean
embossed star and a tooled border), then composite the tooling type in post as a worn, low-contrast impression —
slightly blurred, sitting *in* the leather rather than on top of it, with the emboss pair (dark copy offset down
and right, light copy offset up and left) doing the relief work. Faux emboss that does not follow the raking
light direction is the single most common tell in these frames.

Keep the screen copy out of this frame entirely, or keep it unreadable. This is the "human answers the machine"
beat, and a readable verdict on the screen turns it back into the master frame.

**Compliance note.** Unchanged from the master: if the wording is published, keep the applicant identifier
obviously fictional, retain the "not a final adverse action" line on any interface shown, and have the copy
cleared by whoever owns marketing compliance.

## Related frames

| Ref | Relationship to 1b |
|---|---|
| 1 | The other half of the pair — verdict lands, machine dominant |
| 1b-close | Tighter still: star emboss only, pen excluded, for texture and pattern use |
| 1b-open | Same camera, ledger opened to a ruled page with a handwritten entry — the audit *in progress* |
| 1b-overhead | Flat-lay of the open ledger, pen, and the printed prescription trace as an exhibit sheet |
