# BQ Connect — local handoff continuation report

Date: 2026-11-04 (local workstation, Windows 11 + WSL2).
Branch: `handoff/replit-rel001-2026-11-04`, starting commit `44b91cbfae69bd793246c6fe462f53659ec50c13`.
Scope: invented fixture data only. No production storage, real employee data, real keys, provider credentials or Replit backups were accessed or copied.

**Verdict: Production remains NO-GO.** No mandatory blocker in the 18-item register is closed by this work. Synthetic tests are not presented as evidence for any approval-gated gate.

Sections 1–15 describe the development continuation. Section 16 records the finalization, push-safety checks and the full regression re-run done before publishing the branch.

Every claim below is labelled with one of three evidence levels:

- **EXECUTED**: actually run here, with the observed result.
- **IMPLEMENTED**: code changed and covered by the stated tests.
- **NOT TESTED**: not run, or not runnable in this environment.

---

## 1. Clone and commit verification

| Item | Result | Evidence level |
|---|---|---|
| Old local folder `Documents\bq-connect-replit` | Backed up by full copy to `Documents\bq-connect-replit-backup-20261104-1045` (rename was refused because the folder was in use). Not modified, not reset, not merged. | EXECUTED |
| New clone `Documents\bq-connect` | Cloned from `origin` (`github.com/noorahalshamsi-safety/bq-connect`), branch `handoff/replit-rel001-2026-11-04` | EXECUTED |
| Handoff commit | `git rev-parse 44b91cb` = `44b91cbfae69bd793246c6fe462f53659ec50c13`, matching the handoff exactly | EXECUTED |
| `main` used as base | No | EXECUTED |
| Push / merge | No merge. The handoff branch is pushed only after the section 16 checks; `main` is not touched. | EXECUTED |
| Line endings | `core.autocrlf=input`. The pre-existing `.gitattributes` (unchanged by this work) forces `.sh` files to LF. `git ls-files --eol` shows `i/lf w/lf` for every changed file. | EXECUTED |

## 2. Environment status

| Component | Version / state | Evidence level |
|---|---|---|
| OS | WSL2 Ubuntu 24.04.4 LTS (no sudo; user-space install) | EXECUTED |
| Node / npm | v22.23.4 / 10.9.9, from `nodejs.org/dist/latest-v22.x` with SHA-256 check | EXECUTED |
| PostgreSQL | 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1), extracted from noble-updates debs. Verification chain: `InRelease` checked with gpgv, then `Packages.gz` SHA-256, then each deb's SHA-256. | EXECUTED |
| Setup script | `development/local/wsl-tools.sh` (idempotent). Activate with `source ~/.local/bq-tools/env.sh`. PostgreSQL wrappers embed `LD_LIBRARY_PATH` because the test harness starts PostgreSQL tools with a minimal environment. | EXECUTED |
| Install | `npm ci` in root and `artifacts/mockup-sandbox` succeeded after replacing the Replit-internal registry URLs in the lockfiles (sha512 integrity unchanged) | EXECUTED |
| Dev launcher | `node development/postgres/launch.cjs` (port 5000; 4173 alias). Root `start.js` / `npm start` were not used. | EXECUTED |
| Working layout | Edits are made in the Windows clone. Tests run in a WSL-native mirror `~/bq-connect` (rsync, excluding `node_modules` and `generated-artifacts`), because `/mnt/c` cannot host PostgreSQL data directories or Unix sockets. | EXECUTED |
| Translation models | Xenova opus-mt ar→en / en→ar (q8), cached to `generated-artifacts/phase2b/models` by `development/local/fetch-models.cjs` (public model weights only) | EXECUTED |

## 3. Baseline results (handoff commit, before changes)

All baseline runs were EXECUTED on PostgreSQL 16.15 and Node 22.23.4.

| Suite | Result | Notes |
|---|---|---|
| `scripts/migration/rel001/tests.cjs` | 24/24 | ~2 min 15 s |
| boundary | 7/7 | |
| `scripts/postgres/e2e.cjs` | 56/56 | |
| `scripts/postgres/hardening.cjs` | 27/27 | 26/27 until models were cached. B22 returned 503 because the model download ran inside the request deadline. |
| phase2c-parity | 9/9 | |
| phase2c-background | ready, no refusals | |
| phase2c-translation (engine probe) | BLOCKED | Same as the historical Phase 2C result: the probe loads both models in one process and its 768 MiB / 120 s guard stops it |
| phase2d / phase2e / phase2f / phase2g | 11/11, 11/11, 16/16, 11/11 | |
| persistence harness | 43 PASS / 1 FAIL (T18) / 9 BLOCKED | Matches the documented historical baseline in `P0_PERSISTENCE_REPAIR.md` |
| `scripts/architecture/validate.cjs` | 20/20 | |
| rel001 compatibility e2e / parity | 56/56, 9/9 | |

