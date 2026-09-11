# Functional Specification: Secondary Condition Finder (v2)

> **v2, 2026-09-11.** Supersedes the v1.0-era executive narrative. Corrections from the
> codebase conformance audit (2026-09-11): the 8-step workflow narrative is corrected to the
> implemented **six-step** flow; KB counts are unit-clarified (files vs. relationships); the
> Accredited Representative & VSO Locator and DD-214 browser-local parser (Phase 3.1) are
> included; constants verified against source. Baseline of record: `docs/product-spec.md`
> (which already described the six-step flow correctly); expanded detail lives in
> `docs/functional-specification.md` and `docs/technical-specification.md`.

## Executive Summary

Secondary Condition Finder is a claim-preparation **research aid** for U.S. veterans seeking
VA disability benefits. It organizes two independent legal/medical frameworks for
establishing service connection:

- **Secondary track (38 CFR § 3.310):** Matches *diagnosed, not-yet-service-connected*
  conditions the user reports against *already service-connected* conditions through a
  curated **Causal Relational Graph (CRG)**, helping veterans and their representatives
  identify conditions that may warrant secondary claim pathways.
- **Presumptive track (38 CFR §§ 3.307, 3.309):** Deterministically matches service history
  (locations, dates) to presumptive conditions where VA has already established service
  connection without proof of causation.

The application is **not** a diagnostic tool, legal advisor, or claims filer. It surfaces
research starting points, organizes evidence gaps, builds pathway-specific medical record
checklists, maps uploaded-evidence excerpts to authored pathways, locates accredited help,
and parses DD-214s locally — all in the browser, with no document transmission to the
server and no access to veteran accounts or claims systems.

## Business Objectives

1. **Reduce research friction** — accelerate evidence gathering by organizing clinical
   relationships and guiding record requests.
2. **Enforce legal/medical separation** — keep the secondary and presumptive tracks
   distinct; they use different legal frameworks and evidentiary requirements, and
   conflating them is a common claim-preparation error.
3. **Maintain source integrity** — every published suggestion is grounded in authored,
   citation-verified medical evidence, never auto-generated speculation.
4. **Protect privacy by default** — process all evidence documents in the browser; no
   veteran data, condition selections, or medical records are transmitted to or stored by
   the application server.
5. **Support accredited representatives** — provide tools for VSOs and accredited
   representatives to organize claim pathways and record requests without exposing
   sensitive veteran data to external APIs — and to *find* accredited help when needed.

## Primary User Personas

- **Veteran seeking secondary claims** — wants to understand which diagnosed conditions
  might connect to service-connected disabilities; may have records on hand and wants to
  organize them by claim pathway.
- **Accredited representative / VSO** — prepares multiple claims; maps diagnosed conditions
  to potential pathways, organizes evidence gaps per pathway, generates consultation
  summaries, and locates peer representatives — without exposing client data.
- **Medical provider / clinician** — reviews what evidence gaps remain (specific tests,
  nexus-opinion language, treatment documentation) to support a secondary nexus opinion.

## Key Functional Requirements

### R1: Secondary Service Connection Workflow — six steps

Trigger: user selects "Condition Caused By Service-Connected Condition" or "Condition via
Aggravation" from the home page.

| Step | Route | Purpose |
|---|---|---|
| 1 | `/secondary/diagnosed` | Multi-select diagnosed conditions from the 813-condition catalog (grouped by body system). |
| 2 | `/secondary/service-connected` | Mark each diagnosis service-connected (Yes/No). Yes → comparison set; No → non-service-connected target set. |
| 3 | `/secondary/ratings` | Optional 0–100% VA evaluation per service-connected condition (or decline). |
| 4 | `/secondary/upload` | Optional browser-local evidence: PDF/DOCX/text/pasted notes, plus bounded medication/treatment context. Raw bytes never leave the tab. |
| 5 | `/secondary/suggestions` | Diagnosis-centered connection review: for each non-service-connected diagnosis, list only service-connected conditions with an authored published relationship — rationale, evidence gaps, citations, consensus badge, condition comparison, combination insights, rating guide, action plan, pathway record checklist, Find Help locator. |
| 6 | `/secondary/evidence` | Evidence review with Pathway Evidence Mapping (excerpts grouped under authored pathways), gap coverage, printable consultation summary/action card. Steps 5→6 share the locked regulatory snapshot (`regSnapshot`; missing lock fails closed). |

Data flow: selections → encrypted HttpOnly `SameSite=Strict` workflow cookie (AES-256-GCM,
30-minute TTL, no URL state) → Server Actions validate and hydrate session → React UI
renders from the cached knowledge base. Steps 2–6 are guarded against invalid or
incomplete prior-step state.

### R2: Presumptive Service Connection Workflow

Trigger: user selects "Presumptive Service Connection" from the home page.

