-- BQ Connect least-privilege identities for an isolated STAGING database.
-- Run once as the provider administrator, connected to the staging database
-- only. Never run against the production database. Passwords are not set here:
-- the operator sets each one through the provider console or secret manager.
--
--   bq_owner     NOLOGIN  owns schema "dev" and every table in it
--   bq_migrator  LOGIN    schema deployment only (SET ROLE bq_owner)
--   bq_app       LOGIN    runtime DML only; no DDL, no role changes
--   bq_backup    LOGIN    read-only logical backup / verification
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bq_owner') THEN
    CREATE ROLE bq_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bq_migrator') THEN
    CREATE ROLE bq_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 2;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bq_app') THEN
    CREATE ROLE bq_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 8;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bq_backup') THEN
    CREATE ROLE bq_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 2;
  END IF;
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO bq_migrator, bq_app, bq_backup', current_database());
  EXECUTE format('GRANT CREATE ON DATABASE %I TO bq_owner', current_database());
END
$roles$;

GRANT bq_owner TO bq_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Schema "dev" is created by deploy/staging/migrate.cjs as bq_owner; these
-- defaults give every table it creates the runtime and backup privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE bq_owner
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bq_owner
  GRANT SELECT ON TABLES TO bq_backup;

ALTER ROLE bq_app SET statement_timeout = '20s';
ALTER ROLE bq_app SET lock_timeout = '12s';
ALTER ROLE bq_app SET idle_in_transaction_session_timeout = '60s';