## 4. Modified files and commits (local, unpushed)

| Commit | Summary | Files |
|---|---|---|
| `c6d62f6` | Root lockfile installable outside Replit: 14 `package-firewall.replit.internal` URLs changed to `registry.npmjs.org`, integrity unchanged | `package-lock.json` |
| `f274863` | REL-016: removed the unused `zod` devDependency from the preview, rewrote lockfile URLs (317). Clean install audits 0 vulnerabilities, and a clean build's output is byte-identical. | `artifacts/mockup-sandbox/package.json`, `package-lock.json` |
| `083becf` | WSL user-space setup and sequential synthetic suite runner | `development/local/wsl-tools.sh`, `development/local/run-suites.sh` |
| `904617a` | REL-012: translate each piece separately; keep URLs, e-mail and emoji verbatim; bound generation length; retry and fall back on degenerate output; invented-corpus regression; Phase 2G G08 updated to the precise verbatim expectation | `translate.js`, `scripts/translation/regression.cjs`, `development/local/fetch-models.cjs`, `development/local/translation-experiment.cjs`, `scripts/postgres/phase2g/tests.cjs` |
| `bb91400` | REL-012: no silent truncation. The engine refuses input over 3000 characters. The client translates a word-bounded prefix of long articles (articles allow 4000) and shows a partial-translation note in Arabic and English. | `translate.js`, `public/js/posting.js`, `public/js/secure.js`, `scripts/translation/regression.cjs` |
| `654f265` | REL-010/REL-015: route, action and op inventory; forwarded-IP trust test; coverage for the four previously unexercised entries | `scripts/security/route-inventory.cjs`, `scripts/security/forwarded-ip.cjs`, `scripts/security/coverage-gaps.cjs` |
| `aa28f06` | Defect found in the BR-05 browser run: editing a text post froze its original text as a hidden title. Inventory now lists `PATCH`/`DELETE` on `/api/ideas/<id>`. | `public/js/app.js`, `scripts/security/route-inventory.cjs` |

No historical report was deleted and no test was weakened. G08 was made stricter: letter-free fixtures must now come back exactly verbatim.

## 5. Security findings and fixes

| Finding | Status | Evidence level |
|---|---|---|
| Root dependency audit today: 6 moderate, 0 high, 0 critical. All are on the `uuid` chain `@replit/object-storage` → `@google-cloud/storage` → `gaxios`/`teeny-request`/`retry-request` → `uuid`. The register recorded `uuid` 9.0.1 as HIGH; today's scanner reports moderate. | **REL-006 remains OPEN.** The latest `@replit/object-storage` still pins an affected `@google-cloud/storage` range, so there is no compatible supported fix. No major version was forced. Earlier review found the multipart call sites use v4 only, which is reachability evidence but not a fix. | EXECUTED (audit) |
| Preview `zod` advisory (REL-016) | Package unused in `src`. Removed; preview audit 0, clean build output identical. Preview `typecheck` could not run because `typescript` is not installed in the preview graph. | EXECUTED |
| Client-IP trust for rate limits (REL-010) | `scripts/security/forwarded-ip.cjs` evaluates the unmodified `clientIp()`: **9/9 PASS**. Without a trusted proxy, `X-Forwarded-For` is ignored for remote peers. With N hops, the Nth entry from the right is used. Values are bounded to 64 characters. Identity locks (badge, `2fa:`, escalating `reg:`, `pw:`) are independent of IP. | EXECUTED |
| Two configuration risks recorded, not fixed | (a) Loopback peers are always trusted as one proxy hop, even with `TRUST_PROXY=0`, so any process on the host can choose the IP used for rate limiting. (b) If `TRUST_PROXY` is set higher than the real proxy count, the left-most, client-controlled entry is used. Hosted topology must set the exact hop count. This needs the REL-003/REL-013 deployment decision. | EXECUTED (behaviour) / NOT TESTED (hosted) |
| Route coverage (REL-015) | Inventory of 97 entries: 25 paths, 2 item methods (`PATCH`/`DELETE`), 12 idea sub-actions, 38 `/api/social` actions and 20 ops. Four had no suite at all: `/api/place-name`, `sessions.logout`, `push.key`, `push.unsubscribe`. Now covered by `coverage-gaps.cjs`, **4/4 PASS**: a wrong-owner unsubscribe has no effect, `place-name` refuses unauthenticated and invalid coordinates before any external lookup, and logout revokes only the caller's token. | EXECUTED |
| What the inventory does not prove | "Referenced" means a suite sends that literal. The full per-branch role/object denial matrix required by REL-015 is **not** established. | — |
| Browser token storage | Session token stays in `localStorage['rd-session']`. Unchanged, still part of REL-010. | NOT CHANGED |

