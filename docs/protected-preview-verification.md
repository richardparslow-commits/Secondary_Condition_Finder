# Protected preview verification

Use a non-production branch and keep Vercel Authentication enabled. Record the
exact commit and deployment before testing; do not promote it to production.

For the isolated `codex/protected-preview-bootstrap` preview, configure these
variables with target **Preview** and that exact Git branch:

- `WORKFLOW_SESSION_SECRET`: a generated sensitive value of at least 32
  characters. Never put its value in source, screenshots, logs, or this document.
- `VERCEL_PREVIEW_FEEDBACK_ENABLED=0`: prevents Vercel's injected feedback
  module from attempting to load `https://vercel.live/.../feedback.js` before
  hydration. That external URL conflicts with the application's intentionally
  same-origin Trusted Types policy. Do not weaken the CSP to accommodate it.

Create a new preview after changing environment variables. Existing immutable
deployments retain their previous build/runtime configuration.

Vercel documents branch-scoped toolbar configuration here:
https://vercel.com/docs/vercel-toolbar/managing-toolbar

Verify the following against the exact new preview URL:

1. Unauthenticated access remains protected; an authorized browser can open it.
2. `/api/health` is HTTP 200 and reports workflow-session readiness as `ok`.
3. `/secondary/diagnosed` renders condition selection, without an application
   Trusted Types exception or an indefinitely loading condition list.
4. A synthetic diagnosed-condition journey reaches review and evidence, retains
   selections through reload/back navigation, and exports the expected summary.
5. Check narrow and wide layouts, and retain browser/server evidence of failures.
6. Confirm the production deployment ID and aliases are unchanged.

The tests use synthetic data only. A healthy preview does not establish medical
or legal accuracy, production configuration readiness, or launch approval.

Reuse ready previews where practical and record builds against the authorized
budget. Team-wide, delayed billing totals do not establish an exact per-test cost.

## Privacy contact configuration

`PRIVACY_CONTACT_EMAIL` is a public contact setting, not an authentication secret. Set it only to a mailbox the operator owns, monitors and explicitly approves for publication. For this testing branch, scope it to Preview and `codex/protected-preview-bootstrap`; do not change Production. No account sign-in address is inferred or published automatically. Redeploy after changing the setting.

With the setting absent or invalid, `/privacy` and `/privacy/request` disclose that privacy contact is unavailable and publish no mailto actions. With an approved setting, both pages use the same validated bare mailbox; request text stays in the visitor's own email client. The old domain is retained only in the dated delivery finding and is not a publication fallback.

Run the privacy-channel verifier with the same setting as the deployment. Domain/mail-route checks do not prove that a human reads a mailbox: the operator must separately confirm monitoring and complete the documented send/receive check before closing the operational contact gate. This code change alone does not clear that gate.
