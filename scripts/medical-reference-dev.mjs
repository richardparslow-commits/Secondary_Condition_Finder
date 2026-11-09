#!/usr/bin/env node
/**
 * Public-source DEV reference pilot. This script does NOT accept clinical
 * records, medication histories, patient identifiers, or free-text queries.
 *
 * Modes:
 *   collect --live   (official API GETs; writes bounded metadata JSON to /tmp)
 *   apply --dev-write (transactional versioned writes ONLY to named DEV service)
 *   verify           (read-only comparison of all staged metadata digests)
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertSnapshot, collectPublicReferences, validatePublicSeed,
} from "./lib/public-medical-reference.mjs";
import {
  DEV_SERVICE, applyResearchSnapshot, verifyResearchSnapshot,
} from "./lib/medical-reference-tiger-dev.mjs";

const seedPath = fileURLToPath(new URL("./fixtures/medical-reference-dev-seeds.json", import.meta.url));
const snapshotPath = "/tmp/scf-public-medical-reference-dev-pilot.json";
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const mode = process.argv[2];
const flags = process.argv.slice(3);
const summary = (snapshot) => {
  const counts = Object.fromEntries(["pubmed", "rxnorm", "openfda_label"].map(
    (provider) => [provider, snapshot.records.filter((r) => r.provider === provider).length],
  ));
  const unresolved = snapshot.records.filter((r) => r.status === "unresolved").length;
  return { snapshot: snapshot.contentDigest, seedId: snapshot.seedId, ...counts,
    unresolved, records: snapshot.records.length, clinicalApproval: "NOT_GRANTED" };
};

function referenceRegistryPmids() {
  const registry = JSON.parse(readFileSync("data/evidence/master-sources.json", "utf8"));
  const sources = registry.sources ?? [];
  return new Set(sources.filter((x) => x.status === "active" && typeof x.pmid === "string")
    .map((x) => x.pmid));
}

async function main() {
  validatePublicSeed(seed, referenceRegistryPmids());
  if (mode === "collect") {
    assert.deepEqual(flags, ["--live"], "collect requires explicit --live flag");
    const repoCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8", timeout: 8_000,
    }).trim();
    const snapshot = await collectPublicReferences(seed, {
      keys: { ncbi: process.env.NCBI_API_KEY, fda: process.env.OPENFDA_API_KEY },
      repoCommit,
    });
    // Output contains only public bibliographic, terminology, and label
    // metadata. Never store abstracts, full drug labels, or user intake.
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", {
      mode: 0o600, flag: "w",
    });
    console.log(JSON.stringify({ result: "collected_metadata_only", file: snapshotPath,
      ...summary(snapshot) }));
    return;
  }

  if (!["apply", "verify"].includes(mode)) {
    throw new Error("Usage: collect --live | apply --dev-write | verify");
  }
  assert.deepEqual(flags, mode === "apply" ? ["--dev-write"] : [],
    "Unexpected mode flags");
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  assertSnapshot(snapshot, seed);

  const result = mode === "apply"
    ? await applyResearchSnapshot(DEV_SERVICE, snapshot, seed)
    : await verifyResearchSnapshot(DEV_SERVICE, snapshot, seed);
  console.log(JSON.stringify({ ...result, unresolved: summary(snapshot).unresolved,
    clinicalApproval: "NOT_GRANTED" }));
}

main().catch(() => {
  // Sanitized diagnostic: API URLs may contain keys, and database errors may
  // include PHI-shaped strings; neither should reach stdout, stderr or CI.
  console.error("Public-medical-reference DEV command failed. No credentials or clinical content logged.");
  process.exitCode = 1;
});