## 6. Database, migration and recovery work

- **EXECUTED:** the rel001 suite (24/24) and the rel001 compatibility e2e and parity runs (56/56, 9/9) pass on a clean local cluster.
- **EXECUTED:** the persistence harness reproduces the documented baseline (T18 FAIL and 9 BLOCKED are expected and unchanged).
- **NOT TESTED / not attempted (approval-gated):**
  - protected source inventory (REL-001)
  - independent SQL/PITR restore and RPO/RTO drill (REL-002)
  - hosted PostgreSQL least-privilege, TLS and failover (REL-003)
  - cross-release writer freeze (REL-005)
  - real key custody (REL-014)

  No production database was provisioned or queried. The existing release fences are untouched.

## 7. Media and notifications

- **EXECUTED (existing suites, unchanged code):** e2e H24 (push subscription with the transactional fixture outbox), and hardening B04/B05/B26 (fixture mail and OTP, encrypted no-response replay, outbox acknowledgement across a crash).
- **EXECUTED (new):** a wrong-owner push unsubscribe cannot remove another employee's subscription (S02).
- **Observation:** subscribing an endpoint moves it away from any other account (`push.js` `subscribe`). This is intended single-owner semantics; the endpoint acts as a capability.
- **NOT TESTED:**
  - hosted durable media (REL-004)
  - media audience policy (REL-008): unauthenticated known-URL access remains current behaviour, and no visibility was changed without an approved policy
  - real SMTP/SMS/push delivery (REL-009)

## 8. Feed, search and performance

- **EXECUTED:** the Phase 2D and 2F suites pass (11/11, 16/16). No feed code was changed, and pagination was **not** activated in the original UI.
- **NOT TESTED:** an owner-signed load envelope and sustained-load certification (REL-011). No new benchmark is claimed.

## 9. Translation (REL-012)

**IMPLEMENTED and EXECUTED with the actual local OPUS models on an invented corpus:**

| Measure | Before (handoff code) | After |
|---|---|---|
| Regression `scripts/translation/regression.cjs` | unit 0/2, ar→en 2/6, en→ar 3/6 | unit 4/4, ar→en 6/6, en→ar 6/6 |
| URLs / e-mail / emoji preserved | No (model garbled URLs) | Yes, kept as verbatim segments |
| Punctuation runs / repeated tokens | Present (e.g. long punctuation runs; "re re re" on short input) | None in corpus. Degenerate output triggers a penalized retry, then falls back to the source text. |
| Max warm latency per sample | 22.8 s | 0.7–2.3 s |
| Process RSS (one model) | 774–823 MiB (old probe tripped the 768 MiB guard) | ~578–591 MiB |
| Overlong input (> 3000 characters) | Silently sliced in the engine and in the client | Engine refuses (empty result → HTTP route already returns 400 `bad_text`). Client translates a word-bounded prefix and shows "only the first part was translated" in both languages. Regression T03/T04. |

Also EXECUTED after the changes: hardening 27/27 (B22 HTTP translation), e2e 56/56, Phase 2G 11/11, architecture 20/20.

**Remains open:**

- No bilingual reviewer has scored output quality. Non-empty output is not a quality PASS.
- The Phase 2C two-model engine probe is still BLOCKED by its 768 MiB guard, as it was historically.
- Model work still runs inside the compatibility transaction.
- The external Google-Translate link policy is unchanged and needs a policy decision.
- The partial-translation note was **not** browser-tested, because translation is disabled in the ordinary dev preview.

## 10. Browser and mobile QA (REL-007)

Runner: Cursor's built-in browser against `launch.cjs` on `localhost:5000`. Interactions were mostly dispatched through the DOM (`element.click()`, setting values with `input` events) rather than OS-level input. Native `confirm()` prompts were auto-accepted for the delete step. The fixture password and TOTP were entered through the normal login form; no tokens were injected. Screenshots containing no credentials are in the local Cursor screenshot folder (not committed).

