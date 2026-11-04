# Persistence architecture — design only

Read `reports/TRANSACTIONAL_PERSISTENCE_ARCHITECTURE.md` first. Production remains
NO-GO. These files are not a live database adapter or a production migration.

## Reproduce isolated evidence

Requires Node 22, PostgreSQL 16 tools (`initdb`, `pg_ctl`, `psql`, `createdb`,
`pg_dump`) and `stdbuf`. No runtime dependency or deployment change is needed.
If tools are unavailable, stop rather than configure a production connection.

```sh
node scripts/architecture/inventory.cjs
node scripts/architecture/validate.cjs
node scripts/architecture/report.cjs
```

- Inventory reads application source and data filenames only, never data contents.
- Validation accepts no arguments, database URL, source data path or credentials.
- It creates a fresh private `/tmp/bq-architecture-*` PostgreSQL cluster, uses
  Unix sockets only, invents all records/keys/media and cleans the cluster up.
- It copies only `auth.js` and its safety helper into that temporary directory.
  Their compatibility checks run against invented JSON reconstructed from SQL.
- No real employee/account files, production APIs, storage SDK, deploy/publish
  operations, actual signing/backup keys or managed schema writes are used.
- The normalized reverse exporter covers accounts/employees/posts and embedded
  post children. Other files are preserved in a synthetic source ledger with
  additional relational import checks; full reverse mapping is not implemented.
- Real secret-bearing source files must use protected encrypted escrow in a
  future approved migration, not plaintext ledger rows like the fake fixtures.
- Logical backup/restore compares all 59 prototype tables. It does not certify
  hosted PITR, real backup decryptability, object retention or app rollback.

Generated report, inventory, scenario matrix and evidence JSON are under
`generated-artifacts/architecture/`, already excluded from Git/deployment.
The generated report includes all four appendices and the complete design DDL.
