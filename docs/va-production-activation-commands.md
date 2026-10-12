# VA production activation — operator command checklist

Companion to [va-api-runtime-configuration.md](va-api-runtime-configuration.md) §Controlled production connectivity check (issue #287). Every command below is copy-paste runnable; placeholders in `<ANGLE_BRACKETS>` must be replaced with real values. **No secret value may be typed into a shell argument** — all credential entry uses GitHub's web UI secret store or `gh secret set --body` via a local file. Ordered, fail-closed: each step gates the next.

## Prerequisite check before starting

```bash
# Confirm you are on merged main and the working tree is clean
git fetch origin main && git rev-parse origin/main && git status --porcelain

# Confirm runbook tooling versions
node --version    # 22.18+ required by the operator CLI contract
gh --version
```

## Step 1 — Record the VA grant (operator action, outside the shell)

Obtain the actual VA production grant for **both** services, then record — do not fabricate — the evidence:

```bash
# Record the grant offer letter / email with approved scope and granted services.
# Create a durable local record (do NOT paste grant contents into a public issue):
cat > "$HOME/va-grant-2026.txt" <<'EOF'
<Grant date, VA contact, approved services (Forms + Benefits Reference Data),
approved scope, granted production origin (api.va.gov), expiry/rotation terms>
EOF
# Keep a redacted copy of just the approval facts in a private location; never commit
# the letter itself, and never paste scope text into #287 beyond the required go/no-go.
```

There is no shell command for the VA side. Do not proceed to Step 2 until the grant letter exists.

## Step 2 — Configure the `va-production-reference` GitHub environment

The workflow names this environment but **does not create or protect it**; the operator must configure the environment and its protection rules *before* adding credentials.

```bash
RepoURL=$(git remote get-url origin | sed 's|https://github.com/||; s|\.git$||')
echo "Using repo: $RepoURL"

# Confirm the environment exists (created at first dispatch; list it explicitly here):
gh api "repos/$RepoURL/environments" --jq '.environments[] | .name'
# Expect: va-production-reference

# Confirm main's protection state. As of 2026-10-12 this repo has no branch
# protection (API returns "Branch not protected", HTTP 404 — verified) even though the
# 2026-10-11 progress comment described main as protected. The environment's
# main-only deployment-branch policy still bounds dispatch to the workflow itself, but
# protect main before relying on any protection-derived guarantee:
gh api "repos/$RepoURL/branches/main/protection" --jq '.' | head -5
# If it errors with "Branch not protected", protect main first via
# Settings → Branches → Add rule → Require pull request reviews before merging,
# or accept and record the known gap in issue #287 before proceeding.
```

Then in GitHub web UI (**Settings → Environments → `va-production-reference`**):

1. **Deployment protection rules:**
   - Required reviewers: add at least one named human reviewer. GitHub requires a paid
     Team/Enterprise plan for this rule; if unavailable, document the compensating
     controls (main-only deployment policy, admin bypass disabled, audit log review) in
     issue #287 before proceeding without it.
   - Wait timer: 0–5 min (optional on the paid plan).
2. **Deployment branches and tags:** select **"Selected branches and tags"** and set the
   deployment-branch policy to `main` only. This is the main-only hardening already
   promised in the 2026-10-11 #287 progress comment ("protected-branches deployment
   policy (main-only; main is protected)").
3. Confirm zero environment secrets exist at this point — nothing was provisioned ahead
   of the actual grant.
   ```bash
   gh api "repos/$RepoURL/environments/va-production-reference/secrets" --jq '.secrets'
   # Expect: [] at this stage (no secret names listed yet).
   ```

## Step 3 — Set the grant variable (unsigned, non-secret) in the environment

Set **only after Step 1's grant letter exists** — this variable acknowledges an actual VA grant in code, not a wish:

```bash
# Method A (recommended — via gh CLI, no secret involved; variable is public-safe):
gh api -X POST "repos/$RepoURL/environments/va-production-reference/variables" \
  -f name=VA_PRODUCTION_ACCESS_GRANTED \
  -f value=true

# Verify:
gh api "repos/$RepoURL/environments/va-production-reference/variables" --jq '.variables'
# Expect at least: {"name":"VA_PRODUCTION_ACCESS_GRANTED","value":"true",...}
```

(Also confirm it is *not* a repo-level variable — it must be scoped to this environment only:

```bash
gh api "repos/$RepoURL/actions/variables" --jq '.variables'
# Expect: NOT to include VA_PRODUCTION_ACCESS_GRANTED.
```
)

## Step 4 — Add the two production secrets (server-only, never on a command line)

Enter the two key values through **one of these two channels** — never as a shell argument, chat message, or committed file:

**Method A — GitHub web UI (Settings → Environments → `va-production-reference` → Environment secrets → Add secret, one at a time):**
- `VA_FORMS_PRODUCTION_API_KEY` — value from the VA Forms production credential.
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY` — value from the VA Benefits Reference Data production credential.

**Method B — `gh secret set` reading from a private local file the editor already created (never a shell argument):**

```bash
# Each file contains ONLY the key value (no trailing newline beyond one).
# Assume you already created them in a secure local editor outside git:
#   $HOME/.va-secrets/va_forms_production_api_key
#   $HOME/.va-secrets/va_benefits_reference_production_api_key

gh secret set VA_FORMS_PRODUCTION_API_KEY \
  --repo "$RepoURL" \
  --env va-production-reference \
  --body-file "$HOME/.va-secrets/va_forms_production_api_key"

gh secret set VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY \
  --repo "$RepoURL" \
  --env va-production-reference \
  --body-file "$HOME/.va-secrets/va_benefits_reference_production_api_key"

# Verify only the NAMES exist (values are never returned by the API):
gh api "repos/$RepoURL/environments/va-production-reference/secrets" --jq '.secrets[] | .name'
# Expect exactly: VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY, VA_FORMS_PRODUCTION_API_KEY
```

Then shred the local staging files:

```bash
shred -u "$HOME/.va-secrets/va_forms_production_api_key" \
      "$HOME/.va-secrets/va_benefits_reference_production_api_key"
```

**Keep application VA access disabled** during this whole stage. Confirm locally that no app-level flag is inadvertently set in the deployed environment:

```bash
curl -s https://secondary-condition-finder.vercel.app/api/health | \
  python3 -c 'import json,sys; d=json.load(sys.stdin); va=d["components"]["vaConfig"]; print(va["enabled"], va["environment"], va["detail"])'
# Expect: False sandbox disabled (sandbox) — local fallback active
```

## Step 5 — Run the controlled connectivity check (application still disabled)

```bash
# Manually dispatch the check from merged main, with explicit confirmation:
gh workflow run "VA Production Reference Check" \
  --repo "$RepoURL" \
  --ref main \
  -f confirm_va_grant=true

# Wait ~30 s for the run to register, then get the run id:
sleep 30
RUN_ID=$(gh run list --repo "$RepoURL" --workflow "VA Production Reference Check" \
  --limit 1 --json databaseId --jq '.[0].databaseId')
echo "Controlled check run: $RUN_ID"

# Watch the run:
gh run watch "$RUN_ID" --repo "$RepoURL" --exit-status
echo "Watch exit: $?"    # 0 = job succeeded
```

Rules the operator must remember:
- **Skipped is not a pass.** If the job skips (protected-branch policy refusal, non-main
  dispatch, or a missing/unconfirmed input), the run is not evidence of anything.
- **Failure is expected and honest** if a key is wrong, an endpoint refuses, a payload
  schema mismatch, 401, 429, timeout, or oversized body — the CLI stops at the first
  failure. Review the sanitized step summary (`gh run view "$RUN_ID" --repo "$RepoURL" --log | grep -E 'Refusal|HTTP|validated' | head -20`); never copy raw payload or key material from logs into the issue.
- Attach the sanitized run record (run URL, SHA, timestamp, HTTP statuses, validation
  counts) to issue #287 manually. The workflow has no issue-write permission.

Alternative CLI path (in a controlled operator environment with server-only production keys already exported, app flags absent or false, Node 22.18+):

```bash
VA_PRODUCTION_ACCESS_GRANTED=true \
VA_API_ENABLED=false \
VA_SANDBOX_ENABLED=false \
VA_FORMS_PRODUCTION_API_KEY="$(cat "$HOME/.va-secrets/va_forms_production_api_key")" \
VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY="$(cat "$HOME/.va-secrets/va_benefits_reference_production_api_key")" \
node scripts/verify-va-production-reference.mts --confirm-va-production-access
# Nonzero exit = refusal or failure; retry only after correcting configuration, not the check.
```

Do not put secrets on the command line in any other form; the pattern above uses command substitution so the key material goes into the process env block, not into a visible argument or shell history. Local CLI success alone is not production evidence — it establishes controlled connectivity only.

## Step 6 — Deliberate production activation (with explicit operator approval)

Only after Step 5's evidence is reviewed and approved. This step changes the Vercel/production environment configuration; treat it as a deployment-affecting change.

```bash
# prerequisite: npx vercel (or install once: npm i -g vercel), logged in with the
# right team/project: npx vercel link
# 1. Configure the shared coordinator (Upstash or equivalent HTTPS Redis-REST), then
#    set Vercel env vars in team/project scope. Both `npx vercel env add KEY
#    <environment>` (prompts for the value; paste interactively — safest) and the
#    explicit-value form are supported; the prompt form never puts the secret on a
#    command line:
npx vercel env add VA_REFERENCE_SHARED_CACHE_URL production     # prompt: paste https://<rest-endpoint>
npx vercel env add VA_REFERENCE_SHARED_CACHE_TOKEN production   # prompt: paste token
npx vercel env add VA_REFERENCE_SHARED_CACHE_PREFIX production  # prompt: paste va:ref:
npx vercel env add VA_SHARED_CONSUMER_BUDGET production         # prompt: paste true
npx vercel env add VA_FORMS_PRODUCTION_API_KEY production       # prompt: paste value
npx vercel env add VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY production  # prompt: paste value
npx vercel env add VA_PRODUCTION_ACCESS_GRANTED production      # prompt: paste true
npx vercel env add VA_API_ENV production                        # prompt: paste production
npx vercel env add VA_API_ENABLED production                    # prompt: paste true
# Do NOT set: VA_SANDBOX_ENABLED, VA_FORMS_SANDBOX_API_KEY, or any *_BASE_URL override
# unless VA is relocating the origin — see the base-URL gate in resolveVaReferenceMode.

# 2. Trigger a new production deployment so new env values take effect:
npx vercel --prod --yes
# Wait for READY and alias convergence:
sleep 60
npx vercel ls --prod | head -5
```

## Step 7 — Verify the deployed runtime and record the live evidence

```bash
# Full CI is already required on the exact deployed SHA; confirm the commit is the
# deployed one and CI is green. Then Production Runtime Readiness must be green:
PROD_SHA=$(git rev-parse origin/main)
gh run list --repo "$RepoURL" --workflow "Production Runtime Readiness" \
  --limit 1 --json headSha,conclusion --jq '.[] | select(.headSha=="'"$PROD_SHA"'")'

# Live production reference checks in a real browser (also fine via curl for status):
curl -s -o /dev/null -w '%{http_code}\n' https://secondary-condition-finder.vercel.app/va-forms/finder
curl -s -o /dev/null -w '%{http_code}\n' https://secondary-condition-finder.vercel.app/va-reference
curl -s -o /dev/null -w '%{http_code}\n' https://secondary-condition-finder.vercel.app/va-reference/service-branches

# Provenance check — required: 'va-production-api', NOT 'Local catalog fallback':
curl -s https://secondary-condition-finder.vercel.app/va-reference | \
  grep -oE 'va-production-api|Local catalog fallback|sandbox-api' | sort -u | head -5
# Expect: va-production-api

# Shared coordination verification on the same deployed runtime (two instances if you
# can, otherwise two sequential requests) — expect cache HIT on the second read and a
# consumer-budget reservation, not per-process bypass:
curl -s https://secondary-condition-finder.vercel.app/va-reference/service-branches | \
  grep -oE 'cache: (HIT|MISS)' | head -2
# Record both outcomes; MISS on re-read signals the shared tier is not participating.

# Immediately after, verify rollback readiness (see below) WITHOUT activating it —
# keep a signed-off rollback plan in #287 before declaring the deployment complete.
```

**Rollback (pre-committed, for immediate use if any check fails):**

```bash
npx vercel env rm VA_API_ENABLED production   # disable immediately (interactive confirm)
npx vercel --prod --yes                       # re-deploy the same SHA with the flag off
sleep 60
curl -s -X POST https://secondary-condition-finder.vercel.app/api/admin/cache-clear \
  -H "Authorization: Bearer $CRON_SECRET"   # invalidate the shared reference cache fleet-wide
curl -s https://secondary-condition-finder.vercel.app/va-reference | \
  grep -oE 'va-production-api|Local catalog fallback' | head -2
# Expect: Local catalog fallback
```

## Step 8 — Close issue #287 (operator action, with recorded objective evidence)

Only after **all** prior steps have objective recorded evidence:

1. The VA grant record (Step 1).
2. The controlled-check sanitized evidence attached to #287 (Step 5).
3. Live `va-production-api` provenance, expected production labels, valid data, retrieval
   timestamps and shared hit behavior across instances on the exact deployed SHA (Step 7).
4. Full CI and Production Runtime Readiness green on that exact SHA (Step 7).
5. A signed-off rollback/verification plan (Step 7's pre-commitment).

Close manually via the issue page or `gh issue close 287 --repo "$RepoURL"` — **never** rely on automation to do it; the repo's workflows intentionally have no issue-write permission for this task.

## Cross-references
- Full runbook: [va-api-runtime-configuration.md](va-api-runtime-configuration.md)
- Gate status and ownership: [external-manual-gates-status.md](external-manual-gates-status.md)
- Credential rotation SOP: [credential-rotation-sop.md](credential-rotation-sop.md)
- Verification CLI: [scripts/verify-va-production-reference.mts](../scripts/verify-va-production-reference.mts)
- Controlled-check workflow: [va-production-reference-check.yml](../.github/workflows/va-production-reference-check.yml)