| Row | Status | What actually executed |
|---|---|---|
| BR-01 | PASS (Arabic, desktop only) | Password login, 2FA prompt, wrong factor denied, valid factor enters feed, recovery-code login and reuse denial, ineligible denial. English and mobile not run. |
| BR-05 | **PARTIAL** | As employee A: created a post through the composer, edited it, reloaded (edit persisted), deleted it, reloaded (gone from UI and API; the other cards were unaffected). Signed out, then signed in as employee B with password and TOTP. B opened A's post by deep link: the menu showed only report, with no edit or delete. B's direct `PATCH` and `DELETE` returned **403**, and A's text was unchanged. **Defect found and fixed** (`aa28f06`): editing a text post saved the display-fallback title, freezing the pre-edit text on the card. Re-verified in the browser: the title field is empty in edit mode and the card shows the edited text. Not verified: the "newest/top controls" part of the row. |
| BR-15 | PARTIAL | Invented `<img onerror>`, `<svg onload>`, attribute-closing and `javascript:` payloads in a post and a bio render as inert text; the sentinel was not set. Comments, group labels, translated output and admin/moderation views were not run. |
| BR-18 | PARTIAL | 390×844 emulated touch viewport: home, profile, settings, ideas, notifications and reels views, plus the composer. No document-level horizontal overflow; the composer's publish button is reachable. Menus, keyboard, comments, moderation and admin tables were not run. Emulation does not certify a real device. |
| All other rows | NOT TESTED | |

## 11. Updated 18-item register (proposed status; the authoritative JSON is unchanged)

| ID | Prio | Status after this work | Change |
|---|---|---|---|
| REL-001 | P0 | OPEN – approval-gated | none |
| REL-002 | P0 | OPEN – approval-gated | none |
| REL-003 | P0 | OPEN – approval-gated | none |
| REL-004 | P0 | OPEN – approval-gated | none |
| REL-005 | P0 | OPEN – approval-gated | none |
| REL-006 | P1 | OPEN (6 moderate on the uuid chain; no compatible supported fix) | fresh audit; installable lockfile |
| REL-007 | P1 | OPEN | BR-01 PASS (partial coverage), BR-05/15/18 PARTIAL |
| REL-008 | P1 | OPEN – policy decision needed | none |
| REL-009 | P1 | OPEN – provider sandbox needed | wrong-owner push unsubscribe tested |
| REL-010 | P1 | OPEN | forwarded-IP behaviour tested; two configuration risks documented |
| REL-011 | P1 | OPEN – envelope sign-off needed | none |
| REL-012 | P1 | OPEN – bilingual review and policy needed | engine fixes, no silent truncation, regression |
| REL-013 | P1 | OPEN – hosted operations | none |
| REL-014 | P0 | OPEN – custody authorization | none |
| REL-015 | P1 | OPEN – full role matrix outstanding | inventory 97/97 referenced; 4 gaps covered |
| REL-016 | P2 | **Ready to close pending preview typecheck** (removed, clean install, audit 0, build identical) | removal |
| REL-017 | P2 | NOT STARTED (optional) | none |
| REL-018 | P3 | NOT STARTED (optional) | none |

The JSON register was deliberately not edited. Each change above needs the listed owner's confirmation, and none of the mandatory acceptance criteria are fully met.

## 12. External dependencies (cannot be satisfied locally)

- Protected read/copy authorization and an approved authoritative dataset (REL-001).
- Approved RPO/RTO, an independent backup target and a clean fixture host (REL-002).
- Hosted PostgreSQL provider, region, roles and TLS approval (REL-003).
- A durable object-storage fixture (REL-004).
- A media audience policy from the data owner (REL-008).
- Mail/SMS/push provider sandboxes (REL-009).
- A retention and key/access matrix (REL-010).
- A signed feed/load envelope (REL-011).
- A bilingual reviewer and translation privacy policy (REL-012).
- Hosted alerting and on-call (REL-013).
- A key custodian (REL-014).
- A supported upstream fix or signed exception for `uuid` (REL-006).
- A real-device and PWA test profile (REL-007).

## 13. New tests and before/after measurements

