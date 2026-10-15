# Digest-ineligibility policy — the citation-decay ratchet and issue #518

**Status: APPLIED (repository side), 2026-10-14.** This record decides *what the decay audit measures*. It records no verification decision, changes no reference, no source entity, no mapping, and no pin that a qualified human owns — and it moves no count other than the one this gate's own metric is derived from.

Related: `docs/citation-verification-sop.md` ("Content digests and tiered staleness"), `docs/citation-digest-ineligible-classes.json` (the register), `scripts/audit-citation-decay.js`, `.github/workflows/citation-decay-watch.yml`, issue [#518](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/518).

## The defect this closes

The scheduled `citation-decay-watch` run of 2026-10-05 opened tracking issue #518 with:

| metric | count |
| --- | --- |
| link rot | 0 |
| content drift | 0 |
| stale | 0 |
| ceiling usage (link rot + stale + drift) | 0/10 |
| verified refs awaiting a digest | **398/398 (ratchet 383)** |

Nothing had decayed. The gate failed on one line: an observability ratchet — `MAX_UNDIGESTED_VERIFIED_REFS = 383` in `scripts/audit-citation-decay.js` — whose population could not be reduced by any human action and grew with every legitimate verification batch. The issue therefore asked a qualified human to re-verify references that were not decayed, which is the failure mode it was meant to detect.

## Why the population could not be reduced

A `contentDigest` is anchored to the reference's `sourceUrl` and is checked later by **re-fetching that URL** and comparing sha256. Measurement of the live corpus on 2026-10-14 (398 verified references with a `sourceUrl`):

| host | verified references |
| --- | --- |
| `pubmed.ncbi.nlm.nih.gov` | 392 |
| `www.law.cornell.edu` | 4 |
| `academic.oup.com` | 1 |
| `www.ecfr.gov` | 1 |

Two fetches of the same PubMed record page, seconds apart, with the audit's user agent:

```
fetch1: HTTP 203 len 5590 sha 059b4d20a6dd
fetch2: HTTP 203 len 5590 sha 1149e5c12330
first differing offset: 1254 (of 5590), 22 differing bytes
region: <script> const challengeId = "<per-request token>"; const challengeDomain = "pubmed.ncbi.nlm.nih." …
```

The probe is served an **anti-bot interstitial** carrying a per-request `challengeId`, not the record page. A digest recorded against such a URL could never validate: it would report content drift on every run. `docs/citation-verification-sop.md` already forbids exactly that ("Dynamic pages whose body changes per fetch … must not receive a digest; omit it rather than record a value that will false-positive"), which is why every batch since 92 landed its verifications with the digest deliberately omitted and disclosed.

So the gate held two rules that cannot both be satisfied: **record no digest for these URLs** and **make this population shrink below 383**. 392 of 398 verified references sat in the first rule. The earlier qualified-human decision of 2026-09-29 accepted the flagged state on the record and named the options for a future policy session — an SOP amendment for efetch-anchored digests, or a justified change to what the ratchet measures. This is that session, taking the second option in its narrowest form.

One further reference, on a bot-walled publisher host (`academic.oup.com`, HTTP 403 to both HEAD and GET, refusal bodies not byte-identical), is the same kind of case from the other direction: the probe never obtains a comparable body, so a digest there is inert — the mismatch check cannot run at all.

## The decision

**The ratchet measures the digest-eligible backlog, and ineligibility is declared per measured class.**

1. **`MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS = 5`** replaces the corpus-wide pin. It is the measured count of verified references on eligible URLs that predate this mechanism (four `www.law.cornell.edu` CFR pages, one `www.ecfr.gov` section) — references a qualified human *can* digest, so the number has a path down.
2. **`docs/citation-digest-ineligible-classes.json`** declares the excluded URL classes. Each class records the ineligibility kind, the reason, and the measurement behind it: observed date, method, the URL fetched, and what was observed (status, byte length and sha256 across two fetches). The register also carries a review window (180 days, expiring 2027-04-12), the SOP paragraph it implements, and the reviewer. It lives under `docs/` rather than `data/` deliberately: `dataSnapshot()` in `scripts/catalog-identity-admission.ts` binds **every** file under `data/`, so a register placed there would invalidate the recorded baseline of the pending chronic-pain identity admission (`docs/catalog-admissions/chronic-pain-review-v2/owner-decision.json`) — an owner decision this change must not disturb — for a file no runtime code reads. It joins the other reviewed registers read by gate scripts (`docs/dependency-advisory-disposition.json`, `docs/mapping-coverage-ledger.json`, `docs/crg-adjacency-governance-ledger.json`).
3. **The audit fails closed.** A register that is missing, unreadable, malformed, or past its review window fails the run. It never falls back to "nothing is ineligible" (which would rebuild the impossible backlog) or "everything is ineligible" (which would hide the backlog).
4. **Both populations are disclosed, everywhere.** The report carries `digestEligibleWithoutDigestCount`, `digestIneligibleWithoutDigestCount`, `digestIneligibleByClass`, `digestEligibleReferenceCount`, the corpus-wide `verifiedWithoutDigestCount`, and two coverage figures — corpus-wide and against the achievable (eligible) population. The weekly step summary and the tracking-issue body both print the split **with the register's review and expiry dates**, so an exclusion can never be a count nobody can see or a measurement nobody can re-date.
5. **The anchor regression check is unchanged and louder.** The ratchet still fails on growth: a `verified: true` reference on a digest-eligible URL without a digest fails the audit, and the failure text now names the register file so a reader can tell a *missing* digest from an *impossible* one.
6. **The tracking issue closes itself.** The workflow now maintains the issue in both directions: it opens or updates it when the probe fails and closes it when a scheduled run is green, so a resolved signal cannot leave a stale request for human work behind (the pattern the scheduled dependency audit already uses).

## What this does not do

- **It records no digest and verifies nothing.** No `contentDigest` was added, and no reference, source, mapping, verification state, or publication state changed. The verification decision remains the qualified human's under the SOP.
- **It raises no pin to accommodate debt.** The eligible pin is *tighter* than the corpus-wide one it replaces: it permits zero growth on eligible hosts rather than headroom, and it is checked against the live corpus by `tests/citation-digest-ineligibility-register.test.ts`, so it can be neither slack nor overflowing.
- **It does not claim drift detection the probe does not have.** Corpus-wide coverage remains 0%, and the report says so on both surfaces. What changed is that the number is now paired with how much of it is achievable at all.
- **It does not make the excluded references safe from decay.** A dynamic page can still change under a claim; the SOP's staleness tier and a qualified human's re-check remain the control for it. The exclusion is about *digest coverage*, not about decay risk.
- **It does not close #518 as a medical or verification matter.** The issue was opened by a probe that failed on a signal it could never clear; with this change a green run closes it automatically, and the underlying gap it disclosed — that PubMed record pages are not drift-detectable through this mechanism — is recorded here rather than resolved.

## Enforcement

| Surface | What it enforces |
| --- | --- |
| `scripts/audit-citation-decay.js` | classification, the eligible ratchet, register schema validation, register expiry, and the disclosed counts |
| `tests/citation-drift-observability.test.ts` | the ratchet is tight, a declared ineligible population never trips it, and an unusable or expired register fails closed |
| `tests/citation-digest-ineligibility-register.test.ts` | the register carries real measurements, cites an existing policy record, covers the live corpus exactly, and the pin equals the live eligible backlog |
| `.github/workflows/citation-decay-watch.yml` | both human-facing surfaces print the split and the register dates; the tracking issue opens on failure and closes on green |
| `tests/decay-watch-artifact-handoff.test.ts` | those fields and that open/close behaviour cannot silently return to a single undifferentiated "awaiting a digest" number |

## Standing follow-ups (not done here)

- **Anchor digests to a fetchable body.** The 2026-09-29 record's other option remains available: an SOP amendment allowing a digest anchored to a *stable* body for the same claim (NCBI efetch XML for a PMID, or the PMC full text where one exists) rather than the record page. That would make drift detection real for the largest part of the corpus, but it changes the verification protocol and cannot be backfilled — the 392 references would still need qualified-human re-verification to carry one.
- **Work the eligible pin down.** Five references sit on stable, fetchable hosts. Recording a digest for any of them at the SOP's step lets the pin be lowered, and the register test fails loudly if a digest is recorded without lowering it.
- **Re-measure the register before 2027-04-12.** If PubMed stops serving the interstitial to this probe, or the publisher's bot wall changes, the excluded class is wrong and the audit fails until it is re-observed.

## Closure record (2026-10-15) — issue #518 closed on a green run

The tracking issue this record was written to resolve is closed. Two things had to be true, and one run measured both.

1. **The ratchet no longer fails on a population no human can move.** The report reads `digestEligibleWithoutDigestCount: 5` against `MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS: 5` — at the pin, not over it — with 393 of 398 undigested references inside the declared, measured digest-ineligible class (register reviewed 2026-10-14, expiring 2027-04-12, `expired: false`, `issues: []`).
2. **Nothing had decayed.** `linkRotCount`, `contentDriftCount` and `staleCount` are all `0`, the `decayed`, `contentDrift` and `stale` arrays are empty, and ceiling usage is `0/10`.

**Evidence.** A real dispatch of `citation-decay-watch` on `main` at `f5cee6e5`: [run 38765411435](https://github.com/richardparslow-commits/Secondary_Condition_Finder/actions/runs/38765411435) — `decay-probe` success in 8 m 29 s, `track-decay` success, artifact `citation-decay-report-38765411435`. Its coverage is stated rather than implied: **40.1%**, because 597 of 1,487 probed URLs produced a verdict while 890 could not be verified by the probe — 1,031 references throttled or skipped after a host cool-down, plus 1 bot-walled host. "No link rot" is therefore a claim about those 597 URLs and the 1,704 live references of that sweep, not about the corpus as a whole; the throttled population is disclosed as *not checked*, which is the distinction `docs/citation-decay-probe-outcome-policy-2026-10-14.md` introduced. `unverifiedCount` stays `1306`, re-verification debt that `citations:audit` ratchets and this gate does not.

**Why it took ten days to close.** The cause of the failure was fixed on 2026-10-14, but the closure is automatic and needs a green *run*, and neither run in between produced one: the 2026-10-12 scheduled run was cancelled after **20 m 20 s** against that run's 20-minute job budget, and `track-decay` was skipped with it. The budget is 60 minutes now, and this dispatch is the first `citation-decay-watch` run to complete since the fixes landed. The close path itself had a defect, fixed the same day: it left the *failure* body in place, so a closed issue showed the failing table beside a `completed` state — and #518's body carried the sentence "is not auto-closed". A green run now restates the body from its own report before closing, and says that a later failure opens a new tracking issue rather than promising a reopen the `--state open` lookup cannot perform.

**What this closure does not claim.** No reference was re-verified, withdrawn, digested or promoted by closing it, and the eligible pin was not lowered: the five digest-eligible references on stable hosts still await a qualified human's digest, and recording one is what would let the pin come down. The gap #518 disclosed — that PubMed record pages are not drift-detectable through this mechanism — is unchanged and stays a standing follow-up above.
