# Verification, deployment and rollback

Target: public `swapupg/agent-failure-recipes`, independent GitHub Pages project at https://swapupg.github.io/agent-failure-recipes/. No changes to the Model Fieldnotes source, hosting, DNS, or editorial schedules are required.

## Release

1. Confirm a clean, scoped tree and review the public files. Use Node 24, `npm ci`, `npm run check`, `npm audit --audit-level=high` and `npm run test:e2e` with the three browser engines installed.
2. Push the candidate. The pinned Actions workflow reruns all checks plus a Git history secret scan, four browser projects, clean package-install test and the 100 KB compressed JavaScript budget.
3. The verify job archives the compiled library and website, SHA256SUMS and per-file manifest for 90 days. The deploy job receives the verified Pages artifact; it does not rebuild it.
4. The production smoke job checks the exact source revision and every static file hash over HTTPS, then runs the Chromium user journeys against the public site.
5. Only create a versioned GitHub release from the exact passing commit after production verification. Upload the workflow's retained package, site archive, checksums and manifest. No npm registry publication is implicit.

Package and recipe revisions are separate: version 0.1.0 includes revision 1 for each recipe. Preserve published recipe routes or add a new revision. Do not silently reinterpret old shared links.

## Rollback

Preserve the last verified release tag and its assets. Dispatch `Verify and deploy recipes` from main with `deploy_ref` set to that exact previous commit/tag. It revalidates the prior source, builds an artifact, deploys, and checks the runtime revision. No user data or migrations exist. If this is the initial release, disable the new Pages site if it must be withdrawn; do not alter any other site or repository.

Source and artifacts are recoverable through Git history and GitHub releases. A rollback redeploy is not routinely exercised on production. Use the previous version's package and route compatibility when reverting.

## Operations

The owner handles issues and releases on a best-effort basis. CI and deployment smoke are event-driven checks, not continuous uptime monitoring. There is no backend, queue, database or collected user content to back up. Theme preference is optional browser storage and is intentionally not backed up.

Browser engines and viewport emulation are named in evidence; no physical mobile-device, manual screen-reader or user-pilot success claim follows from automated checks. Audit and secret-scan results apply to the exact candidate, not future code.