| Test | Purpose | Result |
|---|---|---|
| `scripts/translation/regression.cjs` | Invented corpus covering verbatim spans, punctuation and repetition, warm latency, edit cache-key; T03/T04 overlong handling | 16/16 (before: 5/14 of the original checks) |
| `scripts/security/forwarded-ip.cjs` | Client-IP trust matrix plus identity-lock presence | 9/9 |
| `scripts/security/coverage-gaps.cjs` | push key/unsubscribe, place-name denial, session logout | 4/4 |
| `scripts/security/route-inventory.cjs` | Inventory and suite references, written to `generated-artifacts/security/route-inventory.json` | 97/97 referenced (before: 93/97) |
| `development/local/run-suites.sh` | Sequential runner with per-suite logs | — |

Regression re-runs after all changes (EXECUTED):

- hardening 27/27
- e2e 56/56
- Phase 2F 16/16
- Phase 2G 11/11
- architecture 20/20

## 14. Verdict

**NO-GO for Production.** The P0 items REL-001 to REL-005 and REL-014 require protected or hosted resources and explicit approvals that were not available, and nothing here substitutes for them. The local work improves installability, translation robustness, test coverage and one user-visible edit defect. No release fence was removed and no production operation was prepared beyond what already exists in the repository.

## 15. Next actions

1. Repository owner: review the handoff branch commits (section 16). Any merge to `main` or production release needs separate approval.
2. Preview maintainer: install `typescript` in the preview graph or confirm that the typecheck can be skipped, then close REL-016.
3. Security and data owners: decide the REL-008 media policy and the REL-010 retention matrix. Set `TRUST_PROXY` to the exact hosted hop count, and decide whether the loopback auto-trust should remain.
4. Multilingual reviewer: score the invented corpus output from `scripts/translation/regression.cjs` in both directions. Decide the external translate-link policy.
5. QA: continue the browser checklist on a real browser and device (BR-02 to BR-04, BR-06 to BR-14, BR-16, BR-17, BR-19 to BR-22), plus English and mobile for BR-01/BR-05.
6. Platform: obtain the hosted fixture approvals listed in section 12. Only then rehearse REL-002/003/004/005/014.

Reproduce locally:

```bash
bash development/local/wsl-tools.sh
source ~/.local/bq-tools/env.sh
npm ci
npm --prefix artifacts/mockup-sandbox ci
node development/local/fetch-models.cjs
bash development/local/run-suites.sh
node scripts/translation/regression.cjs
node scripts/security/forwarded-ip.cjs
node scripts/security/coverage-gaps.cjs
node scripts/security/route-inventory.cjs
```

## 16. Finalization and push-safety verification (2026-11-04)

### What each part of the repository is for

| Area | Entry point | Status |
|---|---|---|
| Local synthetic development | `node development/postgres/launch.cjs` (see `development/postgres/README.md`, `replit.md`) | Invented fixtures only; refuses deployment activation |
| PostgreSQL migration tooling | `scripts/migration/rel001/` with `reports/REL001_OPERATOR_RUNBOOK.md` | Synthetic lab evidence only; protected inventory and real import NOT authorized |
| Original legacy production | `start.js` (`npm start`) with App Storage synchronization | Unchanged by this work; do not use it for local testing |
| Release blockers | `reports/POSTGRESQL_PHASE2G_BLOCKERS.json` (authoritative) and section 11 above | 15 mandatory items open (6 P0 + 9 P1); REL-016–018 optional |

### Repository state before push (EXECUTED)

- The working branch is `handoff/replit-rel001-2026-11-04`. The remote branch was still at the handoff baseline `44b91cb` when fetched: local was 0 behind and 8 ahead, a strict fast-forward. Remote `main` was at `d64050c` and is not part of this push.
- Outgoing commits:
  - `c6d62f6` lockfile URLs
  - `f274863` preview zod removal
  - `083becf` WSL setup
  - `904617a` translation fixes
  - `bb91400` no silent truncation
  - `654f265` security inventory and tests
  - `aa28f06` post-edit fix
  - `a20e189` report
  - `7799f3c` ignore `.env` files
  - the documentation commit containing this section
- Working tree clean; no untracked files. The only ignored local content is `generated-artifacts/`: the synthetic PostgreSQL cluster, fixture credentials, public model cache and local logs. None of it is tracked.

### Push-safety checks (EXECUTED)

