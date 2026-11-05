# Integrated PostgreSQL release candidate — BLOCKED for real execution

This candidate preserves the original source, pinned binding and current
Publishing configuration. No legacy restoration or JSON authority fallback
exists here. Nothing in this directory was published or run against Production
during preparation.

## Exact unresolved prerequisite

An independently authenticated authority must establish **both** the actual
Production workload's relationship to the existing BQ Connect project/URL
and the actual candidate artifact's file provenance. Current Replit tooling
provided a build Git revision, not a deployed binding-file digest or a
runtime-to-project mapping. A locally calculated hash is not independent proof.

There is also no authorized Production execution/file-delivery facility exposed
to this Agent. Workspace Shell is not Production. The commands below are
conditional operator commands, not a claim that Replit provides a Production
shell, artifact export or a workload-token API. Do not create a public execution
endpoint or repeat diagnostic publications to work around these limitations.

## Trust contract

`trust.json` deliberately ships with no keys and no approved URL/project fingerprints.
Real requests cannot pass. Before an operator-approved publication, independently
review and pin:

1. The parentAppFingerprint and existing Production URL fingerprint from
   authenticated deployment metadata. The parent pin must match the unchanged
   original binding; workspace matching alone is not independent verification.
2. An independent deployment attestor's Ed25519 public key, role `deployment`.
3. A provider-authenticated workload attestor's distinct Ed25519 public key,
   role `workload`. Its method must bind the live process, project, revision,
   fresh process challenge and actual artifact bytes independently.
4. A separate owner's Ed25519 approval public key, role `owner`.

Each key record is `{id, role, algorithm:"Ed25519", publicKey:<SPKI PEM>}`.
These are reviewed public trust anchors, never private keys or new application
secrets. Three freshly generated operator keys do **not** establish three
independent authorities. Do not enable the protocol unless the real issuer
provenance and workload-verification method have been independently established.

This is an application attestation contract, **not** a claim that Replit exposes
an Ed25519 workload token or already supports the required identity mapping.
A trusted verifier may adapt independently authenticated provider evidence to
this contract, but cannot merely sign the application's self-reported challenge.
The deployment attestor must also independently establish that the signed
endpointFingerprint is this project's actual Production database, not approve
an arbitrary nonlocal endpoint reported by the application.

## One candidate, separate operations

Proposed Publishing configuration, for explicit operator review only:

```
Build: npm ci --omit=dev
Run:   node release-preparation/production-release/runner.cjs
```

Set the nonsecret `BQ_RELEASE_CONTROL_DIR` to the operator's private local
Production directory. Keep the three existing Production secrets unchanged.
Run serves maintenance immediately; no request file, environment flag, HTTP
request or signal alone authorizes an import or activation.

The private directory must be owned by the process user with mode 0700.
Its JSON files must have mode 0600, the same owner and no symbolic/hard links.
Files are local protected operator custody, **not** original App Storage or
the control bucket. A restart invalidates the nonce; these files are not durable
migration recovery evidence.

`challenge.json` contains only protected fingerprints, a fresh random nonce
and local process PID. Never print or upload it publicly. The artifact digest
covers path/content pairs for `.replit`, package manifests, this candidate,
the production-binding verifier and the complete pinned implementation.
The independent attestor must verify actual snapshot/image provenance, not
assume that a matching recorded Git tree equals deployed bytes.

For each operation, deliver `request.json`:

```
{
  "operation": "preflight | import | activate",
  "manifest": "<actual BQ_REPLIT_MANAGED_V1 object, not this string>",
  "deployment": {"keyId":"...", "payload":{...}, "signature":"base64"},
  "workload":   {"keyId":"...", "payload":{...}, "signature":"base64"},
  "owner":      {"keyId":"...", "payload":{...}, "signature":"base64"}
}
```

Every payload signs canonical sorted-key JSON and must contain:

- `kind:"BQ_PRODUCTION_ATTESTATION_V1"`, `audience:"bq-production-release-v1"`,
  `environment:"production"`, exact operation.
- All challenge claims: nonce, parentAppFingerprint, runtimeAppFingerprint,
  bindingHash, artifactDigest, endpointFingerprint.
- Independently verified productionUrlFingerprint and deploymentFingerprint.
- `manifestHash`: SHA-256 of canonical manifest.
- Integer epoch-millisecond issuedAt/expiresAt; lifetime at most 15 minutes.

