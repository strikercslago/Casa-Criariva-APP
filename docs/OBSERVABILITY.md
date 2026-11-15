# Observability

## Frontend

`reportError(error, context)` is the application boundary for future error tracking. In development it writes sanitized console errors. In production it does not leak stack traces to users.

Auth diagnostics are development-only and record status, route, method and duration. They do not log passwords, tokens, Authorization headers, request bodies or emails.

Web Vitals record CLS, INP and LCP in development. A paid analytics/error tracking service was not added.

## Supabase

Use the Supabase dashboard for:

- Auth logs: sign-in failures, invite delivery, MFA issues.
- API/PostgREST logs: RLS denials, 401/403/500 responses.
- Postgres logs: function errors and constraint failures.
- Edge Function logs: `admin-users` failures.

## Slow Paths

Monitor Dashboard, Financeiro, Mensalidades and Agenda first. These routes depend
on aggregation RPCs and should be checked after migrations affecting joins,
indexes or policy helpers. Materials and Reports are no longer frontend routes.

Auth error diagnostics retain name, code, status and the presence of a message,
but do not forward raw error messages that may contain email addresses or secrets.
Production `reportError` currently has no remote sink: this is not operational
alerting. Establish latency, error, traffic and resource baselines before choosing
an alerting service. No production performance or capacity measurements were
available during the November audit.