| Check | Result |
|---|---|
| Redacted secret scan of every added line in `44b91cb..HEAD` (private keys, GitHub/AWS/Google/Slack/npm tokens, JWTs, bearer values, assigned passwords/secrets, database URLs with passwords, the fixture password, Saudi national-ID and mobile patterns, long hex/base64 blobs) | 0 secret findings. The one rule hit is this report's own mention of the private-registry hostname. |
| Banned paths in outgoing files (`data/`, `backups/`, `models/`, `node_modules/`, `generated-artifacts/`, `.env*`, `*.bqb`, `*.key`, `*.pem`, model weights, databases, credential bundles) | none; no outgoing file exceeds 1 MiB |
| Tracked sensitive paths in the whole tree | none |
| Private Replit registry URLs in lockfiles | 0 in both lockfiles, and none left anywhere else in the tree |
| Lockfile integrity | Root: 14 `resolved` URLs changed, 0 `integrity` values changed. Preview: 316 URLs changed and `zod` removed; 0 `integrity` values changed. The only other change is `zod` dropped from the root `devDependencies`. |
| `start.js` and production deployment files | not modified by any outgoing commit |

### Final regression matrix (EXECUTED on `a20e189`; later commits change only `.gitignore` and this report)

Environment: Node v22.23.4, npm 10.9.9, PostgreSQL 16.15, WSL2 Ubuntu 24.04.4.

| Suite | Result |
|---|---|
| REL-001 migration tests | 24/24 PASS |
| REL-001 boundary tests | 7/7 PASS |
| HTTP compatibility (`scripts/postgres/e2e.cjs`) | 56/56 PASS |
| REL-001 compatibility e2e / parity | 56/56, 9/9 PASS |
| Hardening | 27/27 PASS |
| Native profile parity (`phase2c-parity`) | 9/9 PASS |
| Background reliability (`phase2c-background`) | both modes ready, 0 refusals |
| Phase 2D reliability | 11/11 PASS |
| Phase 2F / Phase 2G | 16/16, 11/11 PASS |
| Architecture validation | 20/20 PASS |
| Translation regression | unit 4/4, ar→en 6/6, en→ar 6/6 (RSS ~590 MiB, max warm 0.8 s) |
| Security coverage gaps / forwarded-IP | 4/4, 9/9 PASS |
| Root `npm audit` | 6 moderate, 0 high, 0 critical (uuid chain under `@replit/object-storage`; REL-006 OPEN) |
| Preview `npm audit` / build | 0 vulnerabilities; build succeeded |
| Not re-run in this pass | persistence harness (unchanged code paths; last result 43 PASS / 1 FAIL T18 / 9 BLOCKED, the documented baseline), Phase 2C two-model engine probe (historically BLOCKED by its 768 MiB guard), Phase 2E |

No assertion was weakened and no fence was removed to obtain these results.

### Clean-clone installation and startup (EXECUTED)

- `git clone --branch handoff/replit-rel001-2026-11-04` into an empty WSL folder gave HEAD `a20e189`.
- Root `npm ci`: 146 packages, and preview `npm ci`: 248 packages, both from `https://registry.npmjs.org/`. No private-registry reference remains in the lockfiles or installed trees.
- Started `node development/postgres/launch.cjs` with a minimal environment (`PATH`, `HOME`, `LANG` only; no credentials or Replit variables):
  - It printed "Synthetic PostgreSQL development only; no production storage is connected."
  - `/health/ready` returned 200 on port 5000 and on the 4173 alias.
  - An unauthenticated `/api/session` returned 401.
  - It created only the ignored `generated-artifacts/pg-development/` root (fixture credential file mode 600) and left no tracked changes.
  - The launcher was then stopped.

### Remaining local environment limitations

- No packaged headless browser runner. Browser rows were run in Cursor's built-in browser with DOM-dispatched interactions; no real device or PWA install.
- Translation is disabled in the ordinary dev preview, so the partial-translation note is not browser-tested.
- The preview graph has no `typescript`, so the preview typecheck cannot run.
- WSL clears `/tmp` when idle, so logs go to `~/bqlogs`. `/mnt/c` cannot host the PostgreSQL data directory, so tests run in a WSL-native mirror.
- No hosted PostgreSQL, object storage, mail/SMS/push provider or key custody is available, by design.

### Changes since the previous version of this report

- `7799f3c`: `.gitignore` now excludes `.env` and `.env.*` (no such file is tracked or needed).
- Corrected section 1 and section 4: `.gitattributes` predates this work.
- Added this section. No historical report or test expectation was changed.

### Verdicts

- **Development readiness: READY** for continued local synthetic development and review from a clean clone, without Replit's private registry.
- **Production readiness: NO-GO.** All 15 mandatory blockers (REL-001 to REL-015) remain open, as listed in section 11.
