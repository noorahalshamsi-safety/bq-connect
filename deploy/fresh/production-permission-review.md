# Fresh-install Production permission review

## Read-only evidence

Obtained through supported `executeSql(environment: "production")`, not a
Development connection. That tool uses a read-only Production replica.

- Database: `neondb`; query/session role: `neondb_owner`.
- Target schema `dev`: 117 tables, 800 columns, 423 constraints, 348 indexes.
- `CONNECT` and schema `USAGE`: granted.
- `SELECT`, `INSERT`, `UPDATE`, `DELETE`: granted on every one of the 117 tables.
- Database, schema and all 117 tables: owned by the queried role.
- Schema sequences: zero; no sequence grants are needed for this schema.
- Inspection connection: transaction read-only. No application records were
  read or changed, no initialization or DDL was executed.

These are catalog/schema-count checks, not a new full structural fingerprint
audit or a claim that all application tables are currently empty. The stored
schema, release, source directory and bucket fingerprints were preserved.
The initializer still checks exact schema and empty destination before writing.

## Exact existing permission contract

The Production query used the SELECT implemented by
`release-preparation/maintenance-cd5bd76/source/deploy/managed/config.cjs`
`permissions(client)`. Its actual boolean result was passed through that
existing function's canonicalization and SHA-256 implementation:

```json
{"database_create":true,"elevated_membership":true,"rolbypassrls":true,"rolcreatedb":true,"rolcreaterole":true,"rolsuper":false,"schema_create":true}
```

Fingerprint:

```
fcfdb753f0653791e34b6f98c7f86eb3df53afccc9dc7ff32c3fa6dcd681943f
```

This is not a Development digest or a value generated from assumed privileges.
It was recorded in the draft manifest together with the observed Production
role. The published application's actual connection must still match that
role and the approved endpoint; no runtime connection was inspected here.

## Adequacy and residual risk

The queried role has the required table/data privileges for initialization and
normal operation, but is **not least privilege**:

- `rolcreatedb`, `rolcreaterole` and `rolbypassrls` are true.
- Database/schema creation privileges and elevated role membership are true.
- Database/schema/table ownership permits owner-level schema changes, including
  destructive changes outside the application.
- `rolsuper` is false; this does not remove the above powers.

No privileges were changed. Do not imply that the application's no-DDL policy
removes the role's independent ability to alter/drop objects or bypass RLS.
Owner acceptance of these residual privileges has **not** been supplied.
`permissionApproval` therefore remains `null`.

## Endpoint and TLS limitation — BLOCKED

Supported Production SQL tooling exposed a proxy/backend address, not the
application connection hostname. Its own inspection connection reported SSL
disabled and no negotiated TLS version/cipher. This does **not** establish the
published application's TLS capabilities or certificate/hostname verification.
Do not use that backend address as `endpoint.hostname`, derive a hostname,
disable TLS, or claim the fresh runtime's strict TLS check has passed.

The supported next source is **Database → Production Database → Settings →
connection details**. The owner must verify/provide only the actual hostname,
port and role, without sharing a password or complete connection string.
`endpoint.hostname` remains `null`. The code will still require certificate-
verified TLS at the actual application endpoint; that has not been observed.

Official references consulted:
- https://docs.replit.com/features/data-and-storage/connection-details
- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/data-and-storage/work-with-your-data

## Remaining owner decisions

1. Verify the actual Production hostname/connection identity and strict TLS.
2. Explicitly accept the documented broad capabilities, or separately authorize
   a least-privilege plan; only then set
   `permissionApproval: "reviewed-managed-runtime-capabilities"`.
3. Supply `initialAdminBadge` and company `emailDomains`. Neither was invented.
4. Finish fresh Production Secrets/provider configuration and the final
   manifest-digest review. Changes to Production app secrets stay pending
   until the owner-approved publication applies them.
5. Separately approve maintenance-only initialization, review reconciliation,
   then approve activation and the one-use administrator bootstrap.

Nothing in this review approves an import, activates the application, changes
secrets or triggers Publishing. Keep Development-data copying disabled.
