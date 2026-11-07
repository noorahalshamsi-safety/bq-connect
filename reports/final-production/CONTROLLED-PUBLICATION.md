# Controlled publication of the PostgreSQL BQ Connect repair candidate

## Destination and authority

The destination is the existing BQ Connect Replit project and its existing
Production application, database, buckets and registered accounts. This is an
update, not a fresh installation or a directory/account import.

The owner elected not to create a separate staging project. Hosted upload
acceptance and physical iPhone testing have not passed; they remain release
risks, not evidence that can be substituted with local test results.

The GitHub source repository is `noorahalshamsi-safety/bq-connect`. Before
advancing remote main, preserve its exact previous commit in a timestamped
`backup/main-before-postgresql-*` branch and verify that reference remotely.
Use a normal fast-forward push only. If remote main changes incompatibly,
stop rather than force-pushing or erasing remote work.

## Next-publish configuration

```text
Build: npm ci --omit=dev
Run:   node deploy/fresh/start.cjs
Target: existing Reserved VM
```

Do not run initialize, prepare/import, reset, bootstrap or migration commands.
Do not change any Production Secrets, signing keys, admin approval values,
manifest bindings, database selection or bucket authority.

Keep the existing Production database. Never select Development data as the
Production database or copy test rows. If Publishing proposes unexpected
schema/data changes, stop before confirming them.

The normal entrypoint retains its maintenance gateway and readiness checks:
public liveness is not application readiness; readiness remains unsuccessful
until the existing startup transaction and reconciliation succeed. Normal
startup must not initialize an empty destination or fall back to JSON authority.

## Automated verification performed

- Full existing Fresh PostgreSQL suite, synthetic directory/accounts only:
  registration, email OTP, login, optional TOTP, admin safeguards, password
  recovery, session revocation/restart, posts, stories, profile and comment media,
  simultaneous employee uploads, rollback and lost-response duplicate protection.
- Upload progress/disconnect simulations, streaming storage verification and
  timeout/corruption tests, unsupported HEVC and overlong ISO-video rejection.
- Startup persistence batching and isolated advisory-lock observation tests.
- Mobile layout source checks and generated-client syntax.
- Syntax checks of all 214 tracked JavaScript/CommonJS/ES-module files.
- Exact deployment install command in an isolated archive of the candidate,
  with all three direct Production dependencies resolving successfully.

The fixtures contain invented users and media. No Production data, employee
source objects, Secrets or signing keys were used or changed by these tests.

## Security review and unresolved findings

Tracked-file checks found no employee/account JSON datasets, SMTP configuration
files, private-key files, backups, environment files, attached transcripts or
generated runtime directories in the release tree or newly introduced history
paths. Credential-pattern checks found no real credential match; database URL
matches are synthetic test fixtures. Existing public UI mailbox text is not a
new private employee-data export.

Security scanners are not an unconditional clean bill of health:

- The exact clean Production dependency install reports six moderate npm
  findings, including the App Storage SDK's transitive storage/request/UUID
  chain; that audit reports no high or critical findings.
- The broader workspace dependency scanner reports three high findings,
  involving UUID and Zod. Its scope/advisory results differ from the clean
  root Production install.
- Static analysis reports 13 critical, 17 high and two medium findings.
  Reviewed categories include parameterized SQL, allowlisted identifiers,
  static migration SQL and internally generated temporary paths; synthetic
  database URLs also trigger credential rules. These raw findings must not be
  described as a zero-finding scan or as confirmed exploits without analysis.
- The privacy/dataflow scanner reports no findings.

No unsupported storage-SDK major override or automatic dependency remediation
was applied merely to clear an audit.

## Remaining acceptance risks

- Real hosted proxy limits, App Storage upload performance and the original
  Production upload failure's exact cause remain unverified.
- Safari/WebKit, a physical iPhone, installed-PWA storage separation, keyboard
  behavior and upload background/termination behavior remain unverified.
- WebM server duration/codec inspection is less strict than MP4/MOV inspection.
- An unchanged upload can retry while its prepared Blob survives in the page;
  page termination does not provide resumable upload recovery.
- The existing response-scope guard may refuse replay after revisions change.
  Never bypass that guard or silently generate a replacement submission key.
- Failed storage/commit work can retain non-visible pending media intents.
  Do not delete pending objects automatically or delete existing media.
- Existing absolute/idle session expiry and browser-readable bearer storage
  remain; this candidate is not an HttpOnly-cookie session migration.

The configured 30 MiB video / 4 MiB raw-image limits and existing 60-second
client video policy were not changed during final release preparation.

## Operator action and post-publication checks

Only the operator may approve and execute Republish for the existing project,
after reviewing the risks above and confirming the displayed build/run
commands. Retain all existing Production settings.

After publication, first verify startup reconciliation, maintenance/liveness,
readiness and sanitized startup logs. Do not rerun initialization when a gate
fails; retain the new PostgreSQL authority and investigate the specific gate.

With separately approved account actions, smoke-test login/restoration/logout,
text posting, image and H.264 video upload/story publication, refresh playback,
and iPhone Safari/PWA behavior. Record HTTP outcomes and sanitized storage/SQL
commit evidence; never log tokens, email addresses, account records or keys.

Controlled-publication preparation is not full Production acceptance or
approval for company-wide rollout. Require successful post-publication smoke
tests before making that claim.
