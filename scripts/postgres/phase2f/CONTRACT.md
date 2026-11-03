# Private synthetic feed preview contract

This is not an activated application API. The normal frontend and feed stay unchanged.

Preview proxy base: `/__mockup/prototype`.

- GET `/session?actor=101` returns `{token,actor,actors:[{badge,name}],synthetic:true}`.
  These are invented local fixture sessions, never the normal app sessions.
- GET `/feed?pagination=keyset-v1&limit=8&feed=company&sort=legacy`
  with `x-session` returns `{ideas,stats,page:{version:"keyset-v1",state:"more"|"end",nextCursor,order:"legacy",limit}}`.
  Next calls include `cursor`. `feed` is company/following/today; optional `group`,
  `kind=story|post|poll|announcement|event` and `saved=1` are supported versioned
  filters. Group membership is checked even for empty groups.
- `/feed` without opt-in preserves the reference full response in the isolated server.
- `sort=new|old|top` or a nonempty `q` returns HTTP 422
  `{error:"product_decision_required",state:"unsupported",detail:...}`. Do not fake
  client-wide sorting/search by applying them to one page.
- GET `/item?id=...` returns the same fully enriched response envelope with zero/one
  authorized matching items, independent of the current page.
- POST `/control` with JSON `{action:"insert"|"expire"|"error"}` controls invented
  test scenarios only. Insert uses the existing private full-entity fixture writer;
  expire advances only the cursor verifier's diagnostic clock, not auth clocks
  or keys; error injects a single proxy failure for the next feed call.

Cursor failures: 400 invalid, 403 actor/scope mismatch, 409 revision restart,
410 expired; `{error,state:"restart"|"error"}`. Authorization failures remain
401/403. Fresh auth/membership checks run before cursor processing.
Read-only replay is allowed inside its lifetime/revision, not an auth credential.
Cursor lifetime is fixed across a chain. No unsigned internal cursor crosses HTTP.

Preview is read-only: saved filter/flags are real; bookmark mutation is not added.
Global stats are exact raw-post stats, not page stats. DOM/data window max 80;
eviction must be disclosed and Refresh restores the first window. Deep links use
`#idea=...` and `/item`, with fresh authorization.
