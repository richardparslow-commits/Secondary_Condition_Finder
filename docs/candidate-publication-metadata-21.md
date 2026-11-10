# Independent PubMed candidate publication preflight — research only

**Status:** Developer-review proposal. No clinical verification, causal/nexus judgment, citation approval, or Production authorization.

The merged PR #676 searches PubMed for independent studies relevant to 21 high-priority published condition-pathway claims. Its output lists up to 12 relevance-ranked candidate PMIDs per claim, but those search results have not been examined for exact clinical support or contradiction.

This stage performs a second **bibliographic** check on the exact candidate PMIDs using official NCBI EFetch XML. The first-page discovery scope is deliberately bounded to **at most 252 unique candidate identifiers** (21 × 12, generally fewer after deduplication). Requests are restricted to 20 PMIDs per official HTTPS request; redirect, response size, duplicate/unexpected/missing PMID and malformed-publication checks fail closed. A missing/withdrawn record is an operational data-review issue, **not proof that a clinical pathway is false**.

For each distinct candidate, the report captures its actual official title, publication types, available publication-year text, whether an abstract is indexed, and linked correction/retraction notice **types**. It does not retain abstracts, full texts, individual claimant or medical records, API credentials, or PubMed access tokens. Correction notice presence is a signal for manual inspection, not an automatic credibility verdict.

Candidate-to-claim ranking and original-citation PMID are preserved in a separate review-link table. The JSON snapshot is content-hashed and tied to the prior candidate-discovery run SHA; output JSON, CSV, Markdown and a deliberately **empty** human clinical screening worksheet have SHA-256 manifest checks and independent input parity.

**Governance:** Every candidate remains \`NOT_ASSESSED\` for exact study-to-claim support, directionality, causation, aggravation, individual VA nexus and any decision to publish. Search results should not be described as *independent proof*, *counterevidence* or a systematic review. A qualified reviewer still needs to examine the full source, corrections, study population, methods, causal direction, medication/procedure mediation, competing explanations and the precise claim.

### Execution

After generating and verifying PR #675 source-specific and PR #676 candidate search artifacts:

\`\`\`sh
python3 -m unittest discover -s tests -p 'test_candidate_publication_preflight.py'
python3 scripts/automation/candidate_publication_preflight.py
python3 scripts/automation/candidate_publication_preflight.py --verify
\`\`\`

The existing weekly \`tiger-dev-clinical-accuracy-triage.yml\` runs these checks in the DEV clinical-evidence research job and uploads the results in its existing public-only artifact. It does **not** insert these new candidate publications into Tiger Cloud tables, create new paid services, or touch any Production database or Vercel application. The established Tiger DEV research snapshots and independent parity checks remain unchanged.

**Operational follow-up order (not clinical strength):** The generated `candidate-human-review-queue.csv` places publications with linked correction/status notices first, publications lacking an indexed abstract second, and all other candidate studies third. Multiple pathway links to the same PMID remain separate review entries. It carries exact original PMID, candidate PMID, source/target, search rank, and official title, with qualified reviewer, study-design, directionality, confounder, medication/procedure mediation, support, and disposition cells deliberately empty. Neither a notice nor an unavailable abstract implies a false medical relationship, and the first 12 search hits are not a systematic evidence search.

Outputs: \`/tmp/scf-source-specific-review/secondary-evidence-discovery/candidate-metadata-preflight/\` with \`candidate-metadata.json\`, \`candidate-metadata-review.csv\`, \`candidate-metadata-dossier.md\`, \`qualified-clinical-screening-EMPTY.csv\`, and \`candidate-metadata-manifest.json\`. Reports are research queues, **not completed clinical reviews**.
