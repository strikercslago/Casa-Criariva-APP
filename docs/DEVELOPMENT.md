# Development

## Commands

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`

## Current development workflow

The app includes authentication, students/enrollment, guardians, classes,
agenda/attendance, billing, finance, events, feedback and settings. The home
menu links to these modules; operational indicators are at `/visao-geral`.
Materials and Reports are absent from the app. Historical SQL remains intact.

Before editing, inspect the Git diff and run typecheck, lint, unit tests and
build. For behavior changes, add a regression test and execute the relevant
E2E journey. Review changes in small batches. Avoid dependencies or layers
without a demonstrated need.

`.github/workflows/quality.yml` runs these checks plus browser tests with mocked
Supabase responses. It grants only read access and does not deploy. The workflow
must run in GitHub before its remote status can be claimed as validated.

Browser setup: `npx playwright install chromium`. On machines with Chrome already
installed, set `PLAYWRIGHT_CHANNEL=chrome` before `npm run e2e`. Build first;
Playwright starts the preview server on port 4173. In CI it never reuses an
unrelated server. E2E mocks do not validate database migrations, RLS or real Auth.

Query retries are bounded and skip permanent application/PostgREST errors.
Automatic mutation retries remain disabled. Creation flows requiring safe
manual retries must maintain their idempotency key and enforce it server-side.

See `ENGINEERING-REVIEW.md` for the audit, baseline and outstanding backend work.

## Environment

Create `.env.local` locally using `.env.example`. Do not commit real Supabase values.
