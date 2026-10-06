# CRG packet-to-schema staging conversion — 2026-10-06

## Delivery and authority boundary

The 13 existing research packets are now converted to the repository's actual nested authored
schemas. This is **staging only, not publication or a signed medical opinion**. No live knowledge
base, condition catalog, evidence registry, graph, tracker, or publication state was changed.
The original packets and validation records are preserved without edits.

- [Converter](../scripts/convert-crg-packets.ts): Node 22 TypeScript script using the actual exported Zod schemas.
- [Explicit identity and differential plan](../scripts/lib/crg-packet-plan.ts): reviewed host/target IDs in packet row order; no fuzzy clinical-name matching.
- [Authored mappings](crg-staging-2026-10-06/authored-mappings.json): a JSON array of 28 **additions-only** host mappings, containing all 65 nested suggestions. Every mapping is a staging draft with explicit unresolved `todo` items.
- [Manifest](crg-staging-2026-10-06/manifest.json): all 65 original flat rows, original annotated projections, original probability labels, input hashes, output hashes, explicit per-row holds and graph-inclusion decisions.
- [Staged type-2-diabetes graph node](crg-staging-2026-10-06/graph/diabetes-mellitus-type-2.json): one example of the 28 per-host graph files; the graph contains 64 edges, with the quarantined proposal excluded.
- [Regression tests](../tests/crg-packet-converter.test.ts): executable conversion, content, safety, provenance and loader checks.

**Do not copy these mappings over live host files.** They contain additions only, use local
staging ranks starting at one, and deliberately do not replace or duplicate the existing host
suggestions. A real landing must preserve every live suggestion and its publication state, then
reconcile ranks, source entities, relationship entities, graph scope and governing dispositions
in lockstep. The converted proposals remain invisible to the production recommendation engine.

## Acceptance criteria and results

Historical checkpoint counts, reproducible from the converter's inputs:

| Requirement | Result |
| --- | --- |
| Input packets | 13, exactly five rows each |
| Converted proposals | 65, none dropped |
| Distinct secondary identities | 64; peripheral-neuropathy has two different primary routes |
| Distinct host primaries | 28 |
| Clinical reference uses | 195, three per proposal; 195 distinct canonical PubMed URLs |
| Authored parser acceptance | All 65 suggestions pass `suggestionSchema`; all 28 additions-only host objects pass `conditionMappingSchema` |
| Reference verification | All 195 references remain `verified: false` |
| Patient-level probability | All 65 converted profiles use `NOT_ASSERTED` |
| Original probability normalizations | 25 labels changed in output, individually recorded in the manifest; original labels/text retained |
| Conditional aggravation | Three proposals have separately authored `baselineProgression` and `aggravatingFactor`, expressly stating no patient baseline was supplied |
| Contested tier | Six proposals retain `CONTESTED_REQUIRES_SPECIFIC_EVIDENCE`, specific DBQ requirement and at least two distinct alternatives |
| Proposal graph | 28 valid adjacency files, 64 edges, acyclic; loadable through the application's actual explicit-directory graph loader |
| Publication-ready proposals | Zero; all require qualified review |
| Live-data changes | None |

Schema validation is not catalog/governance approval. In particular, the additions-only authored
array retains one quarantined target for lossless review. Against the **complete** live KB plus
these proposed additions, the actual catalog/quarantine validator rejects that target as expected.
The staged graph excludes it and passes the actual graph loader's catalog and quarantine checks.

## Lossless conversion and clinical/legal safeguards

The primary owns the mapping `id`; the downstream secondary owns `suggestions[].conditionId`.
This preserves the application's causal direction, not a reverse "secondary owns its causes" model.

The manifest stores each original JSON row verbatim as data, preserving all eight mapping keys,
all four evidence keys, ordered CFR citations and the complete annotated projection. The nested
rationale also retains the complete mechanism, condition names, both diagnostic-code proposals,
user-facing nexus theory and ordered CFR citations. Clinical titles and bylines are retained in
`sourceReferences[].citation`, summaries in `note`, and canonical URLs in `sourceUrl`.

The schema caps `sourceReferences` at three. All three slots remain clinical sources, explicitly
classified as `medical-scientific-evidence` and `clinical-evidence`; CFR/DC material is preserved
in the rationale and manifest instead of misclassifying legal authority as clinical evidence or
silently dropping a medical source. Legal/rating structured references may need separate
schema/governance design at landing; this converter does not change the schema.

The original proposals include patient-level probability/presumption projection labels from
earlier waves. No patient records or individual presumption eligibility were supplied, so all
converted outputs use `NOT_ASSERTED`. The 25 changed labels and their original values are listed
in `probabilityNormalizations`. Conditional § 3.310(d) discussions remain in the preserved text;
those rows carry a `presumptive` claim-theory option and `theory-dependent` nexus requirement, not
an asserted individual legal presumption.

Medication theory remains user-facing "Medication Side Effect" in the preserved proposal; the
nested enum correctly uses `DIRECT_CAUSATION` with the projected iatrogenic mechanism. One such
original row concerns radiation, not medication: its original label is preserved, while its
pathway is `treatment-complication`. No missing enum is invented.

