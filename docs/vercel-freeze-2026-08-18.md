# Vercel deployment freeze

Vercel is intentionally frozen through **2026-09-11T15:11:00-05:00**.

During the freeze:

- Do not deploy or promote a Vercel deployment.
- Do not change Vercel environment variables, domains, project settings, integrations, or deployment configuration.
- Do not perform repository writes/pushes that could trigger an active Vercel Git integration unless that integration is first proven incapable of creating a Vercel deployment.
- Local coding, local tests, local builds, and read-only GitHub inspection are allowed.
- Azure/GitHub CI is outside this provider-specific freeze unless a change would indirectly trigger Vercel.

The repository guard is `.deploy-freeze.json` plus `npm run deploy:guard:vercel`. The guard intentionally has no bypass flag. It exits nonzero while the freeze is active and automatically stops blocking after the configured deadline.

Important: a repository script cannot intercept an external GitHub→Vercel integration by itself. The operational control during the freeze is therefore **no remote repository write that could trigger Vercel**.
