# Replit-managed PostgreSQL candidate

This is a separate adapter for Replit's managed lifecycle. It does not weaken the
existing isolated-development or staging gates. Do not run the staging migrator
against a managed production database.

## Development

`scripts/managed/live-test.cjs` explicitly installs the reviewed schema and
invented fixtures into an **empty Replit development Helium database**. It refuses
deployment mode, a non-Helium endpoint, existing user tables/schema or pre-existing
external provision evidence. It stores invented keys/credentials and its receipt
under ignored `generated-artifacts/managed-development/`, mode 0600/0700. It never
loads employee exports or the original SESSION_SECRET. Re-running setup refuses
to replace or regenerate anything. Never delete the evidence to bypass this.

The runtime does not import/call setup. Its connections use the platform-provided
DATABASE_URL, a bounded pool and internal development transport. Helium's
documented no-TLS connection is allowed **only** in the development profile and
only for the internal `helium` endpoint. A published process cannot load that
profile. `REPLIT_ENVIRONMENT=production` alone does not mean published execution.

Actual validation:

```sh
node scripts/managed/config-test.cjs
node scripts/managed/live-test.cjs       # one-time explicit empty-development setup
node scripts/managed/schema-test.cjs    # rollback-only catalog probes, after setup
node scripts/managed/preview.cjs        # temporary invented-data preview, port 5134
```

The live test is intentionally not a resettable test database command. The
preview reuses its original synthetic dataset/keys and filesystem storage mock;
it creates no workflow or real App Storage bucket.

## Schema lifecycle

`schema.cjs` is the development schema source. It reuses all 28 document codecs,
generated columns, checks, uniqueness, graph relationships and native indices.
It has no custom role, grant, function or trigger requirement.

Managed graph foreign keys are **immediate**, rather than initially deferred.
This is a documented stronger constraint: saves insert parents before children.
The actual managed application tests verify those writes and orphan refusal.
The authority check adds an explicit `production` mode without allowing the
development runtime to accept it; `synthetic` and `frozen` remain preserved.

The original three version/checksum entries remain checked if present. Publish
does not copy their data rows. An empty ledger therefore requires the exact
reviewed structural fingerprint AND managed release fingerprint. The structural
contract checks columns/types/nullability/defaults/generated expressions,
constraints and valid indices; it ignores generated object names, not semantics.
Unknown functions, triggers, relations and RLS policy changes are blocked.
Actual provider-generated SQL still needs Publish review/validation; local or
Helium introspection cannot prove that future diff will retain every feature.

## Production is deliberately not enabled

There is no committed production manifest or activation approval.
`production-approvals.json` is empty. Production configuration requires:

- Published deployment marker and independently bound app/endpoint identity.
- No internal/localhost endpoint, and no development identity/bucket/mock.
- Explicit full certificate/hostname verification through the system CA store,
  TLS >= 1.2 and channel binding; URL sslmode cannot replace that verification.
- Original protected key fingerprints, schema/release/permission fingerprints.
- Bound source, frozen generation, independent backup, reconciliation, custody,
  rollback and a non-expired reviewed activation approval.

Even after those checks, **startup currently refuses production** with
`managed_production_side_effects_not_certified`. The inherited bridge captures
email/SMS/push into synthetic delivery sinks. Enabling real employee traffic
before a reviewed durable production delivery worker exists would be unsafe.
This blocker is code-enforced, not merely a runbook note.

Observed development credentials own the schema and are superuser-capable.
The adapter claims neither a bq_app role nor database-enforced least privilege.
Publishing does not create staging's custom roles/grants. The strongest prepared
equivalent is bounded/parameterized transactional application access, exact
identity/schema checks, no DDL/reset/fallback and an explicit production security
approval bound to the **actual** capability fingerprint. That approval is absent.

## Release boundary

Replit alone applies production schema through the approved Publish diff.
No startup DDL, production migration script, build hook, data-copy or implicit
seed is included here. Data-only protected adoption, live App Storage identity,
original-key continuity, real delivery, independent recovery and provider PITR
must be qualified before updating the existing BQ Connect URL. Never roll back
to old JSON after accepting newer SQL writes.