Import/activate owner payloads must additionally sign
`sourceWritersFrozen:"confirmed-all-writers"` and the exact manifest
`minimal.freezeEvidence`. A signature is explicit owner authorization, not
automatic observation of other writers. Stop all source writers and record
their actual freeze evidence before signing.

The proposed Production manifest is a **separate object**, never an edit of
`bindings.pending.json`. Its appFingerprint is the independently attested
actual runtime fingerprint. Existing `cfg.verify` still compares it with the
real runtime-managed REPL_ID. Source/target/schema pins cannot be changed.
The original endpoint, keys, permissions, minimal policy and custody contracts
remain required. Do not invent missing manifest fields or evidence hashes.

## Shortest conditional operator execution sequence

Only after trust/provenance and a supported Production operator channel exist:

1. Review the candidate/trust anchors and final source, then perform **one
   explicitly approved maintenance publication** with the Build/Run above.
   This Agent does not execute that publication.
2. In that actual Production context, provision private custody:

   ```sh
   umask 077
   D=/tmp/bq-production-release-control
   export BQ_RELEASE_CONTROL_DIR="$D"
   install -d -m 700 "$D"
   printf '%s\n' '{"kind":"BQ_PRODUCTION_OPERATOR_CUSTODY_V1"}' > "$D/custody.json"
   # If custody was absent at startup, signal the exact runner PID obtained
   # through the authorized Production operator facility. No request yet means
   # BLOCKED, then a fresh protected challenge is written.
   kill -USR2 "$AUTHORIZED_RUNNER_PID"
   ```

3. Supply a separately attested/owner-signed **preflight** request for the current
   challenge. Deliver it securely as mode-0600 `$D/request.json`, then:

   ```sh
   node -e 'const f=require("fs"); const c=JSON.parse(f.readFileSync(process.env.BQ_RELEASE_CONTROL_DIR+"/challenge.json"));process.kill(c.pid,"SIGUSR2")'
   ```

   Preflight checks actual Production secrets, designated-source counts
   (6,311 employees, eight registered accounts), original keys in memory,
   distinct control bucket, strict TLS, schema, empty destination and reviewed
   permissions. It is read-only. Missing evidence/status blocks; it never
   auto-creates a manifest or invents permission approvals.

4. Deliver the existing exact manifest-bound approval records, mode 0600:
   `$D/production-approvals.json` for `managed-production-activate`
   (the pinned manifest/custody approval) and `$D/approvals.json` for
   `minimal-employee-account-import`. Preserve the pinned canonical binding
   formulas and expiry requirements. The manifest must contain genuine current
   source membership/fingerprint, original-key fingerprints, frozen-generation
   and forward-recovery evidence. These are not approvals this Agent issued.
   Supply a fresh separately signed **import** request and signal with the same
   command above. Import reruns the full preflight, obtains the SQL advisory
   lock, uses existing schema only, reconciles before commit and records the
   independent control-bucket receipt. Maintenance remains active.
5. With the new nonce, supply a separate **activate** request, with owner
   activation approval and the same successfully imported manifest. Signal
   again. Activation validates Production identity, exact manifest approval,
   independent intent/receipt, SQL schema/authority, adoption marker, original
   keys and membership/count reconciliation before exposing the SQL runtime.
   It does not repeat the empty-database check after import. The maintenance
   gateway switches only after the SQL runtime has successfully listened on
   loopback. No JSON or legacy runtime can be selected.

After each failed/non-activation operation, a fresh nonce invalidates replay.
No automatic retry imports data. A successful activation disables further
operation signals in that process. A process restart returns to maintenance
and requires fresh attestation and activation approval, never a fresh import.

## Recovery boundaries

If source changes, any signature/receipt differs, the destination is occupied,
or an intent exists without its SQL marker, stop in maintenance. Do not reset,
truncate, reimport blindly, remove receipts, or restore legacy/JSON authority.
A post-commit receipt failure requires an explicitly reviewed **forward SQL
recovery**; it is not permission to repeat an unverified import. Imported data
is not rolled back by stopping the candidate.

## Focused verification

```
node scripts/managed/production-release-check.cjs
node scripts/managed/diagnostic-publication-check.cjs
```

Tests use synthetic keys/claims, isolated temporary custody and fake runtime
listeners. They do not verify actual Production identity, issuer availability,
real-data import or the signed Production manifest.
