# First maintenance-only preparation

Pinned source: `development/minimal-accounts-2026-11-04`,
`cd5bd760a3b1d4a663d9a41c0479a58e36f02dd9`.

`source/` contains a byte-identical, additive copy of the tracked runtime files
from that commit. It is not a second app or a replacement App Storage source.
No data directory, keys, source records or generated test database are copied.
The original root application, package files, public files and workflows remain
in place. Runtime dependencies resolve from the existing root package.

The root `deploy/managed/minimal-import-runner.cjs` delegates to this pinned
runner with an empty operation environment. It **cannot** request import, even
if deployment settings contain an import flag. The pinned runner always passes
`maintenanceOnly:true`; it cannot activate SQL authority. Root/liveness return
200 with `ready:false`; login and readiness return 503.

The pinned migration implementation's separate exact approvals remain empty.
Direct use of that implementation still requires published production identity,
original-key continuity, exact manifest activation approval and the additional
minimal import approval. It has no source-write path. This preparation grants
none of those approvals.

Next-publish configuration only:

```toml
[deployment]
deploymentTarget = "vm"
build = ["npm", "ci", "--omit=dev"]
run = ["node", "deploy/managed/minimal-import-runner.cjs"]
```

No Republish, database creation, import or activation is executed here.
The effective no-Development-data-copy Publishing plan remains **BLOCKED**
until the operator verifies it for this existing app. A selected toggle is not
proof of its saved/effective state. Do not publish until that gate is resolved.

## Reversibility

`original.replit.toml` is the exact pre-preparation configuration.
`preparation.json` records the original workspace commit and verified source.
Original application files are not changed. To undo this preparation before
publishing, use Replit's validated configuration replacement to restore the
saved original configuration, then remove only this newly added release tree,
the root maintenance entrypoint and its focused verification script. Do not
reset Git or remove/overwrite any original data or App Storage objects.

After publishing, changing workspace files alone does not revert the live app:
restoring a deployment is a separate operator action. Never restore stale JSON
after accepted SQL writes; this maintenance-only preparation accepts none.
