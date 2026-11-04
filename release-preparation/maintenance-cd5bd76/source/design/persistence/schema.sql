-- DESIGN PROTOTYPE ONLY. Not an application migration or deployment hook.
-- Only scripts/architecture/validate.cjs applies this, to a new /tmp cluster.
-- No production connection string, credentials, real data, or extensions needed.
CREATE SCHEMA bq;
SET search_path = bq, public;

CREATE TABLE authority (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  dataset_id text NOT NULL UNIQUE,
  writer_epoch bigint NOT NULL CHECK (writer_epoch > 0),
  mode text NOT NULL CHECK (mode IN ('frozen','postgres','read_only')),
  schema_version integer NOT NULL CHECK (schema_version > 0)
);
CREATE TABLE counters (
  name text PRIMARY KEY,
  value bigint NOT NULL CHECK (value >= 0)
);
CREATE TABLE departments (
  name text PRIMARY KEY CHECK (length(name) > 0),
  about text NOT NULL DEFAULT ''
);
-- Employees without accounts, and official non-employee identities, are valid.
-- Preserve badge strings exactly; never manufacture employee directory records.
CREATE TABLE people (
  badge text PRIMARY KEY CHECK (length(badge) > 0),
  kind text NOT NULL CHECK (kind IN ('employee','system')),
  display_name text NOT NULL,
  department text REFERENCES departments(name),
  position text NOT NULL DEFAULT '',
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE TABLE employees (
  badge text PRIMARY KEY REFERENCES people(badge),
  check_hash text,
  phone_hash text
);
CREATE TABLE identity_aliases (
  namespace text NOT NULL CHECK (namespace IN ('public_id','legacy_public_id')),
  alias text NOT NULL,
  badge text NOT NULL REFERENCES people(badge),
  PRIMARY KEY (namespace, alias),
  UNIQUE (namespace, badge)
);
CREATE TABLE accounts (
  badge text PRIMARY KEY REFERENCES people(badge),
  password_hash text,
  salt text,
  kdf integer,
  session_version bigint NOT NULL CHECK (session_version >= 1),
  email text,
  created_at timestamptz,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  -- Legacy optional flags/unknown fields are retained, not reinterpreted.
  extension jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(extension) = 'object'),
  CHECK (password_hash IS NULL OR (salt IS NOT NULL AND kdf IS NOT NULL))
);
CREATE TABLE pending_credentials (
  badge text PRIMARY KEY REFERENCES accounts(badge),
  credential jsonb NOT NULL CHECK (jsonb_typeof(credential) = 'object')
);
CREATE TABLE two_factor (
  badge text PRIMARY KEY REFERENCES accounts(badge),
  enabled boolean NOT NULL,
  sealed_key text,
  last_counter bigint,
  extension jsonb NOT NULL DEFAULT '{}',
  CHECK (NOT enabled OR sealed_key IS NOT NULL)
);
CREATE TABLE recovery_codes (
  badge text NOT NULL REFERENCES accounts(badge),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  code_hash text NOT NULL,
  PRIMARY KEY (badge, ordinal),
  UNIQUE (badge, code_hash)
);
CREATE TABLE pending_two_factor (
  badge text PRIMARY KEY REFERENCES accounts(badge),
  sealed_key text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE sessions (
  badge text NOT NULL REFERENCES accounts(badge),
  sid text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  created_at timestamptz,
  last_seen timestamptz,
  expires_at timestamptz NOT NULL,
  ip text,
  device jsonb NOT NULL DEFAULT '{}',
  extension jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (badge, sid),
  UNIQUE (badge, ordinal)
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE remembered_devices (
  badge text NOT NULL REFERENCES accounts(badge),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  signature text NOT NULL,
  PRIMARY KEY (badge, ordinal)
);
CREATE TABLE terms_acceptance (
  badge text PRIMARY KEY REFERENCES accounts(badge),
  version text NOT NULL,
  accepted_at timestamptz
);
CREATE TABLE roles (
  badge text NOT NULL REFERENCES people(badge),
  role text NOT NULL CHECK (role IN ('admin','moderator','announcer')),
  PRIMARY KEY (badge, role)
);
CREATE TABLE profiles (
  badge text PRIMARY KEY REFERENCES people(badge),
  bio text NOT NULL DEFAULT '',
  legacy_photo_data_uri text,
  revision bigint NOT NULL DEFAULT 1
);
CREATE TABLE social_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text,
  department text REFERENCES departments(name),
  created_at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE group_members (
  group_id text NOT NULL REFERENCES social_groups(id),
  badge text NOT NULL REFERENCES people(badge),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (group_id, badge),
  UNIQUE (group_id, ordinal)
);
CREATE TABLE posts (
  id text PRIMARY KEY,
  -- Legacy numbers must first pass a duplicate audit; not silently renumbered.
  number bigint,
  type text NOT NULL CHECK (type IN ('post','idea','suggestion','complaint','thanks',
    'story','poll','article','announcement','event')),
  badge text NOT NULL REFERENCES people(badge),
  group_id text REFERENCES social_groups(id),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text CHECK (status IN ('received','review','project','resolved')),
  replies text NOT NULL DEFAULT 'all' CHECK (replies IN ('all','department','none')),
  created_at timestamptz,
  expires_at timestamptz,
  event_at timestamptz,
  pinned boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  thanks_badge text REFERENCES people(badge),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  -- Historical author snapshots, problem/pros/cons/impact/place/project,
  -- moderation metadata, event reminder markers and unmodeled optional fields.
  extension jsonb NOT NULL DEFAULT '{}',
  CHECK (type <> 'story' OR expires_at IS NOT NULL)
);
CREATE INDEX posts_feed ON posts(created_at DESC, id);
CREATE INDEX posts_author ON posts(badge, created_at DESC);
CREATE INDEX posts_group ON posts(group_id, created_at DESC);
CREATE INDEX posts_expiry ON posts(expires_at) WHERE type = 'story';
CREATE INDEX posts_workflow ON posts(status, created_at) WHERE status IS NOT NULL;
CREATE TABLE comments (
  post_id text NOT NULL REFERENCES posts(id),
  id text NOT NULL,
  badge text NOT NULL REFERENCES people(badge),
  parent_id text,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  body text NOT NULL,
  created_at timestamptz,
  revision bigint NOT NULL DEFAULT 1,
  extension jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (post_id, id),
  UNIQUE (post_id, ordinal),
  FOREIGN KEY (post_id, parent_id) REFERENCES comments(post_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX comments_parent ON comments(post_id, parent_id);
-- Same-post FK plus recursive cycle validation is required in the adapter/import.
CREATE TABLE ratings (
  post_id text NOT NULL REFERENCES posts(id),
  badge text NOT NULL REFERENCES people(badge),
  vote text CHECK (vote IN ('like','dislike')),
  legacy_stars integer CHECK (legacy_stars BETWEEN 1 AND 5),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  extension jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (post_id, badge),
  UNIQUE (post_id, ordinal),
  CHECK (vote IS NOT NULL OR legacy_stars IS NOT NULL)
);
CREATE TABLE comment_likes (
  post_id text NOT NULL,
  comment_id text NOT NULL,
  badge text NOT NULL REFERENCES people(badge),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (post_id, comment_id, badge),
  FOREIGN KEY (post_id, comment_id) REFERENCES comments(post_id, id)
);
CREATE TABLE reposts (
  post_id text NOT NULL REFERENCES posts(id),
  badge text NOT NULL REFERENCES people(badge),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  body text NOT NULL DEFAULT '',
  created_at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (post_id, badge)
);
CREATE TABLE poll_options (
  post_id text NOT NULL REFERENCES posts(id),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  label text NOT NULL,
  PRIMARY KEY (post_id, ordinal)
);
CREATE TABLE poll_votes (
  post_id text NOT NULL,
  option_ordinal integer NOT NULL,
  badge text NOT NULL REFERENCES people(badge),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (post_id, badge),
  FOREIGN KEY (post_id, option_ordinal) REFERENCES poll_options(post_id, ordinal)
);
CREATE TABLE post_acknowledgements (
  post_id text NOT NULL REFERENCES posts(id),
  badge text NOT NULL REFERENCES people(badge),
  PRIMARY KEY (post_id, badge)
);
CREATE TABLE event_attendees (
  post_id text NOT NULL REFERENCES posts(id),
  badge text NOT NULL REFERENCES people(badge),
  PRIMARY KEY (post_id, badge)
);
CREATE TABLE status_history (
  post_id text NOT NULL REFERENCES posts(id),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  status text NOT NULL CHECK (status IN ('received','review','project','resolved')),
  actor_badge text REFERENCES people(badge),
  at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (post_id, ordinal)
);
CREATE TABLE post_reports (
  post_id text NOT NULL REFERENCES posts(id),
  badge text NOT NULL REFERENCES people(badge),
  reason text NOT NULL,
  at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (post_id, badge)
);
CREATE TABLE bookmarks (
  badge text NOT NULL REFERENCES people(badge),
  post_id text NOT NULL REFERENCES posts(id),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (badge, post_id)
);
CREATE TABLE post_views (
  post_id text NOT NULL REFERENCES posts(id),
  viewer_badge text NOT NULL REFERENCES people(badge),
  legacy_public_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (post_id, viewer_badge)
);
CREATE TABLE person_follows (
  follower text NOT NULL REFERENCES people(badge),
  followed text NOT NULL REFERENCES people(badge),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (follower, followed),
  CHECK (follower <> followed)
);
CREATE INDEX person_followers ON person_follows(followed, follower);
CREATE TABLE department_follows (
  badge text NOT NULL REFERENCES people(badge),
  department text NOT NULL REFERENCES departments(name),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (badge, department)
);
CREATE TABLE notifications (
  id text PRIMARY KEY,
  badge text NOT NULL REFERENCES people(badge),
  post_id text REFERENCES posts(id),
  -- Some historic notifications outlive deleted posts, or refer to achievements.
  legacy_subject_id text,
  kind text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX notifications_inbox ON notifications(badge, is_read, created_at DESC);
CREATE TABLE legacy_announcements (
  id text PRIMARY KEY,
  subject text,
  body text,
  sender_label text,
  created_at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE announcement_seen (
  badge text NOT NULL REFERENCES people(badge),
  announcement_id text NOT NULL REFERENCES legacy_announcements(id),
  PRIMARY KEY (badge, announcement_id)
);
CREATE TABLE achievements (
  department text NOT NULL REFERENCES departments(name),
  id text NOT NULL,
  badge text NOT NULL REFERENCES people(badge),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (department, id)
);
CREATE TABLE highlights (
  badge text NOT NULL REFERENCES people(badge),
  id text NOT NULL,
  title text,
  created_at timestamptz,
  cover_legacy_path text,
  PRIMARY KEY (badge, id)
);
-- Actual highlights contain archived story snapshots, not just live story IDs.
CREATE TABLE highlight_items (
  badge text NOT NULL,
  highlight_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  original_story_id text NOT NULL,
  snapshot jsonb NOT NULL,
  PRIMARY KEY (badge, highlight_id, ordinal),
  FOREIGN KEY (badge, highlight_id) REFERENCES highlights(badge, id)
);
CREATE TABLE daily_sparks (
  source_date date NOT NULL,
  department text NOT NULL,
  generator_version integer NOT NULL,
  item jsonb NOT NULL,
  PRIMARY KEY (source_date, department)
);
CREATE TABLE join_requests (
  id text PRIMARY KEY,
  proposed_badge text NOT NULL,
  created_at timestamptz,
  record jsonb NOT NULL
);
CREATE TABLE conduct_warnings (
  id text PRIMARY KEY,
  badge text NOT NULL REFERENCES people(badge),
  at timestamptz,
  location text,
  excerpt text,
  matched_words jsonb NOT NULL
);
CREATE TABLE conduct_state (
  badge text PRIMARY KEY REFERENCES people(badge),
  ban jsonb,
  reset_at timestamptz
);
CREATE TABLE security_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_ordinal integer,
  at timestamptz,
  type text NOT NULL,
  who_label text NOT NULL,
  ip text,
  device jsonb
);
CREATE TABLE push_subscriptions (
  endpoint text PRIMARY KEY,
  badge text NOT NULL REFERENCES people(badge),
  p256dh text NOT NULL,
  auth_material text NOT NULL,
  lang text,
  origin text,
  subscribed_at timestamptz
);
CREATE TABLE settings (
  name text PRIMARY KEY,
  value jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1
);
-- Keys/passwords/tokens are NOT settings rows. Secure external key escrow is
-- referenced by identifiers only; preserve existing bytes and derivation.
CREATE TABLE key_domains (
  name text PRIMARY KEY,
  secure_reference text NOT NULL,
  protected_fingerprint text NOT NULL
);
CREATE TABLE media_objects (
  id text PRIMARY KEY,
  bucket_binding text NOT NULL,
  object_key text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  content_type text NOT NULL,
  owner_badge text REFERENCES people(badge),
  state text NOT NULL CHECK (state IN ('pending','ready','quarantined','retained')),
  legacy_path text UNIQUE,
  provider_version text,
  UNIQUE (bucket_binding, object_key)
);
CREATE TABLE post_media (
  post_id text NOT NULL REFERENCES posts(id),
  role text NOT NULL CHECK (role IN ('primary','gallery')),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  media_id text NOT NULL REFERENCES media_objects(id),
  PRIMARY KEY (post_id, role, ordinal)
);
CREATE TABLE comment_media (
  post_id text NOT NULL,
  comment_id text NOT NULL,
  media_id text NOT NULL REFERENCES media_objects(id),
  PRIMARY KEY (post_id, comment_id, media_id),
  FOREIGN KEY (post_id, comment_id) REFERENCES comments(post_id, id)
);
CREATE TABLE profile_media (
  badge text PRIMARY KEY REFERENCES profiles(badge),
  media_id text NOT NULL REFERENCES media_objects(id)
);
ALTER TABLE highlights ADD COLUMN cover_media_id text REFERENCES media_objects(id);
CREATE TABLE highlight_media (
  badge text NOT NULL,
  highlight_id text NOT NULL,
  ordinal integer NOT NULL,
  media_id text NOT NULL REFERENCES media_objects(id),
  PRIMARY KEY (badge, highlight_id, ordinal, media_id),
  FOREIGN KEY (badge, highlight_id, ordinal)
    REFERENCES highlight_items(badge, highlight_id, ordinal)
);
CREATE TABLE requests (
  actor_badge text NOT NULL REFERENCES people(badge),
  request_id text NOT NULL,
  operation text NOT NULL,
  input_sha256 text NOT NULL,
  result jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_badge, request_id)
);
CREATE TABLE outbox (
  event_id text PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivered_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX outbox_pending ON outbox(created_at) WHERE delivered_at IS NULL;
-- Proposed shared state replacing process-local challenge/replay/rate maps.
CREATE TABLE challenges (
  id text PRIMARY KEY,
  badge text REFERENCES people(badge),
  kind text NOT NULL,
  proof_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  extension jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE rate_buckets (
  namespace text NOT NULL,
  subject_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts >= 0),
  PRIMARY KEY (namespace, subject_hash, window_start)
);
-- Restricted migration ledger; not an operational substitute for normalization.
-- Original source bytes belong in an encrypted immutable recovery bundle.
CREATE TABLE migration_records (
  source_file text NOT NULL,
  source_key text NOT NULL,
  source_ordinal integer,
  raw_json jsonb NOT NULL,
  canonical_sha256 text NOT NULL,
  PRIMARY KEY (source_file, source_key)
);
CREATE TABLE reconciliation_issues (
  source_file text NOT NULL,
  source_key text NOT NULL,
  reason text NOT NULL,
  protected_record jsonb NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  PRIMARY KEY (source_file, source_key, reason)
);
CREATE TABLE recovery_points (
  id text PRIMARY KEY,
  dataset_id text NOT NULL,
  writer_epoch bigint NOT NULL,
  protected_manifest_reference text NOT NULL,
  manifest_sha256 text NOT NULL,
  created_at timestamptz NOT NULL,
  verified_at timestamptz
);
