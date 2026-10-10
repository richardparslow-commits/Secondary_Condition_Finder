import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_DIR = join(process.cwd(), 'docs');
const EUTILS_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const EUTILS_EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

const PACKET_KEYS = [
  'secondaryCondition',
  'secondaryDiagnosticCode',
  'primaryCondition',
  'primaryDiagnosticCode',
  'nexusTheory',
  'etiologicalMechanism',
  'medicalEvidence',
  'cfrCitations',
] as const;

const EVIDENCE_KEYS = ['title', 'authors', 'summary', 'url'] as const;

const NEXUS_THEORIES = ['Causation', 'Aggravation', 'Medication Side Effect'] as const;

type PacketKey = (typeof PACKET_KEYS)[number];
type EvidenceKey = (typeof EVIDENCE_KEYS)[number];
type NexusTheory = (typeof NEXUS_THEORIES)[number];

function extractPmid(url: string): string | null {
  const m = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{4,9})\/$/);
  return m ? m[1] : null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function validatePacketShape(row: unknown, index: number): string[] {
  const errors: string[] = [];
  const obj = row as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') {
    errors.push(`row[${index}]: not an object`);
    return errors;
  }
  const keys = Object.keys(obj);
  for (let i = 0; i < PACKET_KEYS.length; i++) {
    const expected = PACKET_KEYS[i];
    if (i >= keys.length) {
      errors.push(`row[${index}]: missing key "${expected}"`);
      continue;
    }
    if (keys[i] !== expected) {
      errors.push(`row[${index}]: key order wrong at position ${i} — expected "${expected}", got "${keys[i]}"`);
    }
  }
  if (keys.length > PACKET_KEYS.length) {
    errors.push(`row[${index}]: ${keys.length - PACKET_KEYS.length} extra key(s): ${keys.slice(PACKET_KEYS.length)}`);
  }
  const sc = obj.secondaryCondition;
  if (typeof sc !== 'string' || sc.trim().length < 5) {
    errors.push(`row[${index}]: secondaryCondition must be a non-trivial string, got ${JSON.stringify(sc)}`);
  }
  const sdc = obj.secondaryDiagnosticCode;
  if (typeof sdc !== 'string' || sdc.trim().length < 5) {
    errors.push(`row[${index}]: secondaryDiagnosticCode must be a non-trivial string, got ${JSON.stringify(sdc)}`);
  }
  const pc = obj.primaryCondition;
  if (typeof pc !== 'string' || pc.trim().length < 5) {
    errors.push(`row[${index}]: primaryCondition must be a non-trivial string, got ${JSON.stringify(pc)}`);
  }
  const pdc = obj.primaryDiagnosticCode;
  if (typeof pdc !== 'string' || pdc.trim().length < 5) {
    errors.push(`row[${index}]: primaryDiagnosticCode must be a non-trivial string, got ${JSON.stringify(pdc)}`);
  }
  const nt = obj.nexusTheory;
  if (typeof nt !== 'string' || !NEXUS_THEORIES.includes(nt as NexusTheory)) {
    errors.push(`row[${index}]: nexusTheory must be one of ${NEXUS_THEORIES.join(', ')}, got ${JSON.stringify(nt)}`);
  }
  const em = obj.etiologicalMechanism;
  if (typeof em !== 'string' || em.trim().length < 1500) {
    errors.push(`row[${index}]: etiologicalMechanism must be >= 1500 chars, got ${typeof em === 'string' ? em.trim().length : typeof em}`);
  }
  const me = obj.medicalEvidence;
  if (!Array.isArray(me)) {
    errors.push(`row[${index}]: medicalEvidence must be an array, got ${typeof me}`);
  } else {
    if (me.length < 1 || me.length > 3) {
      errors.push(`row[${index}]: medicalEvidence must have 1-3 entries, got ${me.length}`);
    }
    for (let j = 0; j < me.length; j++) {
      const entry = me[j] as Record<string, unknown> | null;
      if (!entry || typeof entry !== 'object') {
        errors.push(`row[${index}].medicalEvidence[${j}]: not an object`);
        continue;
      }
      const eKeys = Object.keys(entry);
      for (let k = 0; k < EVIDENCE_KEYS.length; k++) {
        const ek = EVIDENCE_KEYS[k];
        if (k >= eKeys.length) {
          errors.push(`row[${index}].medicalEvidence[${j}]: missing key "${ek}"`);
          continue;
        }
        if (eKeys[k] !== ek) {
          errors.push(`row[${index}].medicalEvidence[${j}]: key order wrong at ${k} — expected "${ek}", got "${eKeys[k]}"`);
        }
      }
      if (eKeys.length > EVIDENCE_KEYS.length) {
        errors.push(`row[${index}].medicalEvidence[${j}]: extra key(s): ${eKeys.slice(EVIDENCE_KEYS.length)}`);
      }
      const title = entry.title;
      if (typeof title !== 'string' || title.trim().length < 5) {
        errors.push(`row[${index}].medicalEvidence[${j}]: title must be a non-trivial string, got ${JSON.stringify(title)}`);
      }
      const authors = entry.authors;
      if (typeof authors !== 'string' || authors.trim().length < 3) {
        errors.push(`row[${index}].medicalEvidence[${j}]: authors must be a non-trivial string, got ${JSON.stringify(authors)}`);
      }
      const summary = entry.summary;
      if (typeof summary !== 'string' || summary.trim().length < 20) {
        errors.push(`row[${index}].medicalEvidence[${j}]: summary must be >= 20 chars, got ${typeof summary === 'string' ? summary.trim().length : typeof summary}`);
      }
      const url = entry.url;
      if (typeof url !== 'string' || !url.startsWith('https://pubmed.ncbi.nlm.nih.gov/')) {
        errors.push(`row[${index}].medicalEvidence[${j}]: url must be https://pubmed.ncbi.nlm.nih.gov/<PMID>/, got ${JSON.stringify(url)}`);
      }
      const pmid = extractPmid(url as string);
      if (!pmid) {
        errors.push(`row[${index}].medicalEvidence[${j}]: url does not contain a parseable PMID: ${url}`);
      }
    }
  }
  const cc = obj.cfrCitations;
  if (!Array.isArray(cc)) {
    errors.push(`row[${index}]: cfrCitations must be an array, got ${typeof cc}`);
  } else if (cc.length < 1) {
    errors.push(`row[${index}]: cfrCitations must have >= 1 entry, got 0`);
  } else {
    for (let j = 0; j < cc.length; j++) {
      if (typeof cc[j] !== 'string' || cc[j].trim().length < 5) {
        errors.push(`row[${index}].cfrCitations[${j}]: must be a non-trivial string, got ${JSON.stringify(cc[j])}`);
      }
    }
  }
  return errors;
}

