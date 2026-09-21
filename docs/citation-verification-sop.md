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

The digest is anchored to the URL and the `sourceCheckedOn` date (the schema rejects one without the other). A mismatch on a later probe means the source changed under the claim: re-verify the proposition, refresh the digest and date, or withdraw the reference — never leave a drifted digest attached to a live claim. Dynamic pages whose body changes per fetch (search endpoints, rotating dashboards) must not receive a digest; omit it rather than record a value that will false-positive.

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
