# Issue #518 — qualified-human digest review packet

**PREPARED — UNREVIEWED. No approvals or new source-verification decisions recorded.**

Prepared: **2026-11-08** · Packet ID: `citation-decay-518-review-2026-10-11`.
Issue: [Citation decay detected — re-verification required #518](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/518).

This packet prepares **three source-class exemption decisions (E1–E3)** and
**four Cornell CFR reference-use decisions (C1–C4)**. It also separates the
**ratchet-policy decision (P0)** from both. Repository automation cannot make
these decisions. All worksheets below are unsigned and all checkboxes unchecked.

## 1. Start here: scope and review inputs

- Governing process: [Citation Verification SOP](citation-verification-sop.md).
- Repair context and prior checks: [local #518 handoff](citation-decay-518-handoff.md).
- Exact machine-readable inputs and full affected-use inventory:
  [review-inputs snapshot](citation-decay-518-review-inputs.json).
- Proposed policy register: [citation-digest-exemptions.json](../data/citation-digest-exemptions.json).

The snapshot was extracted from the **dirty working tree**, on branch
`fix/citation-decay-518-digest-exemptions`, based on commit
`c71826b21249a80655757ff8354459bb1e04a8cb`. That commit alone does **not** identify
the changes under review. The snapshot carries SHA-256 hashes of the register,
SOP, audit implementations, helper, schema, and retirement ledger, plus an
aggregate hash binding all **819 top-level knowledge-base JSON files**. Its
`affectedReferences` lists every matched verified use with a file path and
zero-based JSON Pointer. `cornellReferences` includes exact existing reference
objects and their relationship context, not newly authored source claims.

Before signing anything, validate the input bindings:

```bash
npx vitest run tests/citation-decay-518-review-packet.test.ts
```

A mismatch means the packet is stale. Re-extract and review the changed inputs;
do not copy a signature onto a new hash. The snapshot is evidence for this
review, not a runtime input or an approval file. Copied `verified: true` fields
are historical source state, **not** verification performed for this packet.

The unsigned bindings were refreshed after integrating current `main`. Its
measured-class register and eligible-backlog ratchet remain independently
enforced; neither supplies approval for the proposals in this packet. The
reference-use inventory is unchanged. No live reassessment or qualified-human
decision was performed during this refresh.

### What this preparation did not do

- No new live fetches, independent measurement, legal applicability review, or
  clinical verification; the 2026-10-10 transport observations below are
  **carried-forward claims from Cline's draft register**.
- No changes to approvals, source-check dates, digests, live mapping data,
  publication state, retirement provenance, or catalog identities.
- The original packet preparation made no repository writes. This PR update
  resolves merge conflicts and refreshes unsigned input bindings; it records no
  source approval, workflow dispatch, issue closure, or production promotion.
- No statement that a bot-blocked source is dead, healthy, permanently
  undigestible, or verified for a clinical proposition.

### Current baseline (observations, not decisions)

| Metric | Working-tree observation |
| --- | ---: |
| All live reference uses, including drafts | 1,704 |
| Verified reference uses | 398 |
| Verified uses with a recorded digest | 0 |
| Real digest coverage | 0% |
| Approved-exempt uses | 0 |
| Uses matching pending exemption proposals | 394 |
| Cornell uses without a proposed exemption | 4 |
| Undigested debt until approvals | 398 |
| Original total-undigested ratchet in #518 | 383 |
| Proposed actionable-undigested ratchet in the working tree | 4 |

The audit's zero detected drift is **unobservable**, not a clean bill of health.
Zero network probes were performed when building this snapshot. The current
offline audit deliberately fails; do not expect a green result before decisions.

## 2. Review order and evidence standard

1. Validate the snapshot bindings and read P0. Appoint the actual qualified
   reviewer(s) and policy owner; no identities have been inferred here.
2. For E1–E3, reproduce the relevant transport observation and evaluate the URL
   scope and alternatives. Automated-client refusal is not proof that a human
   cannot capture a stable, source-bearing response. No challenge bypass,
   credential harvesting, paid-content circumvention, or weakened security is
   authorized by this packet.
3. For C1–C4, read the source and the **individual reference use**. The legal
   framework must not be substituted for clinical evidence of a relationship.
4. Complete a dated disposition with evidence links, exact allowed scope, and
   limitations. Keep HOLD/REJECT separate from approval. Any approval-with-
   narrowing requires a separately reviewed implementation before activation.
5. Apply nothing automatically. A maintainer implements only the genuinely
   authorized changes, re-derives counts, reruns checks, and reviews closure.

### Transport evidence to collect for each source sample

Record the **exact requested URL, final redirect URL, UTC retrieval time,
request method and User-Agent**, HTTP status/content type, body completeness and
size, whether actual source text is present, and the SHA-256 of the UTF-8 body.
For volatility, repeat the same URL with the same client shape at the stated
spacing, and identify what changed. Different URLs having different digests is
not evidence that any one URL varies per fetch. Record each sample separately.

Save source evidence under a fresh, dated review-artifact location (not in
`public/`, not over an earlier sample). Use only public-source material; do not
capture cookies, authorization headers, credentials, personal health data, or
signed-in browser state. If retaining bodies is inappropriate, retain permitted
minimal excerpts plus hashes, request metadata, the reason for the limitation,
and where an authorized reviewer can access the source.

For a body saved as UTF-8, this matches the probe's digest algorithm:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const body = readFileSync(process.argv[1], "utf8");
console.log("sha256-" + createHash("sha256").update(body, "utf8").digest("hex"));
' /absolute/path/to/the/exact-saved-response-body.html
```

This command **only computes a candidate digest**. The reviewer must first
establish that the body is complete, source-bearing, stable enough to compare,
and the same body representation the current probe can retrieve from
`sourceUrl`. A rendered DOM serialization, reader-mode export, partial body,
challenge page, PDF conversion, or XML at another URL is not interchangeable
with that response. Do not record a candidate against the old verification date.

## 3. P0 — ratchet denominator and residual-risk decision

**Decision requested:** is it acceptable to change the gate from a maximum of
383 total verified uses without digests to a maximum of **4 uses lacking either
a real digest or an approved, current exemption**?

This is a **policy/denominator change**, not a measured increase in coverage or
retirement of 394 digests. E1–E3 are proposed standing source-class policies:
as written they may waive future matching uses too. Review that prospective
scope, not just today's count. Independent source verification, tiered
staleness, and link-rot maintenance still apply to exempt uses.

If all three proposals were genuinely approved as currently scoped, today's
split would be 394 exempt / 4 actionable / 0 digested. Only after all four
Cornell uses acquired genuine digests would it be 394 exempt / 0 actionable /
4 digested, or **1.0%** digest coverage rounded to one decimal place. These are
conditional arithmetic illustrations, not outcomes or instructions to approve.
The actionable pin should then be reviewed for lowering from 4 to 0; never
raise it merely to admit debt.

- [ ] ACCEPT THE PROPOSED POLICY — rationale and residual-risk acceptance attached
- [ ] REQUIRE A DIFFERENT POLICY — exact alternative and enforcement work recorded
- [ ] HOLD — decision/evidence remains outstanding

Policy owner/reviewer identity and role: —<br>
Decision date: — · Decision: — · Input hashes reviewed: —<br>
Risk accepted and why: — · Monitoring/reassessment owner: —<br>
Required changes/limits: — · Evidence/disposition link: —

**Nothing selected.** P0 acceptance alone does not approve E1–E3 or re-verify C1–C4.

## 4. E1 — PubMed article HTML bot challenge

**Register ID:** `pubmed-article-html-bot-challenge`<br>
[Proposed entry](../data/citation-digest-exemptions.json#L35) ·
Host: `pubmed.ncbi.nlm.nih.gov` · Reason: `volatile-body-per-fetch`.

```text
^https://pubmed\.ncbi\.nlm\.nih\.gov/\d+/?$
```

**Affected population:** 392 verified reference uses, **358 unique URLs**.
The complete use inventory is `exemptions[0].affectedReferences` in the
[snapshot](citation-decay-518-review-inputs.json). Uses are not unique articles.

**Carried assessment, not independently reproduced:** 2026-10-10; three GETs
per sample URL, two seconds apart; six responses in total, six distinct body
hashes, HTTP 203 throughout, 5,590 bytes each; a changing `challengeId`, no
article content. The register also describes checks with alternate User-Agents,
but the six listed responses do not separately bind each client run or timestamp.

Sample URLs:

- https://pubmed.ncbi.nlm.nih.gov/30407234/
- https://pubmed.ncbi.nlm.nih.gov/32552169/

**Review questions / missing evidence:**

- [ ] Reproduce repeated fetches of the **same** sample URL and retain ordered
      response metadata/body evidence; do not infer volatility from six hashes
      across two different articles alone.
- [ ] Assess whether a locally observed 203 challenge is origin-wide behavior
      or a property of a client, network/proxy, environment, or time. Status 203
      alone is not proof that every PubMed response is a bot challenge.
- [ ] Justify extrapolation from two samples to 358 URLs and future numeric
      PubMed URLs, or specify narrower scope and additional sampling needed.
- [ ] Confirm whether a human-accessible representation is stable and retrievable
      by the probe without disallowed access workarounds.
- [ ] Evaluate the E-utilities alternative only as a prospective anchor. The
      register's XML measurement does not identify an exact sample PMID in the
      alternative block and is not a verified replacement for all 358 URLs.

The register proposes
`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={pmid}&retmode=xml`.
The current probe hashes `sourceUrl`, not this template. Never attach an XML
digest to an unchanged PubMed HTML URL. An alternate-anchor schema or URL
migration needs separate provenance/implementation review; it is not delivered
or authorized by this worksheet.

**E1 disposition — choose exactly one at human review:**

- [ ] APPROVE AS SCOPED
- [ ] APPROVE ONLY WITH NARROWING — exact URL pattern/conditions below
- [ ] REJECT
- [ ] HOLD

Reviewer identity/role: — · Decision date: — · Decision: —<br>
Fresh assessment date and evidence links: — · Approved scope/conditions: —<br>
Required narrowing/alternative work: — · Residual risk and reassessment owner: —

## 5. E2 — eCFR current-section HTML nonce

**Register ID:** `ecfr-current-section-html-csp-nonce`<br>
[Proposed entry](../data/citation-digest-exemptions.json#L85) · Host: `www.ecfr.gov` ·
Reason: `volatile-body-per-fetch`.

```text
^https://www\.ecfr\.gov/current/
```

**Affected population:** one verified legal-framework reference, in the draft
`ocd` → `migraine-headaches` mapping:
[ocd.json](../data/knowledge-base/ocd.json#L29),
`/suggestions/0/sourceReferences/1`. Historical check date: 2026-08-19.
This is not one of the four Cornell uses.

Exact sampled/source URL:
https://www.ecfr.gov/current/title-38/chapter-I/part-3/subpart-A/subject-group-ECFR39056aee4e9ff13/section-3.310

**Carried assessment, not independently reproduced:** 2026-10-10; five GETs,
six seconds apart, four distinct digests, HTTP 200, 85,108 bytes each. The
register attributes variation to an analytics-script CSP nonce. An earlier
three-fetch sample reportedly appeared stable. The entry does **not** include
per-response `bodySha256` values or retained raw diff artifacts.

**Review questions / missing evidence:**

- [ ] Retain per-fetch hashes and permitted differences showing that the nonce,
      rather than the regulation, explains observed variation.
- [ ] Distinguish byte stability from legal currency. A frozen annual edition
      could be stable yet inappropriate for a current-rule claim.
- [ ] Assess scope: the pattern covers **all `/current/` URLs** although only
      one section was sampled. Require a justified broader sample or narrow to
      the measured route; host matching alone does not solve this path breadth.
- [ ] Evaluate a stable official rendering without silently changing the source
      URL, representation, legal effective date, or hash algorithm.
- [ ] Keep this draft's legal-framework verification separate from clinical
      OCD-to-migraine applicability and any publication decision.

**E2 disposition — choose exactly one at human review:**

- [ ] APPROVE AS SCOPED
- [ ] APPROVE ONLY WITH NARROWING — exact URL pattern/conditions below
- [ ] REJECT
- [ ] HOLD

Reviewer identity/role: — · Decision date: — · Decision: —<br>
Fresh assessment date and evidence links: — · Approved scope/conditions: —<br>
Required narrowing/alternative work: — · Residual risk and reassessment owner: —

## 6. E3 — Oxford Academic article bot wall

**Register ID:** `oup-article-html-bot-wall`<br>
[Proposed entry](../data/citation-digest-exemptions.json#L116) ·
Host: `academic.oup.com` · Reason: `bot-walled-body-unavailable`.

```text
^https://academic\.oup\.com/[^/]+/article/
```

**Affected population:** one verified clinical-evidence reference:
[hyperaldosteronism → hypertension](../data/knowledge-base/hyperaldosteronism.json#L37),
`/suggestions/0/sourceReferences/0`; published mapping, historical source check
2026-08-18. Citation: Adler et al., Primary Aldosteronism: An Endocrine Society
Clinical Practice Guideline, J Clin Endocrinol Metab. 2025;110(9):2453-2495.
doi:10.1210/clinem/dgaf284.

Exact sampled/source URL:
https://academic.oup.com/jcem/article/110/9/2453/8196671

**Carried assessment, not independently reproduced:** 2026-10-10; three GETs,
two seconds apart; three distinct hashes; HTTP 403; 5,670 bytes each; no article
content. The register lists hashes, but not per-request timestamps/final URLs or
raw body evidence. No stable alternative is identified in the entry.

**Review questions / missing evidence:**

- [ ] Confirm what refused the client; HTTP 403 is access refusal, not proof of
      a permanently missing source or intrinsic article volatility.
- [ ] Assess scope: one article does not establish behavior for **every journal
      article path** on `academic.oup.com`. Specify measured scope or more evidence.
- [ ] Determine whether a permitted, stable source-bearing response can be read
      and fetched by the probe. A subscription/manual browser view alone is not
      a digest-compatible public automation anchor.
- [ ] Preserve the existing clinical note's condition: primary aldosteronism
      must be clinically established. Exemption review does not independently
      re-verify this note or its recorded correction history.
- [ ] If a replacement URL is proposed, review identity, corrections, scope,
      access terms, and registry/provenance changes separately.

**E3 disposition — choose exactly one at human review:**

- [ ] APPROVE AS SCOPED
- [ ] APPROVE ONLY WITH NARROWING — exact URL pattern/conditions below
- [ ] REJECT
- [ ] HOLD

Reviewer identity/role: — · Decision date: — · Decision: —<br>
Fresh assessment date and evidence links: — · Approved scope/conditions: —<br>
Required narrowing/alternative work: — · Residual risk and reassessment owner: —

## 7. C1–C4 — Cornell CFR reference-use re-verification

These are **four uses of one source URL**, not four different documents:
https://www.law.cornell.edu/cfr/text/38/3.310

Common existing reference metadata (copied verbatim):

- Citation: `38 CFR 3.310`.
- Note: **Legal framework for secondary service connection; does not establish the underlying medical relationship.**
- `sourceCheckedOn`: **2026-08-11** (historical, not refreshed here).
- `sourceLocator`: `§ 3.310(a)-(b)`.
- `verificationScope`: `legal-framework`.
- `authorityCategory`: `current-regulatory-authority`.
- Existing `verified: true`; `contentDigest` absent; all four mappings published.
- All four relationship classifications remain `ASSOCIATION_ONLY`,
  `NOT_ESTABLISHED`, `NOT_ASSERTED`, with a hypothesized-only mechanism.

Cline's earlier handoff says Cornell was byte-stable across three fetches.
**No raw response/hash set for that measurement is attached to this packet.**
Re-measure stability at the human verification session; do not treat this report
as sufficient capture evidence. Compare the legal text/currency to the
[official eCFR section already recorded in the corpus](https://www.ecfr.gov/current/title-38/chapter-I/part-3/subpart-A/subject-group-ECFR39056aee4e9ff13/section-3.310),
and record any discrepancy. Cornell is the existing reference URL, not an
assertion that a third-party rendering replaces official authority.

### C1 — abdominal-hernia → depressive-disorder

[abdominal-hernia.json:44](../data/knowledge-base/abdominal-hernia.json#L44) ·
Rank 1 · `/suggestions/0/sourceReferences/1`.

**Exact rationale under contextual review:**

> Chronic pain and depression frequently co-occur and can be associated with reduced physical, mental, and social functioning. This population-level relationship does not by itself establish an individual medical nexus.

Check that the legal-framework note stays separate from the clinical pain/
depression source and does not turn hernia, pain, or functional limitation into
proof of individual causation/aggravation. Review the complete suggestion in
the source file and exact context in `cornellReferences[0]` of the snapshot.

- [ ] RE-VERIFIED AS WRITTEN — actual source review and digest evidence attached
- [ ] NARROWING / PROVENANCE CHANGE REQUIRED — exact proposed change attached
- [ ] WITHDRAWAL REQUIRED — SOP retirement review needed; nothing removed here
- [ ] HOLD — source/applicability or digest evidence incomplete

Reviewer identity/role: — · Decision/date: — · Claim and source section reviewed: —<br>
Actual source-check date/time: — · Exact requested/final URL and representation: —<br>
Candidate digest and capture evidence: — · Required change/limitations: —

### C2 — rheumatoid-arthritis → depressive-disorder

[rheumatoid-arthritis.json:44](../data/knowledge-base/rheumatoid-arthritis.json#L44) ·
Rank 1 · `/suggestions/0/sourceReferences/1`.

**Exact rationale under contextual review:**

> Chronic pain and depression frequently co-occur and can be associated with reduced physical, mental, and social functioning. This population-level relationship does not by itself establish that rheumatoid arthritis caused or aggravated an individual's depressive disorder.

Review the RA-specific applicability separately from C1. Shared legal text and
a shared pain/depression clinical source do not justify copying an applicability
decision. Full context is `cornellReferences[1]` in the snapshot.

- [ ] RE-VERIFIED AS WRITTEN — actual source review and digest evidence attached
- [ ] NARROWING / PROVENANCE CHANGE REQUIRED — exact proposed change attached
- [ ] WITHDRAWAL REQUIRED — SOP retirement review needed; nothing removed here
- [ ] HOLD — source/applicability or digest evidence incomplete

Reviewer identity/role: — · Decision/date: — · Claim and source section reviewed: —<br>
Actual source-check date/time: — · Exact requested/final URL and representation: —<br>
Candidate digest and capture evidence: — · Required change/limitations: —

### C3 — rheumatoid-arthritis → gerd

[rheumatoid-arthritis.json:114](../data/knowledge-base/rheumatoid-arthritis.json#L114) ·
Rank 2 · `/suggestions/1/sourceReferences/1`.

**Exact rationale under contextual review:**

> When NSAID treatment for rheumatoid-arthritis pain is documented in the individual record, observational evidence associating NSAID use with GERD symptoms supports a bounded medication-related research pathway. The clinical source does not establish that rheumatoid arthritis itself causes GERD or that an NSAID caused or aggravated an individual veteran's GERD; the actual prescription indication, exposure, chronology, diagnosis, and competing gastrointestinal contributors remain essential.

Preserve the documented-treatment and chronology guard. The legal citation
must not supply the missing prescription indication, exposure, diagnosis,
clinical medication mechanism, or individual nexus. Review the distinct
clinical evidence and `cornellReferences[2]`, not the depression worksheet.

- [ ] RE-VERIFIED AS WRITTEN — actual source review and digest evidence attached
- [ ] NARROWING / PROVENANCE CHANGE REQUIRED — exact proposed change attached
- [ ] WITHDRAWAL REQUIRED — SOP retirement review needed; nothing removed here
- [ ] HOLD — source/applicability or digest evidence incomplete

Reviewer identity/role: — · Decision/date: — · Claim and source section reviewed: —<br>
Actual source-check date/time: — · Exact requested/final URL and representation: —<br>
Candidate digest and capture evidence: — · Required change/limitations: —

### C4 — stomach-cancer → depressive-disorder

[stomach-cancer.json:44](../data/knowledge-base/stomach-cancer.json#L44) ·
Rank 1 · `/suggestions/0/sourceReferences/1`.

**Exact rationale under contextual review:**

> Chronic pain and depression frequently co-occur and can be associated with reduced physical, mental, and social functioning. This population-level relationship does not by itself establish that stomach cancer caused or aggravated an individual's depressive disorder.

Review the stomach-cancer-specific use independently. The source is asked to
support the legal framework, not establish a cancer-to-depression medical
relationship. Full context is `cornellReferences[3]` in the snapshot.

- [ ] RE-VERIFIED AS WRITTEN — actual source review and digest evidence attached
- [ ] NARROWING / PROVENANCE CHANGE REQUIRED — exact proposed change attached
- [ ] WITHDRAWAL REQUIRED — SOP retirement review needed; nothing removed here
- [ ] HOLD — source/applicability or digest evidence incomplete

Reviewer identity/role: — · Decision/date: — · Claim and source section reviewed: —<br>
Actual source-check date/time: — · Exact requested/final URL and representation: —<br>
Candidate digest and capture evidence: — · Required change/limitations: —

### Shared capture does not mean shared approval

A single permitted Cornell response captured during the verification session
may support the **same digest** for uses independently reviewed against that
identical source body. Record the shared evidence ID in each worksheet, the
actual source-check date, and a separate applicability decision for each use.
Do not backfill a new digest against `2026-08-11`. If the probe later receives
variable/challenge content or a representation different from the one reviewed,
HOLD the digest change and resolve the anchor/transport limitation first.

## 8. Consolidated unsigned disposition register

| ID | Review item | Decision | Reviewer / role | Actual review date | Evidence / required changes |
| --- | --- | --- | --- | --- | --- |
| P0 | Ratchet denominator and residual risk | — | — | — | — |
| E1 | PubMed source-class exemption | — | — | — | — |
| E2 | eCFR `/current/` exemption | — | — | — | — |
| E3 | Oxford Academic article exemption | — | — | — | — |
| C1 | abdominal-hernia → depressive-disorder legal use | — | — | — | — |
| C2 | rheumatoid-arthritis → depressive-disorder legal use | — | — | — | — |
| C3 | rheumatoid-arthritis → gerd legal use | — | — | — | — |
| C4 | stomach-cancer → depressive-disorder legal use | — | — | — | — |

**No decisions selected; no reviewer named; no approval date supplied.**
An unsigned worksheet, a passed test, or an automated measurement is not consent.

## 9. Post-review implementation and closure checklist (not executed)

- [ ] Bind the signed disposition to these input hashes, or regenerate/re-review
      changed inputs. Preserve this unsigned baseline as historical preparation.
- [ ] Implement only genuinely accepted exemption scope. The live schema uses
      `pending-qualified-human`, `approved`, or `rejected`; worksheet narrowing
      is not an extra machine status. Apply and review the narrow pattern before
      using `approved`, with a real reviewer and `reviewedOn` date at/after the
      applicable assessment. HOLD grants no waiver. Refresh evidence before it
      is over 365 days old; a failed source assessment cannot be papered over.
- [ ] Apply C1–C4 outcomes under the SOP. Genuine re-verification records the
      actual date and compatible digest; supported withdrawal preserves required
      retirement provenance. Maintain source-registry parity where affected;
      do not alter clinical claims/publication scope as a side effect.
- [ ] Re-derive all counters and any affected review fingerprints. Exemptions
      remain outside coverage; lowering actionable debt does not verify a source.
- [ ] Run `npm run citations:audit`, `npm run kb:validate`,
      `node scripts/audit-master-registry.js`, `npm run typecheck`,
      `npm run lint`, `npm test`, and `npm run test:doc-lint`. Preserve exit status
      when capturing logs. Do not weaken existing failing gate assertions.
- [ ] Run the full maintainer network probe `npm run citations:decay` on the
      reviewed tree and retain JSON, blocked-source counts, actual digest
      comparison outcomes, and the exact reviewed revision/input binding.
      Structural tests alone do not prove live source health.
- [ ] Have the maintainer review any remaining debt, decisions, and residual
      unobservability before closing #518. P0/E1–E3 approval alone could make
      the proposed structural gate pass with four legacy undigested uses; that
      is **not** completion of C1–C4 or full drift coverage.
- [ ] Keep release/Phase 2 approval and external VA/508 gates separate. No commit,
      push, PR, deployment, or issue closure is authorized by packet preparation.
