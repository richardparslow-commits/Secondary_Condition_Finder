# LangSmith + Engine setup — tracing, Datasets & Experiments, and automated PRs

This repository is wired for LangSmith tracing on its one long-lived server path — the secondary-recommendation engine that runs on every Step 5 visit (`src/lib/engine/recommend.ts` → `src/app/secondary/suggestions/page.tsx`). Engine groups those traces by project, diagnoses recurring error clusters against the connected source code, and can open automated pull requests with proposed fixes when a GitHub repository is connected.

The code change that enables this is small and intentionally conservative: `src/lib/observability/langsmith.ts` (`server-only`, `traceable` re-export, `isLangSmithTracingEnabled()` + `LANGSMITH_PROJECT_NAME`) and a traced wrapper `recommendTraced`/`recommendWithTracing` around the deterministic `recommend` function. See the file header for why that surface was chosen.

LangSmith is **disabled by default**. Enable it only when you have a project-scoped API key and are ready to review what gets sent (counts/ids only — never raw evidence, workflow payloads, or secrets).

---

## 1) Prerequisites

- A LangSmith account. Your screenshot shows `smith.langchain.com/o/4a003618-bba6-48eb-ac1c-23b860739572` — that is the LangSmith organization shown in your LangSmith UI (left sidebar: Tracing / **Engine** / Monitoring / Datasets & Experiments). Keep the org id; do not paste it into source code.
- A project inside that organization. This repo uses `secondary-condition-finder` (see `LANGSMITH_PROJECT_NAME` and `.env.example: LANGSMITH_PROJECT`). The name is stable on purpose — Engine clusters issues by project.
- A **project-scoped API key** (`lsv2_pt_...`). Create it in LangSmith → **Settings → API Keys**. Copy it once; you can filter the key to that single project.

## 2) Datasets & Experiments (the left-sidebar item in your screenshot)

**Datasets** are curated input/output pairs (curated from production traces or uploaded from `tests/` fixtures). **Experiments** run an evaluator over a dataset — for example, scoring whether the engine returns the expected catalog conditions for a given intake.

For this repo:

1. In LangSmith, open **Datasets & Experiments** → **New Dataset**.
2. Seed it from a handful of real `RecommendationResult` traces after you enable tracing (next section), or upload a JSON/CSV derived from `data/` fixtures — one row per intake (`primaryConditions`, `diagnosedConditionIds`, optional `conditionTimeline`) paired with the expected `recommendation.conditionId` set.
3. Add an evaluator (e.g. exact-match on the recommended `conditionId` set, plus a “no unrecognized” check). The LangSmith docs under *Datasets and Experiments* / *Evaluate an agent* describe the evaluator authoring flow; no code change in this repo is required to run an experiment — it runs against the project traces already collected.

This mirrors your second screenshot/document: **Datasets → Experiments — LangSmith**.

## 3) Enable tracing in this repository

Tracing only emits when **all** of these hold:

```
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...          # project-scoped key
LANGSMITH_PROJECT=secondary-condition-finder
# LANGSMITH_ENDPOINT=https://api.smith.langchain.com  # default; change only for EU/APAC tenants
```

Place them in `.env.local` for local dev or in **Vercel → Project Settings → Environment Variables** for Preview/Production. The variables are server-only — do not prefix with `NEXT_PUBLIC_`. `src/lib/observability/langsmith.ts` is `server-only` so a missing import on the client is a build error by design.

Verify locally. No shipped request path runs the traced wrapper any more — the six-step workflow executes the engine in the browser — so walking Step 1 → Step 5 emits no trace. Verification is two out-of-band checks: the key authenticates and is scoped to the project, and an explicit trace is accepted. Neither prints the key.

```bash
# 1) The key authenticates and can read the project (status code only).
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "x-api-key: $(grep -E '^LANGSMITH_API_KEY=' .env.local | cut -d= -f2-)" \
  'https://api.smith.langchain.com/api/v1/sessions?name=secondary-condition-finder'
# 200 = valid and scoped. 401/403 = wrong, revoked, or wrong-scope key.

# 2) An explicit trace is accepted by ingestion.
LANGSMITH_TRACING=true node --env-file=.env.local --input-type=module -e '
  const { traceable } = await import("langsmith/traceable");
  const probe = traceable(async () => ({ ok: true }), {
    name: "smoke-hello", run_type: "chain", project_name: "secondary-condition-finder",
  });
  await probe();
  console.log("smoke trace submitted");
'
# → a `smoke-hello` run appears in LangSmith → Tracing → secondary-condition-finder
```

The traced surface is deliberately redacted: `processInputs` ships only counts (`primaryConditions`, `diagnosedConditionIds` length, `hasTimeline`, `engineVersion`); `processOutputs` ships only bounded counts (`recommendationCount`, `recognizedPrimaries`, `unmappedPrimaries`). Exceptions are also a trace input in the installed SDK: its `traceable` wrapper records `String(error)` on rejection, so `recommendForTraceSafely` replaces thrown recommendation errors with a fixed message before the SDK sees them. Processor failures return fixed fallback DTOs. Synthetic sentinel regressions cover successful and failed paths. No raw intake text or document content is sent. Deployed LangSmith enablement, project settings and collector retention/access still require operator review.

`recommendWithTracing` is a server-side entry point for synthetic or public inputs only (`src/lib/engine/recommend-tracing.ts`); its current callers are tests, not request paths. When `LANGSMITH_TRACING !== "true"` it falls straight through to the synchronous `recommend` with no extra overhead or Promise cost beyond the `async` boundary. Do not trace additional request-derived functions without equivalent input/output redaction and a fixed-message exception boundary.

## 4) Connect Engine to GitHub so it can open automated diagnostic PRs

