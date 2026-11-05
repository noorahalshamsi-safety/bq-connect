# Production identity: minimal observation and conditional attestation

## Documented contract, not deployed-process evidence

The official [App Configuration environment-variable table](https://docs.replit.com/features/project-setup/configuration#environment-variables)
defines REPL_ID as the unique UUID of the Replit App. It does not exclude
Reserved VM deployments; by contrast it explicitly excludes REPLIT_DEV_DOMAIN
from Deployments. The Replit documentation lookup also identifies
REPLIT_DEPLOYMENT=1 as the published-app marker.

Accordingly REPL_ID is expected, but that is not proof that this running
deployment received it. No inspected primary documentation establishes a
Reserved-VM-specific exemption or a replacement identity variable.

| Source | What it establishes | What it cannot establish |
| --- | --- | --- |
| Actual process REPL_ID, equal to the pinned expected hash | Runtime input agrees with expected app identity | Presence/equality cannot be inferred from the workspace |
| REPLIT_DEPLOYMENT=1 | Published-process marker under the platform contract | Specific project, revision, database or bucket authority |
| Explicit Node Worker env copy | Copies supplied parent variables; tested with present/missing/mismatched synthetic inputs | Cannot recover values absent from the deployed parent |
| Authenticated Publishing metadata | Deployment/build state and revision under the tools exposed here | No live process REPL_ID or runtime-presence field is exposed |
| REPL_OWNER / REPL_SLUG / domains / default bucket | Configuration or routing information | Not independent workload identity |
| REPL_PUBKEYS | Documented public-key metadata | Public keys alone are not a signed workload assertion |

No documented replacement attestation contract was established for
REPLIT_REPL_ID, REPLIT_DEPLOYMENT_ID or an arbitrary operator-supplied app ID.
None is used as a fallback.

## Prepared three-field probe

The existing maintenance launcher has an opt-in mode selected by the nonsecret
setting BQ_MINIMAL_IDENTITY_CHECK=approved-readonly-identity. The setting is
not applied by preparation. Run and Build remain unchanged.

The mode takes precedence over BQ_MINIMAL_BINDINGS_CHECK and observes the
**main process directly**, before any diagnostic worker or broader verifier.
It reads only REPL_ID, REPLIT_DEPLOYMENT and the pinned binding file. It does
not consume authentication secrets, SQL credentials or App Storage.

Only one JSON object is emitted, with exactly:

- REPL_ID_PRESENT: YES/NO
- REPL_ID_FINGERPRINT_MATCH: YES/NO/NOT_EXECUTED
- REPLIT_DEPLOYMENT_PRESENT: YES/NO

PRESENT means nonempty, not a claim about a variable's value. A comparison runs
only when REPLIT_DEPLOYMENT is exactly 1, REPL_ID is nonempty, and the expected
fingerprint comes from a well-formed pinned binding. Otherwise it reports
NOT_EXECUTED, not a false mismatch. Empty IDs are absent; unexpected deployment
marker values never authorize a comparison. No value or hash is printed.

Maintenance HTTP remains unchanged: root liveness 200; readiness and login
503 with ready:false. No probe result authorizes any other operation.

Existing logs cannot retroactively produce these three observations. To collect
them, an authorized process-execution facility on the existing deployment could
run the equivalent probe without publication. None is exposed in the Agent's
available tools. Otherwise an **owner-approved maintenance-only diagnostic
publication is technically necessary** to execute this new code. It has not
been requested or performed automatically; Production identity remains UNKNOWN.

## Conditional alternative — design only, disabled

Do not select an alternative merely because REPL_ID failed once. First establish
absence in the actual deployed process and whether that absence is legitimate
under the provider's supported runtime contract.

A safe alternative needs two separately trusted inputs:

1. **Independently authenticated control-plane evidence.** An external release
   verifier obtains the actual project, currently serving deployment/revision,
   production environment and immutable release digest from authenticated
   provider metadata. An env value or workspace UUID is not this evidence.
2. **Proof binding this running workload to that evidence.** Require a supported
   provider-signed workload assertion, or a provider-authenticated challenge
   mechanism that identifies the exact serving deployment/revision. A public
   domain request or a copied environment value alone does not meet this test.

The external verifier may then issue a short-lived signed production-only
binding with a fixed audience, project/deployment/revision fingerprints,
immutable release digest, environment=production, issuance/expiry times and a
challenge nonce. Its signing authority must be independent of the application.
The runtime must verify that signature against a reviewed pinned trust anchor,
validate audience/expiry/nonce, and match the binding to the independently
authenticated workload assertion. Renewal/revocation must fail closed.

This is not implemented as an executable configuration or a new secret.
The current tooling does not establish the requisite provider workload
attestation/challenge source, and the exposed metadata alone is insufficient.
Until both inputs exist and are independently reviewed, the alternative is
BLOCKED and the original app-identity guard remains authoritative.

### Security review of the design

| Risk | Required rejection |
| --- | --- |
| Binding copied to a different app, Development or an old revision | Workload proof, production context, audience and release must all match |
| User supplies the expected UUID or edits an alias | Never accept as actual runtime identity |
| Public signed metadata is replayed | Bind to fresh workload proof, expiry and nonce |
| Operator provides a matching fingerprint without provenance | Independently verify control-plane source before issuing the binding |
| Stolen/invalid/unavailable assertion or unverifiable issuer | Remain in maintenance; no fallback to weaker identity |
| Correct identity used to bypass migration safeguards | Keep original-key equality, permissions, strict TLS, source/target bucket authority, freeze and exact approvals unchanged |

This review identifies required trust properties and the missing provider
capability. It is not approval to deploy an alternative or a claim that the
provider currently exposes the proposed assertion mechanism.
