#!/usr/bin/env node
/**
 * 38 CFR 3.310(d)(1)(ii) presumption-eligibility flag scanner.
 *
 * Scans every catalog condition in data/knowledge-base/*.json and flags those
 * that are CANDIDATES for the § 3.310(d)(1)(ii) unprovoked-seizure presumption
 * (i.e. a TBI residuals host that also mentions seizure/epilepsy).
 *
 * The flag is a CANDIDACY indicator, not an eligibility assertion. Eligibility
 * is FIXED by the contemporaneous severity record (LOC/PTA/GCS at time of
 * injury), which no catalog node alone can supply. A flagged node is a draft
 * condition that a maintainer should review for presumption-facing content.
 *
 * Why this matters: row B of batch-5 (TBI residuals → seizure-disorder) is
 * authored as LEGALLY_PRESUMED / presumptive claim theory, but the catalog
 * still needs a machine-readable way to distinguish which draft TBI-adjacent
 * nodes CAN carry that presumption from ones that need a case-by-case § 3.310(a)
 * nexus. Without the flag, the graph loader and the recommendation engine treat
 * all TBI residuals edges the same.
 *
 * Output: JSON to stdout with one entry per flagged condition, plus a console
 * summary.
 *
 * Usage: node scripts/scan-tbi-presumption-eligibility.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const KB = join(ROOT, 'data', 'knowledge-base');

function readFileSyncUtf8(p) { return readFileSync(p, 'utf8'); }

const TBI_SEVERITY_INDICATORS = [
  'glasgow coma scale',
  'loss of consciousness',
  'post-traumatic amnesia',
  'moderate traumatic brain',
  'severe traumatic brain',
  'dc 8045',
  'traumatic brain injury',
  'tbi',
  '8045',
];

const SEIZURE_TERMS = [
  'seizure',
  'epilepsy',
  '8910',
  '8911',
  '8912',
  '8914',
  'post-traumatic seizure',
  'post traumatic seizure',
  'unprovoked seizure',
  'post-traumatic epilepsy',
  'post traumatic epilepsy',
];

function scanFile(file) {
  const id = file.replace(/\.json$/, '');
  let m;
  try { m = JSON.parse(readFileSyncUtf8(join(KB, file))); } catch { return null; }
  if (!m || typeof m !== 'object') return null;

  const text = JSON.stringify(m).toLowerCase();

  const hasTbiIndicator = TBI_SEVERITY_INDICATORS.some(k => text.includes(k));
  const hasSeizureTerm = SEIZURE_TERMS.some(k => text.includes(k));

  // Determine if the condition is draft
  const isDraft = m.draft === true;

  // Determine if the condition has any authored suggestions
  const suggestionCount = Array.isArray(m.suggestions) ? m.suggestions.length : 0;

  // Determine if the condition is a quarantined pointer
  const isPointer = !!(m.quarantine && m.quarantine.status === 'pointer');

  return {
    id,
    isDraft,
    hasTbiIndicator,
    hasSeizureTerm,
    suggestionCount,
    isPointer,
    // The text is large; only include a short snippet for flagged entries
    snippet: hasTbiIndicator && hasSeizureTerm
      ? (m.todo?.join(' ') ?? m.governanceNotes?.join(' ') ?? '').slice(0, 200).toLowerCase()
      : undefined,
  };
}

function main() {
  const files = readdirSync(KB).filter(f => f.endsWith('.json')).sort();
  const all = [];
  for (const file of files) {
    const r = scanFile(file);
    if (r) all.push(r);
  }

  const tbiHosts = all.filter(r => r.hasTbiIndicator);
  const seizureMentions = all.filter(r => r.hasSeizureTerm);
  const flagged = tbiHosts.filter(r => r.hasSeizureTerm);

  console.log('== 38 CFR 3.310(d)(1)(ii) presumption-eligibility scan ==\n');
  console.log(`Catalog files scanned:       ${all.length}`);
  console.log(`Draft conditions:            ${all.filter(r => r.isDraft).length}`);
  console.log(`Published conditions:        ${all.filter(r => !r.isDraft).length}`);
  console.log(`Quarantined pointers:        ${all.filter(r => r.isPointer).length}`);
  console.log(`Conditions referencing TBI:  ${tbiHosts.length} (draft ${tbiHosts.filter(r => r.isDraft).length}, published ${tbiHosts.filter(r => !r.isDraft).length})`);
  console.log(`Conditions mentioning seizure/epilepsy: ${seizureMentions.length}`);
  console.log(`FLAGGED (TBI host AND mentions seizure): ${flagged.length}\n`);

  if (flagged.length === 0) {
    console.log('No catalog conditions are both TBI hosts and mention seizure/epilepsy.');
    console.log('This means no draft node currently carries the § 3.310(d)(1)(ii)');
    console.log('presumption flag. The TBI→seizure-disorder row (batch-5, row B)');
    console.log('is authored with LEGALLY_PRESUMED alignment but the catalog flag');
    console.log('is not yet present on any node.');

    // Emit the JSON report anyway
    console.log('\n== Report ==');
    console.log(JSON.stringify({ scanned: all.length, flagged: [], note: 'No TBI hosts mention seizure/epilepsy — no presumption-eligible draft nodes flagged.' }, null, 2));
    return;
  }

  console.log('Flagged conditions (CANDIDATES for § 3.310(d)(1)(ii) presumption review):');
  for (const r of flagged) {
    const status = r.isDraft
      ? `draft (suggestions: ${r.suggestionCount})`
      : `PUBLISHED (suggestions: ${r.suggestionCount}) — presumption flag unexpected on a published node`;
    console.log(`  • ${r.id}`);
    console.log(`    status: ${status}`);
    if (r.snippet) console.log(`    todo/governance snippet: ${r.snippet.slice(0, 160)}...`);
    console.log('');
  }

  // Emit JSON report
  console.log('== JSON report ==');
  console.log(JSON.stringify({
    scanned: all.length,
    tbiHosts: tbiHosts.length,
    seizureMentions: seizureMentions.length,
    flagged: flagged.map(r => ({
      id: r.id,
      isDraft: r.isDraft,
      suggestionCount: r.suggestionCount,
      isPointer: r.isPointer,
    })),
    eligibilityRule: '38 CFR 3.310(d)(1)(ii): unprovoked seizures following MODERATE OR SEVERE traumatic brain injury are HELD to be the proximate result of that TBI in the absence of clear evidence to the contrary. No manifestation time limit. Mild TBI does NOT carry the presumption (falls to 3.310(a) case-by-case). Eligibility is FIXED by contemporaneous severity documentation (LOC/PTA/GCS at time of injury or shortly thereafter), not by the catalog node alone. A flagged node is a CANDIDATE for presumption review, not an assertion that any particular veteran qualifies.',
  }, null, 2));
}

main();
