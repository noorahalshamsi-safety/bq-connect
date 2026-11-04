// Narrow development read slice. Original auth/session/rate-limit handlers run
// unchanged, under the same advisory lock. No native writer is introduced.
const dependencies=["accounts.json","employees.json","security.json","moderators.json","conduct.json"];
const indexes=[
  "CREATE INDEX IF NOT EXISTS native_profile_badge ON dev.profiles(entry_key)",
  "CREATE INDEX IF NOT EXISTS native_follow_value ON dev.person_follows((attrs #>> '{}'))",
  "CREATE INDEX IF NOT EXISTS native_follow_badge ON dev.follows(entry_key)",
  "CREATE INDEX IF NOT EXISTS native_follow_complex ON dev.person_follows(id) WHERE jsonb_typeof(attrs)='array'"];
async function prepare(repo){
  const c=await repo.pool.connect();
  try{
    await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1793705963)");await repo.verify(c);
    for(const sql of indexes)await c.query(sql);
    await c.query("COMMIT");
  }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
}
function eligible(req,bytes){
  if(req.method!=="POST"||req.url!=="/api/social")return false;
  try{return JSON.parse(bytes).action==="person";}catch{return false;}
}
async function safe(transaction){
  const files=transaction.files,security=files.get("security.json")?.value||{};
  const employees=files.get("employees.json")?.value;
  if(!Array.isArray(employees)||employees.some(p=>!p||typeof p!=="object"))return false;
  const badges=[...employees.map(p=>p.badge),security.adminAccount?.badge,security.announcer?.badge].filter(x=>x!=null&&x!=="");
  if(badges.some(b=>!/^\d+$/.test(String(b).trim())))return false;
  // JS String([["101"]]) can equal "101"; SQL JSON text does not. Preserve
  // legacy coercion exactly by using the unchanged reference handler instead.
  const unusual=await transaction.client.query("SELECT EXISTS(SELECT 1 FROM dev.person_follows WHERE jsonb_typeof(attrs)='array') AS found");
  return !unusual.rows[0].found;
}
async function person(context,body,viewer,original){
  const target=original.personByPid(body.pid);
  if(!target){original.send(context.response,404,{error:"not_found"});return;}
  const badge=String(target.badge),actor=String(viewer.badge);
  const profiles=await context.client.query("SELECT entry_key,attrs FROM dev.profiles WHERE entry_key=$1",[badge]);
  if(profiles.rowCount>1)throw Error("native_profile_duplicate");
  // This projection is strictly read-only and is never a writable file entry.
  // Original avatar hashing/rendering sees exactly the target profile.
  const profile=profiles.rows[0]?.attrs||{};
  context.buffers.set("profiles.json",Buffer.from(JSON.stringify({[badge]:profile})));
  const counts=await context.client.query(`
    SELECT (SELECT count(DISTINCT f.id) FROM dev.person_follows p
      JOIN dev.person_follow_lists l ON p.parent=l.id AND l.shape->>'kind'='array'
      JOIN dev.follows f ON l.parent=f.id WHERE p.attrs #>> '{}'=$1) AS followers,
    (SELECT count(*) FROM dev.follows f
      JOIN dev.person_follow_lists l ON l.parent=f.id AND l.shape->>'kind'='array'
      JOIN dev.person_follows p ON p.parent=l.id WHERE f.entry_key=$1) AS following,
    EXISTS(SELECT 1 FROM dev.follows f
      JOIN dev.person_follow_lists l ON l.parent=f.id AND l.shape->>'kind'='array'
      JOIN dev.person_follows p ON p.parent=l.id
      WHERE f.entry_key=$2 AND p.attrs #>> '{}'=$1) AS followed`,[badge,actor]);
  const row=counts.rows[0];
  original.send(context.response,200,{person:{
    ...original.lightCard(target),bio:profile.bio||"",official:original.isOfficialBadge(badge),
    mine:badge===actor,followed:row.followed,followers:Number(row.followers),following:Number(row.following)
  }});
}
module.exports={dependencies,indexes,prepare,eligible,safe,person};
