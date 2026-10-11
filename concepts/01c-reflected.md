# Concept 1c — Reflected (prompt pack)

Third frame of Concept 1. Rendered frame: [01c-reflected.html](01c-reflected.html). Materials, palette anchors and
the master text-safety rule live in [01-digital-trap-prescription-audit.md](01-digital-trap-prescription-audit.md);
continuity rules and the pair logic in [01b-audit-ledger.md](01b-audit-ledger.md). This pack covers only what is
new: the reflection.

**Aspect:** 16:10 master (1600×1000), matching the other frames for cutting.

The frame's job in one line: the machine contains the state. Shot close and raked across the panel, the Texas flag
and the window are mirrored in the glass, so the woven red of the flag sits directly against the emissive crimson
of the alert.

---

## Why this frame exists

The brief asks for "vivid contrast between the stark red warning on the screen and the timeless navy, white, and
red tones of the flag." Frames 1 and 1b hold those two colours apart at a distance. This frame puts them on one
surface, in contact, and lets the viewer work out that they are different materials: one emissive, cold-edged and
four seconds old; the other sun-warmed, woven and older than the state's own flag code. That is the whole reason
to shoot this angle.

## Master prompt (model-agnostic, long form)

> Extreme close-up of a sleek matte-black tablet lying at a raking angle on a dark hand-hewn mesquite conference
> table, shot with a shallow depth of field so that only the tablet's screen plane is sharp. The glossy screen
> displays an automated insurance underwriting triage portal with a large stark crimson alert panel, and across
> the glass lies a soft, bright reflection of a full-size vintage canvas Texas flag and a shaft of late-afternoon
> window light — the flag's woven red stripe and reflected canvas white sitting directly against the emissive red
> of the alert, clearly two different materials. A bright window streak cuts diagonally across the panel with a
> warm bloom. In the near foreground, out of focus, the edge of a heavy hand-tooled saddle-leather notebook with
> cream contrast stitching crosses the bottom of the frame, and a rugged brass bolt-action pen lies across it.
> Beyond the device's far edge, defocused, exposed limestone brick and the real flag against the wall, with
> drifting dust motes in the shafts. Photorealistic editorial macro photography, 60mm macro at f/2.8, one hard
> raking light source, fine film grain, no legible text on the screen.

## Midjourney dialect

```
extreme close-up matte-black tablet at a raking angle on a dark mesquite table, glossy screen showing an
insurance triage portal with a big crimson alert panel, soft bright reflection of a vintage canvas Texas flag and
a window shaft lying across the glass so the flag's woven red sits against the emissive red alert, bright warm
window streak and bloom on the panel, near-foreground out-of-focus saddle-leather notebook edge with cream
stitching and a brass bolt-action pen, defocused limestone brick and Texas flag beyond the device, drifting dust
motes --ar 16:10 --style raw --stylize 220 --no text letters logos watermark
```

## DALL·E / GPT-image dialect (natural language)

> A photorealistic extreme close-up of a matte-black tablet at a raking angle on a dark wooden table, with a
> shallow depth of field so only the screen is in focus. The tablet shows an insurance underwriting portal with a
> large crimson alert panel, and reflected in the glossy screen is a vintage canvas Texas flag with a soft bright
> window shaft crossing it — the flag's woven red and the alert's glowing red sit right next to each other and
> look like different materials. Out of focus in the near foreground, the edge of a hand-tooled leather notebook
> with cream stitching and a brass bolt-action pen. Beyond the tablet, blurred limestone brick wall and the real
> flag, with dust in the light. No readable text anywhere.

## Stable Diffusion / SDXL dialect

```
Negative: text, letters, words, watermark, signature, logo, garbled reflection, mirror-perfect reflection,
doubled flag, floating pen, plastic sheen, polarised screen, crushed blacks, hdr halo, extra red objects
```

Settings: 1344×840, steps 40, CFG 6, DPM++ 2M Karras, upscale after. Reflection realism lives or dies on the
softness — if the reflected flag is as sharp as the flag itself, the render reads as a double exposure.

---

## Getting this in camera, not in post

The reflection is a lighting problem before it is a framing one.

- **Angle first.** The flag only appears in the glass once the lens axis drops low enough that the flag falls
  inside the panel's specular lobe. About 10–15° off the glass is the working range; expect to move the flag, not
  the camera, to place the white and red bands where you want them relative to the alert.
- **Light the flag hotter than looks right.** A mirror only reflects what is lit. On set the flag should read
  roughly two stops too bright; the panel's reflectance takes most of it back.
- **No polariser.** A polarising filter removes exactly the reflection this frame exists for. Control glare with
  screen brightness and a black card behind the camera instead.
- **Keep the UI legible through it.** The reflection must sit over the alert without destroying its contrast, so
  the reflected canvas white should land above and beside the banner rather than across the words, or be graded
  down in the reflection pass.
- **Black out the room behind the lens.** Every bright thing behind the camera shows up in the panel. Matte black
  board, and a dim room, or you will be retouching reflections out instead of placing them.

## Compositing order

If you build it in post rather than on set, the stack is:

1. Panel base colour and the portal UI (chrome, chips, audit rows).
2. Alert banner and its text — the regulated wording, exactly as in the master.
3. Reflection pass: reflected flag bands and star, then the window streak, both inside the screen clip, both
   blurred 1.5–2px, both below the remaining type in the stack so the copy keeps contrast.
4. Glass layer: sheen gradient, faint smudge ellipses, one hard specular highlight.
5. Foreground: notebook edge and pen, heavily defocused.
6. Grade: warm the table, let the panel stay cool, and keep exactly two saturated reds in frame.

**Compliance note.** Unchanged from the master: the two on-screen lines are the same regulated wording, so keep
the applicant identifier obviously fictional and retain the "not a final adverse action" line. Because this frame
shows those words under a reflection, check the final composite at thumbnail size before publishing — if the copy
stops being readable, the frame no longer says what it needs to say.
