import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const preflight = require_(
  path.join(process.cwd(), "scripts/preflight-source-status.js"),
) as {
  FLAG_CLASSES: Record<string, string>;
  extractPmid: (ref: { sourceUrl?: string; citation?: string }) => string | null;
  parseEfetchXml: (xml: string) => Map<
    string,
    { pubtypes: string[]; commentsCorrections: { refType: string; refSource: string }[] }
  >;
  classifyRecord: (
    pmid: string,
    esummaryDoc?: { title: string; pubtypes: string[] },
    efetchDoc?: { pubtypes: string[]; commentsCorrections: { refType: string; refSource: string }[] },
  ) => { flags: { flag: string }[]; notes: { note: string }[] };
};

const script = path.join(process.cwd(), "scripts/preflight-source-status.js");

const fixture = {
  esummary: {
    uids: ["10000001", "10000002", "10000003", "10000004", "10000005", "10000006", "10000007"],
    "10000001": { uid: "10000001", title: "A clean cohort study", pubtype: ["Journal Article"] },
    "10000002": {
      uid: "10000002",
      title: "An old osteopenia study",
      pubtype: ["Journal Article", "Retracted Publication"],
    },
    "10000003": { uid: "10000003", title: "A quietly retracted study", pubtype: ["Journal Article"] },
    "10000004": {
      uid: "10000004",
      title: "A questioned study",
      pubtype: ["Journal Article", "Expression of Concern"],
    },
    "10000005": {
      uid: "10000005",
      title: "Something important [Withdrawn]",
      pubtype: ["Journal Article"],
    },
    "10000006": {
      uid: "10000006",
      title: "A corrected study",
      pubtype: ["Journal Article", "Published Erratum"],
    },
    "10000007": { uid: "10000007", title: "A study with a linked erratum", pubtype: ["Journal Article"] },
  },
  efetchXml: `<PubmedArticleSet>
<PubmedArticle><MedlineCitation Status="MEDLINE"><PMID Version="1">10000001</PMID>
<Article><PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList></Article>
</MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation Status="MEDLINE"><PMID Version="1">10000003</PMID>
<Article><PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList></Article>
<CommentsCorrectionsList><CommentsCorrections RefType="RetractionIn"><RefSource>J Irreproducible Results. 2024 Jan;1:1-2</RefSource><PMID Version="1">20000001</PMID></CommentsCorrections></CommentsCorrectionsList>
</MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation Status="MEDLINE"><PMID Version="1">10000007</PMID>
<Article><PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList></Article>
<CommentsCorrectionsList><CommentsCorrections RefType="ErratumIn"><RefSource>J Test. 2025 Jan;2:3</RefSource><PMID Version="1">20000002</PMID></CommentsCorrections></CommentsCorrectionsList>
</MedlineCitation></PubmedArticle>
</PubmedArticleSet>`,
};

const runCli = (...args: string[]) => {
  const fixturePath = path.join(os.tmpdir(), `source-status-preflight-${process.pid}.json`);
  fs.writeFileSync(fixturePath, JSON.stringify(fixture));
  return spawnSync(
    process.execPath,
    [script, "--fixture", fixturePath, "--json", ...args],
    { encoding: "utf8" },
  );
};

describe("source-status preflight", () => {
  it("extracts PMIDs from sourceUrl and citation, and skips non-PubMed refs", () => {
    expect(preflight.extractPmid({ sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37995383/" })).toBe(
      "37995383",
    );
    expect(
      preflight.extractPmid({ citation: "Some J. 2024;1:1-2. PMID 37191605." }),
    ).toBe("37191605");
    expect(
      preflight.extractPmid({
        citation: "38 CFR 4.88b. Rating schedule framework.",
        sourceUrl: "https://www.ecfr.gov/current/title-38",
      }),
    ).toBeNull();
  });

  it("parses publication types and linked notices from efetch XML", () => {
    const parsed = preflight.parseEfetchXml(fixture.efetchXml);
    expect(parsed.get("10000003")?.commentsCorrections).toEqual([
      { refType: "RetractionIn", refSource: "J Irreproducible Results. 2024 Jan;1:1-2" },
    ]);
    expect(parsed.get("10000007")?.pubtypes).toEqual(["Journal Article"]);
  });

  it("classifies retraction, withdrawal, and expression-of-concern signals, keeping errata non-blocking", () => {
    const retracted = preflight.classifyRecord("10000002", {
      title: "An old osteopenia study",
      pubtypes: ["Journal Article", "Retracted Publication"],
    });
    expect(retracted.flags.map(f => f.flag)).toContain(preflight.FLAG_CLASSES.RETRACTED);

    const noticeLinked = preflight.classifyRecord(
      "10000003",
      { title: "A quietly retracted study", pubtypes: ["Journal Article"] },
      {
        pubtypes: ["Journal Article"],
        commentsCorrections: [{ refType: "RetractionIn", refSource: "J X. 2024;1:1" }],
      },
    );
    expect(noticeLinked.flags.map(f => f.flag)).toContain(preflight.FLAG_CLASSES.RETRACTED);

    const withdrawn = preflight.classifyRecord("10000005", {
      title: "Something important [Withdrawn]",
      pubtypes: ["Journal Article"],
    });
    expect(withdrawn.flags.map(f => f.flag)).toContain(preflight.FLAG_CLASSES.WITHDRAWN);

    const eoc = preflight.classifyRecord("10000004", {
      title: "A questioned study",
      pubtypes: ["Journal Article", "Expression of Concern"],
    });
    expect(eoc.flags.map(f => f.flag)).toContain(preflight.FLAG_CLASSES.EXPRESSION_OF_CONCERN);

    const erratum = preflight.classifyRecord(
      "10000007",
      { title: "A study with a linked erratum", pubtypes: ["Journal Article"] },
      {
        pubtypes: ["Journal Article"],
        commentsCorrections: [{ refType: "ErratumIn", refSource: "J Test. 2025;2:3" }],
      },
    );
    expect(erratum.flags).toHaveLength(0);
    expect(erratum.notes.length).toBeGreaterThan(0);
  });

  it("blocks on flagged anchors with non-zero exit and reports each flag class", () => {
    const result = runCli(
      "--pmids",
      "10000001,10000002,10000003,10000004,10000005,10000006,10000007",
    );
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(false);
    const flagged = new Map(report.flags.map((f: { pmid: string; flag: string }) => [f.pmid, f.flag]));
    expect(flagged.get("10000002")).toBe("RETRACTED");
    expect(flagged.get("10000003")).toBe("RETRACTED");
    expect(flagged.get("10000004")).toBe("EXPRESSION_OF_CONCERN");
    expect(flagged.get("10000005")).toBe("WITHDRAWN");
    expect(flagged.has("10000001")).toBe(false);
    expect(flagged.has("10000006")).toBe(false);
  });

  it("passes cleanly on unflagged anchors even when erratum notes exist", () => {
    const result = runCli("--pmids", "10000001,10000006,10000007");
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(true);
    expect(report.flags).toHaveLength(0);
    expect(report.notes.length).toBeGreaterThan(0);
  });

  it("flags PMIDs that do not resolve as UNRESOLVED", () => {
    const result = runCli("--pmids", "99999999");
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.flags[0].flag).toBe("UNRESOLVED");
    expect(report.flags[0].pmid).toBe("99999999");
  });
});
