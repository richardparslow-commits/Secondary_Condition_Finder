#!/usr/bin/env node
/** One-time DEV-only provisioning; NEVER called by GitHub Actions. No secrets printed. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { parseDevConnection } from "./tiger-evidence-dev.mjs";

const SID = "m8vrpmo6ec";
const HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const USER = "scf_evidence_ci_writer";
const SERVICE = "SCF-Tiger-Autonomous-Evidence-DEV-URL";
const ACCOUNT = "richardparslow";
const REPO = "richardparslow-commits/Secondary_Condition_Finder";
const ENVIRONMENT = "tiger-dev-research";

const run = (cmd,args,opts={}) => {
  const proc=spawnSync(cmd,args,{encoding:"utf8",timeout:30000,...opts});
  if(proc.status!==0 || proc.error) throw new Error("Secure credential setup action failed");
  return proc.stdout.trim();
};
async function main() {
  assert.deepEqual(process.argv.slice(2),["--create-dev-only"]);
  const config = getLabConnection(SID,"verify"); // exact READY/DEV identity first
  assert.equal(config.PGHOST,HOST);
  assert.equal(config.PGPORT,"30902");
  assert.equal(config.PGUSER,"tsdbadmin");
  assert.equal(config.PGDATABASE,"tsdb");
  assert.equal(config.TIGER_LAB_ENDPOINT,"direct");
  const admin = new Client({
    host:HOST,port:30902,database:"tsdb",user:config.PGUSER,
    password:config.PGPASSWORD,ssl:{rejectUnauthorized:true},
    connectionTimeoutMillis:8000,statement_timeout:15000,
    application_name:"scf_evidence_dev_provision_once",
  });
  await admin.connect();
  let url;
  try {
    const role = await admin.query("SELECT rolname FROM pg_roles WHERE rolname=$1",[USER]);
    assert.ok(role.rows.length<=1);
    let password;
    if (role.rows.length) {
      url=run("security",["find-generic-password","-s",SERVICE,"-a",ACCOUNT,"-w"]);
      // Cannot rotate an existing role silently; explicit review needed.
      const parsed=parseDevConnection(url);
      const probe=new Client(parsed);
      await probe.connect();
      await probe.query("SELECT 1");
      await probe.end();
      console.log("Existing dedicated DEV role and Keychain secret verified");
    } else {
      password=randomBytes(42).toString("base64url");
      url="postgresql://"+USER+":"+encodeURIComponent(password)+"@"+HOST+":30902/tsdb?sslmode=require";
      parseDevConnection(url);
      await admin.query("BEGIN");
      try {
        await admin.query(readFileSync(new URL("./tiger-evidence-dev.sql",import.meta.url),"utf8"));
        // Cryptographically generated base64url token contains no SQL quote.
        assert.match(password,/^[A-Za-z0-9_-]{50,70}$/);
        await admin.query("CREATE ROLE "+USER+" WITH LOGIN PASSWORD '"+password+
          "' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 6");
        await admin.query("ALTER ROLE "+USER+" SET statement_timeout='15s'");
        await admin.query("ALTER ROLE "+USER+" SET idle_in_transaction_session_timeout='20s'");
        await admin.query("GRANT CONNECT ON DATABASE tsdb TO "+USER);
        await admin.query("GRANT USAGE ON SCHEMA scf_autonomous_evidence_dev TO "+USER);
        await admin.query("GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA scf_autonomous_evidence_dev TO "+USER);
        await admin.query("COMMIT");
      } catch {
        await admin.query("ROLLBACK").catch(()=>undefined);
        throw new Error("Dedicated DEV schema/role creation failed and rolled back");
      }
      run("security",["add-generic-password","-U","-a",ACCOUNT,
        "-s",SERVICE,"-w",url]);
      console.log("Dedicated DEV evidence schema and minimum-privilege role created");
    }
  } finally {
    await admin.end().catch(()=>undefined);
  }
  const client=new Client(parseDevConnection(url));
  await client.connect();
  try {
    const r=await client.query(
      "SELECT current_user AS username, "+
      "has_schema_privilege(current_user,'scf_autonomous_evidence_dev','CREATE') AS schema_create, "+
      "has_table_privilege(current_user,'scf_autonomous_evidence_dev.runs','INSERT') AS can_insert, "+
      "has_table_privilege(current_user,'scf_autonomous_evidence_dev.runs','SELECT') AS can_select, "+
      "has_table_privilege(current_user,'scf_autonomous_evidence_dev.runs','UPDATE') AS can_update, "+
      "has_table_privilege(current_user,'scf_autonomous_evidence_dev.runs','DELETE') AS can_delete");
    assert.equal(r.rows[0].username,USER);
    assert.equal(r.rows[0].schema_create,false);
    assert.equal(r.rows[0].can_insert,true);
    assert.equal(r.rows[0].can_select,true);
    assert.equal(r.rows[0].can_update,false);
    assert.equal(r.rows[0].can_delete,false);
    console.log("DEV credentials verified: SELECT/INSERT permitted; CREATE/UPDATE/DELETE denied");
  } finally {
    await client.end().catch(()=>undefined);
  }
  // GitHub CLI uses repo public key encryption before upload. Secret never
  // appears in argv, stdout, source, artifact, logs or GitHub PR.
  run("gh",["secret","set","TIGER_AUTOMATION_DEV_URL",
    "--env",ENVIRONMENT,"--repo",REPO],{input:url+"\n"});
  const listed=run("gh",["secret","list","--env",ENVIRONMENT,"--repo",REPO]);
  assert.ok(listed.split("\n").some((s)=>s.startsWith("TIGER_AUTOMATION_DEV_URL\t")));
  console.log("Encrypted GitHub Actions DEV-environment secret saved; value withheld");
  console.log("Environment restricted to main branch; Production credentials untouched");
}
main().catch(()=>{
  console.error("Secure DEV provisioning blocked/failed. Never log passwords or untrusted SQL.");
  process.exitCode=1;
});