1. **Service history (Step 1):** branch(es), service start/end dates, locations
   ("Southwest Asia," "Burn pit location in Iraq").
2. **Results (Step 2):** matched exposure categories (e.g., PACT Act burn pit, Agent
   Orange), their presumptive conditions, and a date-confirmation prompt when only a
   partial range was supplied.

Data flow: service history → encrypted workflow cookie → deterministic Boolean
location/date matching against `data/presumptives/*.json`. Matching is **deterministic,
not probabilistic**: a qualifying match is presumed; no clinical judgment is applied.

### R3: Browser-Local Evidence Processing

- **Scope:** PDF (pdf.js), DOCX (mammoth), plain/pasted text; optional browser-local OCR
  for scanned/image-only PDFs (tesseract.js, WASM — no server transmission).
- **Processing:** classify document author (physician, psychologist, NP/PA, non-clinician,
  unknown); extract and normalize diagnosed conditions and clinical shorthand ("dx," "2/2"
  = "secondary to"); group excerpts under authored claim pathways (Pathway Evidence
  Mapping); mark which evidence-gap questions uploaded excerpts already address.
- **DD-214 (Phase 3.1):** browser-local DD-214 parsing/extraction feeding presumptive and
  workflow intake.
- **Security:** raw file bytes never leave the browser tab; only sanitized extracted text
  surfaces; processing is bounded by per-document/per-batch character, page, and file
  counts defined in a single limits module (`src/lib/evidence/limits.ts`) and published at
  `/privacy`.

### R4: Knowledge-Base Curation and Citation Verification

- **Data:** 813-condition catalog; **813 KB mapping files** — one per catalog id —
  carrying **363 authored relationships**, of which **140 mapping files are published and
  673 are draft** (counts are by *mapping file*, not relationship); 379 live source
  references, all verified.
- **Architecture:** conditions in `data/conditions/*.json` (33 body-system files);
  relationships as CRG edges in `data/knowledge-base/<primary-id>.json`, each carrying the
  CRG trio (nexus claim, causal mechanism, evidentiary profile); master registries in
  `data/evidence/master-sources.json` and `data/evidence/master-relationships.json`.
- **Validation:** strict Zod schemas with referential integrity; **citation purity
  threshold** — a mapping with >30% unverified citations is demoted to draft (excluded
  from suggestions); `npm run audit:me-compliance` audits nexus-arm validity, consensus
  consistency, guard-disclaimer honesty, and citation discipline; `npm run citations:audit`
  enforces the unverified-citation ceiling vs. audited baseline (hard CI gate);
  `npm run citations:decay` probes live URLs for 404/5xx and flags stale
  `sourceCheckedOn` dates (maintainer gate, not per-PR).
- **Authoring rule:** never force a causation or aggravation claim when literature only
  supports association. The third arm (`ASSOCIATION_ONLY` + `NOT_ESTABLISHED` +
  `hypothesizedOnly: true`) is mandatory.

### R5: Regulatory Intelligence & Preflight

- Monitors Federal Register, OIRA, and Regulations.gov for activity that could affect the
  knowledge base.
- **Preflight (`GET /api/regulatory/preflight`):** bearer-protected scheduled endpoint;
  runs live source checks; caches freshness ceiling 24h by default; per-source HTTP
  timeouts 8 seconds (env-overridable); seeds from `data/regulatory-actions/`
  (provenanced records).
- Scope: flags potential KB updates and tracks regulatory lineage — never modifies
  suggestions on-the-fly.

### R6: VA Reference Data, Forms Finder & Locator

- **VA Forms Reference** (optional; disabled if credentials absent): search public VA form
  metadata — `/va-forms/finder`.
- **Benefits Reference Data** (optional; disabled if absent): disability-rating
  terminology, body-system codes — `/va-reference/`.
- **Accredited Representative & VSO Locator** (optional; disabled by default): ZIP + radius
  search of the VA OGC accredited-representative directory with local fallback; results
  show accreditation status, distance, contact, and the 38 U.S.C. § 5904 fee note;
  mounted on Steps 5/6 and `/presumptive/results`.
- **Data boundary:** all adapters respect the privacy posture — no veteran credentials, no
  authenticated requests beyond sandbox credentials, filtering stays local where possible.

## Non-Functional Requirements

- **NFR1 Privacy & Security:** no server-side persistence (short-lived encrypted
  HttpOnly `SameSite=Strict` cookies only); no evidence transmission (browser-local
  extraction); no client analytics; production `connect-src` is first-party only;
  per-request CSP nonce via edge proxy (`script-src 'nonce-<n>'`, no `unsafe-inline`).
- **NFR2 Performance:** catalog/KB are JSON in version control loaded at runtime
  (build-time sharded indexer is a backlog item); VA reference cache is process-local,
  best-effort (5-minute TTL, LRU-bounded, no distributed semantics); edge WAF/DDoS at the
  platform, not application level.
