// Source of truth for DEVELOPMENT installation. Production schema is installed
// only by Replit's reviewed Publish diff, never this module or runtime startup.
const codec=require("../../development/postgres/codec.cjs");
const {controlDdl}=require("../../development/postgres/repository.cjs");
const {indexes}=require("../../development/postgres/native-profile.cjs");
const {migrations,check}=require("../staging/migrate.cjs");
const {sha,canonical,fail}=require("./config.cjs");
const base=codec.ddl().replaceAll(" DEFERRABLE INITIALLY DEFERRED","")
  .replace("mode IN('synthetic','frozen')","mode IN('synthetic','frozen','production')")
  .replace("point IN('before_commit','after_commit_drop')","point IN('before_commit','during_commit','unknown_commit','after_commit_drop','handler_timeout')");
const statements=[base,
  "CREATE TABLE dev.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT clock_timestamp())",
  controlDdl.requestColumns,...indexes];
const releaseFingerprint=sha(canonical({version:"managed-1",statements,legacy:migrations.map(({version,checksum})=>({version,checksum}))}));
async function describe(client){
  const columns=(await client.query(`SELECT c.relname AS table_name,a.attnum AS ordinal,a.attname AS name,
    format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,a.attgenerated AS generated,
    pg_get_expr(d.adbin,d.adrelid) AS default_expr FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='dev' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`)).rows;
  const constraints=(await client.query(`SELECT c.conrelid::regclass::text AS table_name,c.contype,c.condeferrable,c.condeferred,c.convalidated,
    pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    WHERE n.nspname='dev' ORDER BY 1,2,6`)).rows;
  const indices=(await client.query(`SELECT c.relname AS table_name,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid,0,true) AS definition
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dev' ORDER BY 1,4`)).rows
    .map(r=>({...r,definition:r.definition.replace(/ INDEX \S+ ON /," INDEX ON ")})).sort((a,b)=>canonical(a).localeCompare(canonical(b),"en"));
  const unsupported=(await client.query(`SELECT
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dev' AND NOT t.tgisinternal)::int AS triggers,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dev')::int AS functions,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dev' AND (c.relrowsecurity OR c.relforcerowsecurity)) AS unexpected_rls,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dev' AND c.relkind NOT IN('r','i')) AS unexpected_relation`)).rows[0];
  if(unsupported.triggers||unsupported.functions)fail("managed_unsupported_schema_object");
  if(unsupported.unexpected_rls||unsupported.unexpected_relation)fail("managed_unreviewed_schema_policy");
  if(!columns.length)fail("managed_schema_missing");
  return {fingerprint:sha(canonical({columns,constraints,indices})),tables:new Set(columns.map(r=>r.table_name)).size};
}
async function requireSchema(client,manifest){
  if(manifest.releaseFingerprint!==releaseFingerprint)fail("managed_release_checksum_mismatch");
  const shape=await describe(client);
  if(shape.fingerprint!==manifest.schemaFingerprint)fail("managed_schema_contract_mismatch");
  const ledger=new Map((await client.query("SELECT version,checksum FROM dev.schema_migrations")).rows.map(r=>[r.version,r.checksum]));
  // Publish copies schema, NOT ledger rows. An empty ledger is accepted only
  // with the exact independently attested structural+release contract above.
  if(ledger.size){check(ledger);if(ledger.size!==migrations.length)fail("schema_migration_pending");}
  return {...shape,version:"managed-1",ledger:ledger.size?"checksummed":"structural-contract"};
}
module.exports={statements,releaseFingerprint,describe,requireSchema,migrations};
