# Secondary Condition Finder - Requirements Traceability Matrix

| Requirement ID | Description | Governing Ticket | Verifying Test File | Gate Status |
|---|---|---|---|---|
| **REQ-SEC-01** | Non-diagnostic / non-approval guarantee copy protection | P0-T3 | \`tests/copy-contracts.test.ts\` | ✅ PASS |
| **REQ-SEC-02** | Zero PII or raw text storage / event logging privacy | P0-T3 | \`tests/event-log-privacy.test.ts\` | ✅ PASS |
| **REQ-ENG-01** | Recommendations constrained strictly to diagnosed condition set | P1-T5 | \`tests/workflow-constraints.test.ts\` | ✅ PASS |
| **REQ-KB-01** | Strict 1-to-3 source reference limits per suggestion | P1-T6 | \`tests/source-count-policy.test.ts\` | ✅ PASS |
| **REQ-E2E-01** | End-to-end multi-step wizard workflow scenario coverage | Phase 4-T13 | \`tests/e2e-workflow.test.ts\` | ✅ PASS |

> **Note:** The P2 evidence-ingestion/evaluation/export modules (`REQ-EVD-01/02`, `REQ-EXP-01`)
> were scaffolded for the upload/evidence phase but never wired to a route, so they and their
> tests were removed. Any future upload feature should rebuild these against the live wizard
> flow rather than restore the standalone modules.

## Release Gates
- **CI Gate:** All Vitest suites must pass without error.
- **Typecheck Gate:** Strict TypeScript compiler check (\`tsc --noEmit\`) with zero errors.
- **Build Gate:** Next.js production build compiler check.