This is the feature you requested: **Automated Diagnostics and Pull Requests — By connecting LangSmith Engine to your repository, it can read your source code to diagnose errors found in your application traces. Once connected, the Engine can automatically open pull requests with proposed fixes directly in your codebase.**

Only a LangSmith **organization admin** can connect a GitHub repository. The flow (LangSmith UI → **Engine** in the left sidebar) is:

1. Open your LangSmith org (`o/4a003618-bba6-48eb-ac1c-23b860739572` from the address bar in your screenshot) → left sidebar **Engine** (the entry with the green + badge).
2. Click **Connect a GitHub repository** (or **Settings → GitHub** if already connected). Authorize the LangSmith GitHub App and grant it access to `richardparslow-commits/Secondary_Condition_Finder`.
3. Confirm the repository appears as connected under Engine. From that point Engine may — without any extra code change — scan traces, cluster failures, and open PRs against your default branch when it can propose a fix. PRs appear as normal GitHub pull requests (labelled by Engine) and are gated by the same `CI` + `verify-regulatory-intelligence` + `Production Runtime Readiness` checks as any other PR.

No service credentials beyond `LANGSMITH_*` are checked into the repository. Engine reads source through the GitHub App installation you authorized in the LangSmith dashboard, not through a token in `.env`.

Recommended repository hygiene while Engine is enabled:

- Keep `main` protected (it already is — this repo merges via PRs #426/#427/#428) so every Engine PR must pass CI before merge.
- Review Engine PRs the same way you review human PRs — especially for `src/lib/engine/**` and `src/lib/observability/**`.
- If you fork or reconnect, rotate the GitHub App installation instead of pasting tokens.

## 5) Production deployment checklist (Vercel)

1. Add `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, and `LANGSMITH_PROJECT` to **Vercel Project Settings → Environment Variables → Production** (and Preview if you want preview traces).
2. Redeploy (Vercel redeploys pick up new env vars on the next deployment — they are not retroactive).
3. Do not expect a trace from the deployed app: nothing under `src/app` calls the traced wrapper, so a production visit emits no `recommend` run. Verify the key out of band with the two checks in §3, and record that outcome. `LANGSMITH_API_KEY` in Vercel only matters if a server path starts tracing again.
4. No `next.config.ts` / CSP change is needed: tracing is a server-side `fetch` from the Next.js server to `api.smith.langchain.com`, not browser egress, so `connect-src 'self'` stays intact (see `docs/deployment-readiness.md` Browser security baseline).

## 6) Key rotation — the screenshot exposed `lsv2_pt_39a0...`

The API key visible in your screenshot (prefix `lsv2_pt_39a0...` — full value was in the **TRACE AN EXISTING AGENT** box) must be treated as compromised — a screenshot plus the org URL is sufficient to identify the key. You also forwarded the same value in the PDF/screenshot pair. The full value is deliberately not repeated here.

Do this now, even if the key was project-scoped and tracing was still `Waiting for traces...`:

1. In LangSmith → **Settings → API Keys**, locate the key beginning `lsv2_pt_39a0...` and **revoke/delete** it.
2. Create a replacement project-scoped key (scope it to `secondary-condition-finder` only).
3. Replace `LANGSMITH_API_KEY` in every place you pasted the old value: `.env.local`, any Vercel environment variable, password managers, and the PDF/screenshot you shared. Do not paste the new key into Git, into a GitHub comment, or into the `.env.example` committed to the repo (that file intentionally contains only placeholders).
4. Redeploy once after rotation if Vercel was configured with the old key.

This guide deliberately includes only the prefix `lsv2_pt_39a0...` so the exposed secret is not repeated verbatim in version control. The full value should be removed from any shared artifacts (including the attached PDF) after rotation.

**2026-10-22 — a second exposure.** The secret-scan gate found the *replacement* project key committed in `docs/langsmith-correctness-audit-2026-09-13.md`; the full value has been removed from the tree and is recorded as compromised. The same four steps above apply to it. That rotation was performed on 2026-10-22: the replacement passed both §3 checks and the exposed key was revoked with `403` confirmed. The procedure and the [rotation record](security-operations.md#rotation-procedure-and-record) live in the security operations runbook; a green scan did not close this — the recorded rotation does.

## 7) What this repository does NOT do

- No browser-side LangSmith SDK is added. The recommendation engine runs server-side only.
- No OpenAI/Anthropic SDK is wrapped. If a future LLM step is added, wrap it with the provider-specific `wrap*` helper and add a second `traceable` at that boundary — do not send prompts/completions without an explicit redaction pass.
- No `NEXT_PUBLIC_LANGSMITH_*` variables are introduced.

## 8) References

- LangSmith **Engine** and **GitHub diagnostics & PRs**: LangSmith docs — *Engine* → *Automated Diagnostics and Pull Requests* (the feature described in your request and visible as **Engine** in the left sidebar of your screenshot).
- LangSmith **Datasets & Experiments**: LangSmith docs — *Datasets & Experiments* (the second screenshot/document you attached).
- SDK: `langsmith@^0.10.3` (`package.json`), `langsmith/traceable` (`src/lib/observability/langsmith.ts`).

### The two “Paste prompt into your coding agent” boxes in the screenshot

The onboarding boxes you saw (“Install LangChain open source skills … deepagents-python-quickstart” and “Install LangSmith skills … langchain-trace skill”) are the LangSmith dashboard’s generic quickstart prompts. For this already-built Next.js repository the equivalent is already done: `npm install langsmith` + `src/lib/observability/langsmith.ts` + the `recommendTraced` wrapper, as described in sections 3–4 above. You do not need to run the generic LangChain Python quickstart inside this repo.