async function verifyPmidTitle(pmid: string, expectedTitle: string, label: string): Promise<string[]> {
  const errors: string[] = [];
  const esummaryUrl = `${EUTILS_ESUMMARY}?db=pubmed&id=${pmid}&retmode=json`;
  let esummaryResp: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      esummaryResp = await fetch(esummaryUrl, { signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      if (attempt < 2) { await delay(2000 * (attempt + 1)); continue; }
      return [`${label} (PMID ${pmid}): fetch failed — ${e instanceof Error ? e.message : String(e)}`];
    }
    if (esummaryResp.ok) break;
    if (esummaryResp.status === 429 && attempt < 2) { await delay(4000 * (attempt + 1)); continue; }
    return [`${label} (PMID ${pmid}): esummary HTTP ${esummaryResp.status}`];
  }
  if (!esummaryResp) {
    return [`${label} (PMID ${pmid}): esummary retry loop returned no response`];
  }
  let esummaryJson: unknown;
  try {
    esummaryJson = await esummaryResp.json();
  } catch {
    return [`${label} (PMID ${pmid}): esummary response not valid JSON`];
  }
  const result = esummaryJson as Record<string, unknown> | null;
  const resultObj = result?.result as Record<string, unknown> | null;
  const pmidEntry = resultObj?.[pmid] as Record<string, unknown> | null;
  const liveTitle = (pmidEntry?.title as string | undefined) ?? '';
  const normalize = (s: string) => s.replace(/\.$/, '').replace(/\s*-\s*/g, '-').trim().toLowerCase();
  if (normalize(liveTitle) !== normalize(expectedTitle)) {
    // Try a looser match: the live title may have a non-breaking space or missing space around a hyphen
    const looseNormalize = (s: string) => s.replace(/\.$/, '').replace(/\s*[-\u2010-\u2015]\s*/g, '-').trim().toLowerCase();
    if (looseNormalize(liveTitle) !== looseNormalize(expectedTitle)) {
      errors.push(`${label} (PMID ${pmid}): title mismatch — expected "${expectedTitle}", NCBI esummary returns "${liveTitle}"`);
    }
  }
  const efetchUrl = `${EUTILS_EFETCH}?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`;
  let efetchResp: Response;
  try {
    efetchResp = await fetch(efetchUrl, { signal: AbortSignal.timeout(30_000) });
  } catch {
    return errors;
  }
  if (!efetchResp.ok) return errors;
  const efetchText = await efetchResp.text();
  if (!efetchText.includes(pmid)) {
    errors.push(`${label} (PMID ${pmid}): efetch response does not contain the PMID`);
  }
  return errors;
}

function discoverPacketFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(DOCS_DIR)) {
    if (entry.startsWith('crg-secondary-nexus-expansion-') && entry.endsWith('.json')) {
      files.push(join(DOCS_DIR, entry));
    }
  }
  return files.sort();
}

describe('nexus-expansion artifact validation', () => {
  const artifactFiles = discoverPacketFiles();

  it('discovers nexus-expansion artifacts in docs/', () => {
    expect(artifactFiles.length).toBeGreaterThan(0);
    for (const f of artifactFiles) {
      console.log(`  artifact: ${f.replace(process.cwd() + '/', '')}`);
    }
  });

  for (const filePath of artifactFiles) {
    const fileName = filePath.replace(DOCS_DIR + '/', '');

    it(`${fileName}: parses as JSON with trailing newline`, async () => {
      const raw = readFileSync(filePath, 'utf8');
      expect(raw).toMatch(/\n$/);
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it(`${fileName}: every row matches the 8-key packet shape`, async () => {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown[];
      const allErrors: string[] = [];
      for (let i = 0; i < parsed.length; i++) {
        allErrors.push(...validatePacketShape(parsed[i], i));
      }
      expect(allErrors).toEqual([]);
    });

    it(`${fileName}: every PMID resolves live against NCBI esummary with matching title`, async () => {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      const expectations: Array<{ pmid: string; expectedTitle: string; label: string }> = [];
      for (let i = 0; i < parsed.length; i++) {
        const me = (parsed[i].medicalEvidence as Array<Record<string, unknown>>) ?? [];
        for (let j = 0; j < me.length; j++) {
          const url = me[j].url as string | undefined;
          const title = me[j].title as string | undefined;
          const pmid = extractPmid(url ?? '');
          if (!pmid) continue;
          if (expectations.some(e => e.pmid === pmid)) continue;
          expectations.push({ pmid, expectedTitle: title ?? '', label: `row${i + 1} evidence[${j + 1}]` });
        }
      }
      expect(expectations.length).toBeGreaterThan(0);
      const CONCURRENCY = 3;
      let idx = 0;
      const allErrors: string[] = [];
      while (idx < expectations.length) {
        const batch = expectations.slice(idx, idx + CONCURRENCY);
        const results = await Promise.all(batch.map(e => verifyPmidTitle(e.pmid, e.expectedTitle, e.label)));
        for (const r of results) allErrors.push(...r);
        idx += CONCURRENCY;
        if (idx < expectations.length) await delay(2500);
      }
      if (allErrors.length > 0) {
        console.log(`PMID verification failures for ${fileName}:`);
        for (const e of allErrors) console.log(`  - ${e}`);
      }
      expect(allErrors).toEqual([]);
    }, 120_000);

    it(`${fileName}: no duplicate PMIDs across all evidence`, async () => {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const me = (parsed[i].medicalEvidence as Array<Record<string, unknown>>) ?? [];
        for (let j = 0; j < me.length; j++) {
          const pmid = extractPmid((me[j].url as string) ?? '');
          if (!pmid) continue;
          if (seen.has(pmid)) dupes.push(`PMID ${pmid} duplicate in row ${i + 1} evidence[${j + 1}]`);
          seen.add(pmid);
        }
      }
      expect(dupes).toEqual([]);
    });

    it(`${fileName}: etiologicalMechanism is >= 1500 chars in every row`, async () => {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      for (let i = 0; i < parsed.length; i++) {
        const em = parsed[i].etiologicalMechanism as string;
        expect(typeof em).toBe('string');
        expect(em.trim().length).toBeGreaterThanOrEqual(1500);
      }
    });
  }
});