The converter preserves the proposed nexus classifications and consensus tiers as **research
proposals**, not findings. All rationales begin with a staging/patient-probability disclaimer.
Conditional aggravation narratives do not fabricate a baseline or attributable increment.
Alternative etiologies are explicitly curated from the packet differentials; they are not
inferred from a diagnostic code. All original differential discussion and counter-evidence remain
available in the rationale and manifest, even where the structured alternatives are summarized.

No source was re-fetched in this conversion task. Prior wave records describe automated,
point-in-time literature checks; they are not qualified-human verification. No new
`sourceCheckedOn`, `contentDigest`, reviewer identity, or `verified: true` was fabricated.
Input/output hashes in the manifest identify local artifacts, **not medical source bodies**.
The [citation SOP](citation-verification-sop.md) still governs every reference.

## Publication holds found against the actual current corpus

Hold categories overlap; these counts must not be summed as distinct proposals:

| Hold | Proposals affected |
| --- | --- |
| Qualified clinical/legal, citation, source-status and governed landing review | 65 |
| Published host cannot accept these unverified references | 45 |
| Target has governance notes requiring review | 22 |
| Host has governance notes requiring review | 4 |
| Original target is not currently draft | 7 |
| Source-registry identifier match | 3 |
| Quarantined target identity | 1 |

The seven non-draft targets are `barretts-esophagus`, `gerd`, `gout`, `hypogonadism`, `insomnia`,
`migraine-headaches`, and `sleep-apnea`. Their use did not satisfy the original draft-selection
requirement; conversion records this discrepancy rather than editing their state.
Governance-note presence is a review hold, **not an automatic assertion that every note is a
binding deferral**. No disposition is cleared by this work.

### Quarantined identity

Wave 9 row 5 proposes diabetes → `rotator-cuff-tear`. The live record is a quarantined pointer
to `rotator-cuff-injury`. The strict suggestion schema alone does not see cross-file quarantine;
the real full-corpus validator does. This proposal remains intact in the authored review array and
manifest, is **not** silently redirected to a different disease scope, and is excluded from every
staged adjacency file. Scope reconciliation requires reviewed action before any claim can land.

### Registry matches correcting earlier summaries

The machine screen found these source entities already present in the current master registry:

| Packet row | PMID | Registry source status |
| --- | --- | --- |
| Wave 2 row 3: post-traumatic seizures | 19233461 | superseded-unverified |
| Wave 5 row 4: hypertensive retinopathy | 21509040 | pending-verification |
| Wave 6 row 3: peptic esophageal stricture | 19439958 | pending-verification |

These results correct earlier blanket "no reuse" summaries. A match is not automatically a
clinical contraindication or approval: source-status preflight, claim applicability, reuse and
relationship redundancy must be reviewed. The converter records the actual source statuses and
does not replace an anchor or promote any source entity.

## Interface, reproducibility and no-write controls

Run from the repository root under the project's Node 22 engine:

```bash
node --no-warnings scripts/convert-crg-packets.ts --out=docs/crg-staging-review-new
node --no-warnings scripts/audit-crg.ts --kb-dir=docs/crg-staging-review-new/graph
npx --no-install vitest run tests/crg-packet-converter.test.ts
npm run test:doc-lint
npm run typecheck
npx --no-install eslint scripts/convert-crg-packets.ts scripts/lib/crg-packet-plan.ts tests/crg-packet-converter.test.ts
git diff --check
```

Omitting `--out` chooses `docs/crg-staging-2026-10-06`. The delivered directory already exists,
so a rerun must choose a **new** docs subdirectory. Existing outputs are refused, never
silently overwritten. Outputs outside docs, live corpus paths, and symlinked ancestor escapes
are refused. The script validates the complete in-memory result before writing, and checks all
captured input hashes again before creating the output. The final manifest hashes the authored
array and every graph file; it does not claim to self-hash.

The tests execute the CLI in a fresh docs staging directory, validate serialized results, load
those graph files through `loadKbGraphFromDir`, run the real cycle-audit CLI, and compare every
captured source hash before/after. They also cover malformed flat keys/URLs, duplicated references,
identity and theory mismatch, missing aggravation fields, malformed projection tables, attempted
live-data output, existing-output overwrite, symlink escape, stale input snapshots and cycles.
Temporary test artifacts are removed after the suite.

The graph cycle check here concerns the proposed, nonquarantined additions only. A future landing
must also check the full live-plus-proposed graph, preserve all live edges and review transitive
redundancy. A proposal-only acyclic result does not certify full-corpus landing safety.

## Final verification record

The delivered converter and artifacts passed 32 relevant tests across the converter, graph loader,
schema contract and cycle-audit suites (including 14 converter tests), plus 152 documentation
tests, TypeScript typecheck, targeted ESLint and whitespace checks. The real cycle audit passed on the
final staged graph. Saved output hashes and equality against a fresh conversion were rechecked;
all captured original packets, records and live-data inputs remain unchanged.

This is a usable schema-compatible authoring checkpoint. It does not reduce the live unmapped
count, register any relationship, publish any host, establish a patient-specific medical nexus,
or clear the remaining qualified-human publication gates. No Git staging, commit or push was
performed; the pre-existing documentation-test edit remains untouched.
