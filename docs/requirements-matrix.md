# Secondary Condition Finder - Requirements Traceability Matrix

| Requirement ID | Description | Governing Ticket | Verifying Test File | Gate Status |
|---|---|---|---|---|
| **REQ-SEC-01** | Non-diagnostic / non-approval guarantee copy protection | P0-T3 | `tests/copy-contracts.test.ts` | ✅ PASS |
| **REQ-SEC-02** | Zero PII or raw text storage / event logging privacy | P0-T3 / P2-T8 | `tests/event-log-privacy.test.ts`, `tests/ingestion-privacy.test.ts` | ✅ PASS |
| **REQ-SEC-03** | User-reachable completion/reset clears encrypted secondary-workflow state plus browser-local evidence/checklist state without creating a new data channel | #235 | `tests/workflow-completion-privacy.test.ts` | ✅ PASS |
| **REQ-ENG-01** | Recommendations constrained strictly to diagnosed condition set | P1-T5 | `tests/workflow-constraints.test.ts` | ✅ PASS |
| **REQ-KB-01** | Strict 1-to-3 source reference limits per suggestion | P1-T6 | `tests/source-count-policy.test.ts` | ✅ PASS |
| **REQ-SUG-01** | Step 5 exposes optional authored primary-to-secondary pathway labels, causal-chain summaries, development questions/issues, and source-role labels without intake inference or ranking effects | #244 | `tests/step5-pathway-intelligence.test.ts` | ✅ PASS |
| **REQ-SUG-BF1** | Mental Health / Neurological pathway backfill adds metadata only to clinically-supported published edges and preserves reviewed insufficient-source edges as unlabeled | #247 | `tests/pathway-backfill-batch1.test.ts` | ⏳ PENDING CI |
| **REQ-EVD-01** | Non-retentive evidence ingestion and metadata extraction | P2-T8 | `tests/ingestion-privacy.test.ts` | ✅ PASS |
| **REQ-EVD-02** | User-reachable, browser-local structured review of authored evidence gaps, with conservative engine evaluation helper retained for explicit semantic indicators | #233 / P2-T9 | `tests/evidence-evaluation.test.ts` | ✅ PASS |
| **REQ-EXP-01** | User-reachable VSO/representative consultation summary text export from Step 6, generated in-browser with privacy exclusions | #231 / P2-T10 | `tests/export-summary.test.ts` | ✅ PASS |
| **REQ-DEMO-01** | Synthetic demo scenarios launch through validated encrypted current-workflow state without serializing scenario medical/context content into URLs | #240 | `tests/demo-scenarios.test.ts` | ✅ PASS |
| **REQ-E2E-01** | End-to-end multi-step wizard workflow scenario coverage | Phase 4-T13 | `tests/e2e-workflow.test.ts` | ✅ PASS |

## Release Gates
- **CI Gate:** All repository test suites must pass without error.
- **Typecheck Gate:** Strict TypeScript compiler check (`tsc --noEmit`) with zero errors.
- **Build Gate:** Next.js production build compiler check.
