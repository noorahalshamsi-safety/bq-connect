-- Operator-only: use the verified Production PRIMARY connection, during a
-- recurrence. Database tool/Agent replicas cannot show primary lock holders.
-- No query text, credentials, account fields, raw PIDs or role names returned.
-- Backend labels correlate SQL sessions only; they do not attest VM instances
-- or deployment revisions (especially through a transaction pooler).
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
WITH context AS MATERIALIZED (
  SELECT clock_timestamp() AS observed_at,
    NOT pg_is_in_recovery() AS is_primary,
    current_database() AS database_name,
    pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') AS all_stats
), relevant AS MATERIALIZED (
  SELECT l.pid, l.granted, l.mode, l.waitstart
  FROM pg_locks l CROSS JOIN context c
  WHERE c.is_primary AND l.locktype = 'advisory'
    AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND l.classid = 0 AND l.objid = 1793705963 AND l.objsubid = 1
)
SELECT c.observed_at, c.database_name,
  CASE WHEN NOT c.is_primary THEN 'PRIMARY_REQUIRED'
       WHEN NOT c.all_stats THEN 'FULL_STATS_REQUIRED'
       WHEN r.pid IS NULL THEN 'NO_MATCHING_LOCK_AT_CAPTURE'
       ELSE 'LOCK_OBSERVED' END AS evidence,
  current_setting('transaction_read_only') = 'on' AS read_only,
  CASE WHEN r.pid IS NOT NULL
    THEN substr(md5(r.pid::text || coalesce(a.backend_start::text, '')), 1, 12)
    END AS backend_label,
  r.granted, r.mode,
  CASE WHEN a.usename = current_user THEN 'SAME_ROLE'
       WHEN a.usename IS NOT NULL THEN 'OTHER_ROLE' END AS role_class,
  CASE a.application_name WHEN 'bq-fresh-production' THEN 'FRESH_RUNTIME'
    WHEN 'bq-managed-production' THEN 'MANAGED_RUNTIME'
    ELSE CASE WHEN r.pid IS NOT NULL THEN 'OTHER_OR_UNCLASSIFIED' END END AS application_class,
  a.state, a.wait_event_type, a.wait_event,
  round(extract(epoch FROM (c.observed_at - a.xact_start)) * 1000)::bigint AS transaction_ms,
  round(extract(epoch FROM (c.observed_at - a.query_start)) * 1000)::bigint AS query_age_ms,
  round(extract(epoch FROM (c.observed_at - r.waitstart)) * 1000)::bigint AS lock_wait_ms,
  CASE WHEN r.pid IS NULL THEN NULL
    WHEN a.query IS NULL OR a.query = '<insufficient privilege>' THEN 'HIDDEN'
    WHEN a.query ~* 'pg_advisory_xact_lock' THEN 'ADVISORY_XACT_LOCK'
    WHEN a.query ~* 'pg_advisory_lock' THEN 'ADVISORY_SESSION_LOCK'
    WHEN a.query ~* '^\s*(INSERT|UPDATE|DELETE)' THEN 'WRITE'
    WHEN a.query ~* '^\s*SELECT' THEN 'READ'
    WHEN a.query ~* '^\s*COMMIT' THEN 'COMMIT'
    ELSE 'OTHER' END AS last_query_class,
  CASE WHEN r.pid IS NULL THEN NULL ELSE ARRAY(
    SELECT substr(md5(p.pid::text || coalesce(b.backend_start::text, '')), 1, 12)
    FROM unnest(pg_blocking_pids(r.pid)) AS p(pid)
    LEFT JOIN pg_stat_activity b ON b.pid = p.pid
    ORDER BY p.pid
  ) END AS blocker_labels
FROM context c
LEFT JOIN relevant r ON true
LEFT JOIN pg_stat_activity a ON a.pid = r.pid
ORDER BY r.granted DESC NULLS LAST, backend_label;
ROLLBACK;