- **NFR3 Accessibility & Usability:** semantic HTML, landmarks, labels; full keyboard
  navigation; WCAG AA contrast; plain language with CFR citations as references, not
  primary copy.
- **NFR4 Availability & Deployment:** Vercel primary; Azure Static Web Apps legacy
  fallback (manual); every PR passes `kb:validate`, `audit:me-compliance`,
  `citations:audit`, `test:composition`, lint, typecheck, and the Vitest suite
  (202 files / 1093 tests as of this revision); direct pushes to `main` are blocked by
  repository rules — squash-merge via PR only; production readiness confirmed
  post-deploy via `/runtime-readiness`.

## Core User Workflows

**Workflow 1 — Secondary claim pathway research (happy path):** home → Step 1 select PTSD
+ osteoarthritis → Step 2 mark service-connected status → Step 3 ratings → Step 4
optionally upload records → Step 5 review authored suggestions with consensus badges →
Step 6 see excerpts mapped under pathways, work the pathway record checklist, print the
action card / consultation summary.

**Workflow 2 — Presumptive eligibility check:** home → Step 1 enter service dates and
locations → Step 2 see matched exposure category and its presumed conditions, with a
date-confirmation prompt for partial ranges.

**Workflow 3 — Representative processing multiple claims:** complete Steps 1–5 per client,
download pathway checklists, use Find Help to locate nearby accredited colleagues; email
materials outside the app — each session is independent, no persistent client list.

**Workflow 4 — Managing evidence gaps with local documents:** Step 4 upload a scanned,
image-only record (browser-local OCR); Step 6 Pathway Evidence Mapping groups excerpts
under authored pathways (e.g., sleep-disturbance note → PTSD→sleep apnea; SSRI mention →
PTSD→sexual dysfunction via medication); the evidence-gap checklist marks what the uploads
already address and what remains.

## Data Requirements

- **Condition** (813): stable slug id, display name, aliases, body system, VA rating
  schedule references, review notes. Schema: `src/lib/catalog/schema.ts` (Zod).
- **Secondary relationship (CRG edge)** (363 authored): primary/secondary condition ids,
  rank, rationale, causal mechanism category, nexus claim (`DIRECT_CAUSATION` |
  `AGGRAVATION` | `ASSOCIATION_ONLY`), evidentiary profile (e.g.,
  `WELL_ESTABLISHED`/`PROBABLE`/`NOT_ESTABLISHED` consensus), evidence gaps, source
  references, honest guard/disclaimer. Schema: `src/lib/kb/schema.ts` (strict Zod,
  referential integrity).
- **Presumptive exposure category** (~5–10 active): category id, display name, qualifying
  location/date windows, presumed condition ids. Schema: `src/lib/presumptive/schema.ts`.
- **Source reference** (379 live, all verified): citation, URL, verification scope,
  verified flag (qualified-human governance decision per
  `docs/citation-verification-sop.md`), source-checked date, locator (PMID/DOI/page),
  decay status. Lineage tracked in `data/evidence/master-sources.json`.

## Integration Points

| # | Integration | Credential | Notes |
|---|---|---|---|
| I1 | VA Forms API | `VA_FORMS_PRODUCTION_API_KEY` / `VA_FORMS_SANDBOX_API_KEY` | Read-only form metadata; disabled by default. |
| I2 | VA Benefits Reference Data API | `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY` / `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` | Rating-code descriptors; disabled by default. |
| I3 | Federal Register / OIRA / Regulations.gov | `REGULATIONS_GOV_API_KEY` (optional) | Regulatory intelligence; public records only. |
| I4 | VA OGC Accredited Representatives directory | `VA_ACCREDITED_REP_SANDBOX_API_KEY` / `VA_ACCREDITED_REP_PRODUCTION_API_KEY` (+ per-service flag `VA_ACCREDITED_REP_ENABLED`) | Locator; sandbox gated on security-ops issuance; production additionally gated on the #287 shared-coordinator work for distributed runtimes. |

## Constraints and Assumptions

- **Not a diagnostic tool** — never diagnoses or stages; users confirm with qualified
  providers.
- **Not legal or medical advice** — every suggestion is a research starting point; consult
  qualified providers, accredited representatives, or VSOs before filing.
- **No VA system integration** — no adjudication/benefits/credentialed access; no claims
  submitted; no veteran accounts accessed.
- **Curated, not algorithmic** — absence of a relationship means it is not authored and
  verified here, not that it does not exist.
- **Verification is manual** — `verified: true` is a governance decision, not an automated
  gate.
- **Browser-local processing is synchronous** — large batches may briefly block the tab;
  user-configurable limits prevent runaway processing.
- **Drafts are excluded from suggestions** — `draft: true` mappings never appear in
  recommendation output.

---

*Version: v2 (2026-09-11) — conformance-audited against the repository at `main @ faa793b`.*
