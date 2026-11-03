# Isolated PostgreSQL development entrypoint

Run **`node development/postgres/launch.cjs`**, or use the Start application workflow.

This runs the original BQ Connect UI/handlers against a new, invented PostgreSQL
dataset. It does not read imported `data/`, production keys, `.env`, environment
database URLs or actual employees. It refuses deployment activation.

PostgreSQL 16 tooling is declared through the Replit system dependency. The `pg`
driver is a normal package dependency. The cluster listens only on a private Unix
socket; the application listens on port 5000 (with a development proxy alias).

The dedicated private root is `generated-artifacts/pg-development/`, excluded
from Git and publishing by existing ignore rules. Its generated credentials are
invented, not production secrets. Never copy real data or keys into it.

Startup will not reset an existing dataset, replace missing keys, recreate a lost
provisioned database/schema or accept a foreign key-domain/dataset binding. Stop
for review if a provision receipt or authority check fails. There is intentionally
no reset, force-adopt, production-enable or automatic legacy import flag.

## Compatibility model

The original synchronous application helpers see transaction-scoped in-memory
projections loaded from relational records. The scoped filesystem facade never
reads/writes authoritative business JSON. Each request refreshes caches under
SQL serialization, stages changes and releases its HTTP response only after a
successful commit. A small isolated HTML transport shim adds retry keys without
editing the original frontend.

Known nested collections have independent rows and foreign keys. Unknown scalar
attributes remain per-record JSONB; null/absence/order and historical snapshots
round-trip. Only mail/messages intentionally retain opaque unknown legacy values.
The executable development schema is not automatic approval of the prior design
prototype or of production adoption.

Uploads use independent durable intents, immutable local synthetic objects,
checksum/readiness checks and retained legacy URLs. SMTP/SMS/push go to an
explicit fixture outbox. No real external message is delivered.

## Verification and review

```sh
node scripts/postgres/e2e.cjs
node scripts/postgres/report.cjs
```

Tests allocate their own `/tmp/bq-pg-dev-*` roots, invented keys and records.
They perform actual HTTP, process/cluster restart, concurrent processes,
commit failure/response loss, media and authority/provision failure checks,
then clean up only their own test resources.

See `reports/POSTGRESQL_DEVELOPMENT_INTEGRATION.md` for the API/entity matrices,
all original regression adaptations, remaining gaps and **production NO-GO**.
Do not publish this fixture service or remove root safety fences.
