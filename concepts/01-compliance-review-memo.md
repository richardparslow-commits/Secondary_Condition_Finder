# Compliance Review Memo — Concept 1 Series
### The Digital Trap & The Prescription Audit · master, 1b, 1c (reflected)

**Status:** Draft for marketing compliance / legal review.
**Scope:** On-screen copy implications and external-use safety for the three rendered frames in
`concepts/01-digital-trap-prescription-audit.*`, `concepts/01b-audit-ledger.*`, and
`concepts/01c-reflected.*`.
**Not in scope:** The live product UI, which has its own disclaimer layer in
`src/components/Disclaimer.tsx` and `src/lib/legal/`. This memo is about the *creative frames*, not the app.

---

## 1. What the on-screen wording implies

The master frame and the reflected frame both show the same regulated-sounding interface copy on a
matte-black tablet screen:

- **Banner:** `ACCELERATED UW · TRIAGE v4.2`
- **Applicant identifier:** `APPLICANT #TX-4471`
- **Headline alert:** `ACCELERATED UNDERWRITING INELIGIBLE`
- **Prescription flag:** `PRESCRIPTION FLAG: CLOPIDOGREL / PLAVIX`
- **Rule chip:** `RULE CU-7712 · CARDIAC`
- **Audit rows:** NDC `63653-1171-6`, class `P2Y12 ANTIAGGREGATE · ADJUNCT POST-STENT`,
  source `PHARMACY CLAIMS (PDMP) 04/2026 · 3 REFILLS`, routing `CU-7712 · IMPAIRMENT-QUESTION ROUTING`,
  disposition `REFER TO FULL UNDERWRITING · 4.0 SEC`, escalation `CONTESTED · HUMAN AUDIT LEDGER REQUESTED`
- **Footer:** `Automated triage output. Not a final adverse action.`

Read at face value, that copy does three things at once:

1. **It asserts an adverse underwriting outcome** — `ACCELERATED UNDERWRITING INELIGIBLE` is the verbal
   equivalent of a declination letter or a triage flag. A reasonable viewer will read it as a real
   "you are ineligible" determination, not as a mood.
2. **It ties that outcome to a named medication** — `PRESCRIPTION FLAG: CLOPIDOGREL / PLAVIX`. That is the
   most sensitive line in the frame. Clopidogrel is an actual antiplatelet drug; pairing a named prescription
   with an "ineligible" disposition reads as "this person was declined because they take this drug."
3. **It adds a docket and an NDC** — rule number, pharmacy-claims source, NDC, days supply. Those make the
   frame look less like concept art and more like a real file. The fictional applicant ID `#TX-4471` helps
   only if it stays obviously fake; the rest of the line items do not.

The one protective line is the footer: `Automated triage output. Not a final adverse action.` That line does
real work. Without it, the headline alone implies a final disposition. With it, the frame can still be read
as "machine triage, not a decision" — but only if the footer is actually visible and legible in the delivered
image. In the reflected frame, that footer may be harder to see under the glass reflection, which is itself
a compliance issue for any use that leans on the wording.

The 1b ledger frame inverts this: its legible copy is the tooling (`UNDERWRITING AUDIT LEDGER`, `EXHIBIT A`,
NDC, rule number), and the screen wording is deliberately blurred/unreadable. That is a meaningfully different
compliance posture, discussed below.

---

## 2. What must be disclaimed before external use

Before any Concept 1 frame is used outside the internal creative pack, the following must be true and
clearly communicated:

- **No real applicant, no real determination.** The frame is a fictional vignette about a fictional applicant
  (`#TX-4471`) and a fictional automated triage output. It must not be presented or captioned in any way that
  implies a real person was declined, or that clopidogrel — or any actual medication — causes an
  "ineligible" result.
- **Not a final adverse action.** The `Automated triage output. Not a final adverse action.` footer must be
  present and legible in any published version that shows the alert text. If the footer is cropped, blurred, or
  otherwise not readable, the frame must not carry the "ineligible" copy at all.
- **Not underwriting guidance, not legal or medical guidance, not a product promise.** The image must not be
  used in a context that suggests the brand performs accelerated underwriting this way, makes decisions this
  fast, or uses this exact rule numbering / NDC / pharmacy-claims sourcing. The frame is concept art about a
  *type* of machine decision, not a depiction of the brand's actual process.
- **Medication is illustrative, not diagnostic.** Clopidogrel is shown as a narrative prop for the concept
  (a post-stent antiplatelet, "adjunct post-stent"). It is not being used to illustrate real medical guidance,
  and the frame must not be paired with copy that turns it into one.
- **Texas flag is a setting, not a claim.** The flag is part of the scene's visual language, not a statement
  about where, how, or whether this underwriting happens. Do not caption or surround the frame with anything that
  ties the depicted outcome to Texas, a specific state, or a specific flag code.
- **Marketing compliance sign-off required.** The exact wording, footer visibility, applicant ID treatment, and
  any surrounding caption or headline must be cleared by whoever owns marketing compliance before external use.
  This memo is a working note, not that sign-off.

---

