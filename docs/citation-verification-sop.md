# Citation Verification SOP

This SOP governs citation review for the knowledge base and condition catalog and is the operational gate for Phase 3.

## Scope

It applies to every citation in `data/knowledge-base/`, every rating-schedule reference in `data/conditions/`, and every pull request that adds or changes citation text, regulatory references, source metadata, verification state, or verified-citation retirement provenance.

## Required workflow

1. **Identify the claim.** Record the exact clinical/legal proposition the citation is intended to support.
2. **Use a primary source first.** Prefer the current eCFR/regulation, VA publication, Federal Register material, or other authoritative government source appropriate to the claim. Secondary sources may provide context but do not replace the primary source when one exists.
3. **Check applicability.** Confirm the cited authority actually supports the condition, relationship, or rating proposition being made; do not infer a nexus merely because two conditions are discussed in the same source.
4. **Record provenance.** Preserve the source URL, citation text, and `sourceCheckedOn` date in the repository data when those fields are available in the schema. When the source body can be captured at verification time, also record a `contentDigest` (see "Content digests and tiered staleness" below) so silent content changes can be detected later.
5. **Keep verification explicit.** New or automated citation edits must remain `verified: false` until a qualified human has confirmed them. A schema accepting `verified: true` exists so a qualified human can truthfully record that decision without a data-contract migration; schema permissiveness is not authorization for an automated agent or script to promote verification. A source being present or plausibly relevant is not equivalent to verification.
6. **Review changes, not just files.** The PR reviewer must inspect the diff and confirm that changed claims remain supported and that no citation was silently removed or weakened.
7. **Publish only through the gate.** A mapping may be published only after schema validation, citation review, SME/content review, and the applicable phase gate are complete.

## Verification states

- `unverified`: source is recorded but has not received qualified human verification.
- `verified`: a qualified reviewer has confirmed the source supports the stated claim and the verification date is recorded when the schema provides a provenance field.
- `not-applicable`: no citation is required for the particular tracker item; this must not be used to bypass a citation requirement for a published suggestion.

## Content digests and tiered staleness

The scheduled `citation-decay-watch` workflow (and the maintainer-run `npm run citations:decay`) probes every live reference for three independent failure modes:

1. **Link rot** — the URL no longer resolves or returns a hard error.
2. **Staleness** — the reference has not been re-checked within its tier's window. Tiers follow the authority taxonomy already carried by `authorityCategory`: statutory/regulatory/Federal Register final authority is stable and decays on a 1095-day window, VA adjudication guidance on 730 days, and medical/scientific evidence on 540 days because consensus shifts. References without a category keep the historical 365-day window. Recording `authorityCategory` on new references therefore directly calibrates their maintenance burden.
3. **Content drift** — the URL still returns HTTP 200 but the content a human verified has changed (retraction, correction, revision). Link-rot probes cannot see this. Detection requires a `contentDigest` recorded at verification time.

**Recording a content digest.** During a qualified-human verification of a source with a fetchable body, compute `sha256-<hex>` over the retrieved source body (UTF-8) and record it as `contentDigest` on the reference:

```bash
node --input-type=module -e "
import { createHash } from 'node:crypto';
const body = await fetch(process.argv[1]).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
console.log('sha256-' + createHash('sha256').update(body, 'utf8').digest('hex'));
" "https://example.gov/source" >> digest.txt
```

The digest is anchored to the URL and the `sourceCheckedOn` date (the schema rejects one without the other). A mismatch on a later probe means the source changed under the claim: re-verify the proposition, refresh the digest and date, or withdraw the reference — never leave a drifted digest attached to a live claim. Dynamic pages whose body changes per fetch (search endpoints, rotating dashboards) must not receive a digest; omit it rather than record a value that will false-positive, and record that decision. The URL classes where this applies — or where a bot wall means an automated probe never obtains a comparable body at all — are declared, with the measurement behind each one, in `docs/citation-digest-ineligible-classes.json`; check that register before recording a digest.

**Coverage is ratcheted, not backfilled.** Because a digest may only be recorded at this step, no script may populate one after the fact: a digest computed later is not anchored to the recorded `sourceCheckedOn` date, so it would misrepresent when the content was actually verified. `npm run citations:decay` therefore reports how much of the verified corpus drift detection can genuinely see (`contentDriftDetectable`, `contentDriftCoveragePercent`, `verifiedWithoutDigestCount`) and pins the **digest-eligible** backlog at `MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS` in `scripts/audit-citation-decay.js`. Recording a digest shrinks the backlog; adding a `verified: true` reference on a digest-eligible URL without one fails the audit. Lower the pin as digests are recorded — never raise it to accommodate new debt.

