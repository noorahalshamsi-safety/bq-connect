# BQ Connect — production cutover runbook (NOT EXECUTED)

Status: **design only.** Nothing in this runbook has been run, and the repository contains no command that performs these stages against production. Each stage needs explicit approval for **that exact operation** from the named owner. A successful staging or synthetic rehearsal is not evidence that production data was migrated. Production remains on the current JSON authority behind its existing fences (`start.js` `deployment_storage_disabled`, the isolation `production_activation_forbidden`), and those fences stay in place until a separately approved replacement exists.

Preconditions, all required: staging certified (deploy/staging/README.md), REL-001 to REL-005 and REL-014 closed by their owners, REL-006/007/008/009/010/011/012/013/015 closed or formally risk-accepted, and signed RPO/RTO.

| # | Stage | Owner (approves) | Inputs | Go evidence | Abort / rollback |
|---|---|---|---|---|---|
| 1 | Dataset identification | Data owner | Production Repl identity, bucket id, dataset manifest generation | Signed statement of which dataset is authoritative (REL-001); fingerprints recorded in `deploy/staging/production-identity.json` | Stop; no access granted |
| 2 | Protected inventory | Data owner + security | Separate read authorization; protected environment | Complete file/path/shape inventory with counts and hashes only, with no content leaving the protected environment | Discard the inventory workspace; nothing written to production |
| 3 | Membership reconciliation | HR/data owner | Approved employee list | Account ↔ employee mapping with unmatched rows listed and decided; no automatic deletion or seeding | Stop; production unchanged |
| 4 | Immutable backup | Operations | Independent backup target (REL-002) | Verified, restorable backup of all JSON, media and key material, restored once on a clean fixture host with matching digests | Stop; production unchanged |
| 5 | Key custody | Security custodian (REL-014) | Custody ceremony | Session, backup and active/pending 2FA key domains escrowed with **fingerprints only** in evidence. No rotation, no disclosure | Stop; keys untouched |
| 6 | Media reconciliation | Storage owner (REL-004/008) | Bucket listing, media policy | Every referenced object is present and its hash matches. Orphans are listed but never deleted. The visibility policy is approved | Stop; bucket untouched |
| 7 | Writer freeze | Release owner (REL-005) | Maintenance window, writer inventory (HTTP, timers, CLI, storage mirror) | Enforced freeze (not a banner); receipts show every writer drained; final frozen generation recorded | Lift the freeze; the old build continues as the authority |
| 8 | Frozen comparison | Data owner | Frozen generation from stage 7 | Frozen state equals the stage-4 backup plus logged deltas; any unexplained difference stops the run | Lift the freeze |
| 9 | Import and validation | Database owner (REL-003) | Approved production database, `roles.sql`, `migrate.cjs`, import tool under separate authorization | Full source ↔ destination reconciliation: membership, content, media links, sessions, active/pending 2FA. Reverse reconstruction equals the frozen source | Drop the **candidate** database only; JSON authority unchanged; lift the freeze |
| 10 | Authority activation | Data + security + database owners jointly | Signed stage-9 report | Authority epoch set once; old writers provably refused (stale-epoch test) | Before traffic: deactivate the candidate; JSON authority resumes from the frozen generation |
| 11 | Traffic cutover | Release owner | Deployment change approval | New build serving; health and readiness green; error budget within the agreed SLO | Route back to the old build **only if no writes have been accepted** by the new authority |
| 12 | Monitoring | Operations (REL-013) | Alerts for readiness, pool saturation, storage errors, outbox lag and backup age | Alerts received and acknowledged in a drill | Escalate per incident runbook |
| 13 | Post-verification | Product owner + QA | Invented smoke accounts only; no browsing of real employee content | Login/2FA/session, post, comment, media, feed/search and translation checks pass; real users see their own data | Recovery procedure (stage 14) |
| 14 | Rollback / recovery | Separate recovery authorization | Current committed authority, stage-4 backup, escrow | After writes, rollback means a restore to SQL state, not to old JSON. Old-JSON rollback after writes is refused by design (REL-002) | Requires its own approval; never automatic |

Rules that apply throughout:

- No production restore, import, schema activation, key rotation, writer freeze, traffic switch, republish or data rollback without explicit approval for that exact operation.
- No step may print or copy national IDs, mobile numbers, badges, tokens, passwords or employee names into logs, tickets or chat.
- Any unexpected state (missing file, foreign key, unknown shape, count mismatch) stops the run. The run never normalizes, defaults or re-seeds.
