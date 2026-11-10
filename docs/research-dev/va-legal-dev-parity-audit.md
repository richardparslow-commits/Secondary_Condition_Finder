# VA statutes, regulations, M21-1 and judicial authority: DEV import receipt (2026-11-10)

- Named Tiger Cloud service `m8vrpmo6ec` / `secondary-condition-finder-test` verified READY with metadata environment DEV; exact TLS endpoint and SQL identity asserted.
- Curated first `11` official-source records: 4 Title 38 statutes, 2 Title 38 regulations, 2 dated M21-1 instruction sets, 3 appellate case citations.
- Source/run digest: `3ffdbd32bf9e2bf3b5209a1da6e99e029b507ac3b0aa80fa74da9804a2b03ae0`.
- New schema `scf_va_legal_authorities_dev` imported with explicit `apply --dev-write`; subsequent read-only exact content parity passed **11/11**. Status checks prevent any row being tagged as human-verified.
- Node regression tests: **2 passed**; immutable metadata seed and coverage report checks passed.
- Primary official links: 10. The Allen v. Brown entry currently uses an **official later CAVC opinion citing Allen**, not an authenticated original opinion URL; it is distinctly flagged for human source lookup.
- Flags: reconcile 38 CFR 3.310(b), May 1 2026 M21-1 secondary/aggravation instructions and Spicer. Verify exact effective/applicability dates, precedent scope, later treatment, source location and possible supersession before any public statement. CAVC and Federal Circuit cases are not representative of the full body of VA appellate law; no specific BVA decisions or Supreme Court veterans opinions have yet been imported.
- Human legal approvals: **0**; clinical approvals: **0**; Production writes: **0**. BVA fact patterns generally are nonprecedential in other cases under 38 CFR 20.1303.
- Security: no veterans' legal files, PHI, claim numbers or credentials imported. PUBLIC SQL grants revoked. The DEV-only connection helper currently uses the existing DEV administrative role; provision least-privilege before scaling.

Reproduce: `node scripts/automation/va-legal-authorities-dev.mjs check`, `node scripts/automation/va-legal-authorities-dev.mjs verify`, `node --test tests/dev-va-legal-authorities.test.mjs`. Review queue is `docs/research-dev/va-legal-review-queue.csv`. Do not infer that a similar prior adjudication ensures a claim award.