**Eligibility is measured, not assumed.** A digest is anchored to the reference's `sourceUrl` and checked by re-fetching that URL, so some URLs can never carry one: the dynamic bodies the sentence above forbids, and hosts whose bot wall means no comparable body is ever obtained. Counting those as backlog made the ratchet unsatisfiable — on 2026-10-14 the scheduled probe failed at 398 undigested against a pin of 383 with zero link rot, content drift or staleness, and the auto-opened tracking issue (issue #518) asked a qualified human to re-verify references that had not decayed, because no human action can move a reference this SOP forbids digesting. Those URLs are therefore declared per class in `docs/citation-digest-ineligible-classes.json`, each class carrying the two-fetch measurement behind it (HTTP status, byte length and sha256 of the same URL fetched twice) plus a review window, and the audit fails when that register is missing, malformed or past its window. Every report and every tracking-issue body prints the two populations separately, so an exclusion is never a count nobody can see; the review window is what stops a measurement from becoming permanent headroom. Widening a class requires re-measurement, not a decision, and the eligible pin is still never raised to accommodate debt. Full record: `docs/citation-digest-ineligibility-policy-2026-10-14.md`.

## Probe outcomes: a verdict or a refusal

The probe is an automated check, and some hosts refuse it. That refusal is not evidence about the reference, so the audit classifies every probe result by what the host actually said and reports the two kinds of refusal separately from decay:

- **Decay** — a definitive answer that the resource is gone: 404, 410, an unresolvable or refusing host, or a server error that persists across retries. This hard-fails the gate, because a dead URL can never support a nexus.
- **Throttled** — the host asked the probe to slow down: 425/429, or any response carrying `Retry-After`. The probe honours that header with a bounded wait, doubles that host's spacing, and otherwise stops out-waiting a closed door. A host that keeps asking for quiet is dropped for the remainder of the sweep, and its remaining URLs are counted as unprobed rather than dead.
- **Unresponsive** — a transport failure on a host that answers other URLs (timeout, reset, retryable DNS failure), retried before it is believed.
- **Bot-walled** — 403/405/406 to both HEAD and GET: the host refuses automated probes entirely.

**Neither refusal is decay, and neither queues human work.** A reference the probe could not ask about has no verdict, so it never appears in the decayed list and never fails the gate. What it does do is reduce the run's **probe coverage**, which every report states: `probeCoveragePercent` — plus `throttledUnverifiableCount`, `botBlockedUnverifiableCount` and `unverifiableByProbeUrlCount` — appears in the JSON report, the weekly workflow summary and any tracking issue. "No link rot" over half the corpus is a narrower claim than "no link rot" over all of it, and the report must let a reader tell which one they are reading. A reference listed under throttling or unresponsiveness is therefore *not* a re-verification task: re-check it by hand only if it also fails the staleness tier or a qualified human has reason to doubt it. Full record of the measurement behind this policy: `docs/citation-decay-probe-outcome-policy-2026-10-14.md`.

## Retiring a previously verified citation

A verified citation must not remain attached to a live relationship solely to protect a verification count when later review shows that the source is inapplicable to that relationship or the relationship itself should be withdrawn.

When a previously verified live citation is removed for applicability or safety reasons:

1. Remove the unsupported or unsafe live relationship/reference rather than weakening the claim language around an inapplicable source.
2. Copy the exact prior citation, URL, source-check date, locator, verification scope, and former mapping/relationship location into `data/citation-retirements.json`.
3. Record a concrete retirement reason explaining why the verified source no longer supports a live relationship, plus source-checked withdrawal evidence when applicable.
4. Preserve the fact that the source was previously verified only as historical provenance. Retirement does **not** verify a new proposition, a replacement source, or the withdrawal evidence.
5. Review the retirement diff under the same qualified-review expectations as any other citation change. A retirement entry must never be used to hide a downgrade from `verified: true` to `verified: false` on an otherwise unchanged live claim.
6. CI must count live verified citations and retired verified provenance separately so an unexplained verification loss fails while a documented safety/applicability retirement remains auditable.

## Reviewer evidence

A citation review should leave enough evidence for another reviewer to reproduce the decision:

- source URL
- source checked date
- claim reviewed
- relevant regulatory/source section
- reviewer identity or role
- verification decision
- unresolved limitations, if any

For a retirement, reviewer evidence must also identify the former mapping/relationship and the reason the verified source is no longer applicable there.

## Carry-forward rule

When a citation cannot be verified during a PR, retain the citation and explicitly carry it forward as `verified: false`. Do not promote it to `verified` based on inference, search-result snippets, or automated checks.

## PR requirements

Knowledge-base and catalog PRs must reference this SOP and must document whether citation content or verification state changed. The PR must also identify remaining unverified citations and any previously verified citations retired in the change, and must pass the automated KB/data checks before merge.


## Proposed approval-gated exemptions in PR #527

**Measured exemptions require qualified-human approval.** `data/citation-digest-exemptions.json` records reproducible source-transport measurements, not citation verification. An exemption must have a valid reason, host-bound URL pattern, sample URLs/statuses, dated assessment, and review disposition. It becomes active only with `review.status: "approved"`, a named qualified reviewer, and a real `reviewedOn` date at or after the assessment. Pending, rejected, invalid, future-dated, or expired entries grant no waiver. Assessments must be re-measured after 365 days. A register/schema failure fails the audit; pending matches remain debt and explicitly request approval. Automation must never supply the human approval.

The measured-class register above remains independently enforced. PR #527 additionally fails closed on pending proposals and its proposed four-reference ratchet; no existing measurement is a qualified-human approval of this proposal.