## 3. Which frames are safe for external use

### Master frame (`01-digital-trap-prescription-audit`)

**Unsafe as-is for external use.** The master shows the full adverse wording — headline, prescription flag,
NDC, rule, disposition — under a clearly legible footer, which is the best case in the series, but it still
says "ACCELERATED UNDERWRITING INELIGIBLE" over a named drug. That is too on-the-nose for most external contexts
without review.

**Safe with conditions.** The frame can be made externally usable if the regulated copy is treated as
version-controlled composite type (as the pack already intends) and only the following configuration is published:

- applicant ID stays obviously fictional
- footer remains legible
- no surrounding copy implies a real person, a real medication-based decline, or the brand's actual process
- marketing compliance has cleared the exact wording and caption

Even then, prefer the master only where the concept needs the machine to *speak*.

### 1b — The Audit (ledger-forward)

**Safest frame in the series for external use, with one rule.** Because the screen copy is blurred/unreadable
and the only legible text is the ledger tooling, 1b does not say anything adverse out loud. The NDC and rule
number appear as tooling text, not as an on-screen decision, which substantially lowers the risk.

**Safe with conditions:**

- keep the screen wording unreadable in the delivered image (do not sharpen the blurred alert in post)
- do not caption the frame in a way that restates the master's "ineligible" result
- treat `UNDERWRITING AUDIT LEDGER`, `EXHIBIT A`, and the NDC/rule line as version-controlled tooling copy
- still get marketing compliance sign-off, because the frame is part of a series whose premise is an adverse
  automated triage

### 1c — Reflected (flag in the glass)

**Unsafe as-is for external use, and the highest-risk frame.** This frame shows the identical regulated wording
as the master, and places a reflection directly over the alert. That creates two problems:

1. The same adverse, medication-tied wording is on screen.
2. The reflection can reduce legibility of both the alert text and the protective footer. If the wording stops
   being readable at thumbnail size, the frame is no longer doing what it needs to do — and at the same time, if
   only *part* of the wording survives the reflection, you can end up with a frame that implies the adverse result
   without carrying the "not a final adverse action" qualifier in a readable way. That is the worst of both worlds.

**Safe only with conditions and review:**

- the final composite must be checked at thumbnail size: both the alert text and the footer must remain readable,
  or the frame must not be used with that copy
- if the reflection kills the footer, pull the on-screen wording and shoot the screen blank or abstract instead,
  then composite the exact copy in post under full control
- no variant ships where the screen implies a specific applicant was declined because they take clopidogrel
- marketing compliance must clear the wording and the reflection treatment specifically for this frame

---

## 4. Concrete remediation by frame

| Frame | Risk | Required remediation before external use |
|---|---|---|
| **Master (1)** | Full adverse headline + named drug + docket + NDC | Keep applicant ID fictional; keep footer legible; composite the exact copy in post, not from a generator; clear wording + caption with marketing compliance; do not use around any copy implying a real medication-based decline |
| **1b — Audit** | Lower risk; legible tooling text, blurred screen | Keep screen copy unreadable; version-control the ledger tooling text; do not caption to restate the "ineligible" result; still clear with marketing compliance |
| **1c — Reflected** | Same adverse wording as master, plus reduced legibility from the reflection | Re-check final composite at thumbnail size; if footer or headline is not readable, switch to a blank/abstract screen and composite copy in post; never ship a variant that implies a specific applicant was declined for clopidogrel; clear specifically with marketing compliance |

### General rules that apply to all three

- Generate screens with **no legible text** and composite the exact wording in post. This is already the
  recommended route in the prompt pack; make it a hard requirement for any externally used frame.
- Treat the on-screen copy as **regulated-sounding UI copy**, not as free art text. It is the part of the frame
  with the most compliance weight.
- Keep the **footer always legible** in any version that shows the alert headline. That line is the frame's
  main protection against being read as a real adverse action.
- Keep the **applicant ID obviously fictional** and do not give the applicant a real-sounding name, DOB, or any
  other identifying detail.
- **Do not editorialize around the flag or the medication.** The frame's story is "machine says no; human
  answers with a ledger." Keep external copy inside that boundary.

---

## 5. Bottom line

The series is built around an adverse automated underwriting outcome tied to a named prescription. That premise
is the whole point of the art, and it is also exactly what makes the frames compliance-sensitive externally.

- **1b is the only frame that is close to safe as-is**, because its screen wording is intentionally unreadable.
- **The master and the reflected frame are not safe as-is.** Both carry the same adverse, medication-specific
  wording; the reflected frame adds a legibility hazard on top.
- **External use of any frame requires:** fictional applicant treatment, a legible "not a final adverse action"
  footer wherever the alert text appears, version-controlled composite copy, no real-medication-decline framing,
  and marketing compliance clearance of the wording and caption.

If the goal is an externally publishable hero image without a compliance review cycle, the cleanest path is to
use 1b as-is and use the master/1c only with the screen shot blank or abstract, then composite the exact wording
under full control — or to pull the adverse wording entirely and let the crimson panel read as "an alert" rather
than as a specific "ineligible" verdict.
