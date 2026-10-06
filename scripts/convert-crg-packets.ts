#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  conditionMappingSchema,
  etiologicalConsensusSchema,
  KbNodeMappingSchema,
  mechanismCategorySchema,
  nexusClassificationSchema,
  suggestionSchema,
  vaNexusProbabilityAlignmentSchema,
  type ConditionMapping,
  type KbNodeMapping,
  type Suggestion,
} from "../src/lib/kb/schema.ts";
import { CRG_PACKET_PLAN, type PacketRowPlan } from "./lib/crg-packet-plan.ts";

const evidenceSchema = z.object({
  title: z.string().trim().min(1),
  authors: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  url: z.string().regex(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/[1-9]\d*\/$/),
}).strict();

export const flatPacketRowSchema = z.object({
  secondaryCondition: z.string().trim().min(1),
  secondaryDiagnosticCode: z.string().trim().min(1),
  primaryCondition: z.string().trim().min(1),
  primaryDiagnosticCode: z.string().trim().min(1),
  nexusTheory: z.enum(["Causation", "Aggravation", "Medication Side Effect"]),
  etiologicalMechanism: z.string().min(50),
  medicalEvidence: z.array(evidenceSchema).length(3),
  cfrCitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

// Pin clinical labels to both catalog IDs independently of the editable row plan.
// Digests are SHA-256(JSON.stringify([host, target, primaryCondition, secondaryCondition])).
// A label or identity change requires explicit review and a new binding; never derive
// these pins from the current packets at runtime, which would accept reordered rows.
const PACKET_IDENTITY_BINDINGS: Record<string, string> = {
  "traumatic-brain-injury-residuals->post-traumatic-headache": "210aab78506f49abe9f6d804343a01f54abc674ce1ccc920b4aebbfe5bfe117d",
  "diabetes-mellitus-type-2->peripheral-neuropathy": "b6a8ad90d6f087da3c0039ea1bd57e7cf4e9ae92ef8a5fed36976a444d00a736",
  "rheumatoid-arthritis->cataracts": "59cd8bd5ac9c44e54617bfa9a2ca71a452506c963d3d39638292e69f24bea778",
  "traumatic-brain-injury-residuals->vestibular-disorder": "902e831e71edba0ee8b2b60e8960c56ac7e92ca33a41fe0b7f44380b420b48ae",
  "traumatic-brain-injury-residuals->hypopituitarism": "668af6bf5e7c1fe3fc53ee3d0a7580c6981976e37f2b3c5543a2d397b053c139",
  "tinnitus->migraine-headaches": "92622d63190bbfcf098e42df2509baf8f3f2901a7dc3cef321b881d419299f39",
  "osteoarthritis->gerd": "e81faeff4da6875f35d8c3f0af752ee0e147141c7cf4882e252e7dd2f3630b91",
  "traumatic-brain-injury-residuals->seizure-disorder": "7b00ab9813fe87905860057c6dbefabaecc6a56242a5aca5b81b2f96c4b8029c",
  "traumatic-brain-injury-residuals->dementia": "9b8d1b516e5cc141bfedde7d7c6e411340ed736505666bd5bf3505aef0df0a8c",
  "depressive-disorder->anorgasmia": "6b988fd48cfdfb30c33cc3e6553518468f9bc92a7fb2188dcb4d861ef9f0cde6",
  "diabetes-mellitus-type-2->hepatic-steatosis": "35372e630f6cb9c101bdba8a2387712c5f52ef75d2a529c015b79f389400265a",
  "rheumatoid-arthritis->osteopenia": "1abce93c125963e9e75ee7418123a58b3722063878157cf9e9f8fce1c2d9a06d",
  "hypothyroidism->carpal-tunnel-syndrome": "87b1b52b8ff4a5bd6760cea02d7b570833f3bb2a2e89eae27a312a87b1f6378b",
  "degenerative-disc-disease->hypogonadism": "ce9ea5bc242366a971897d732e566e7b2799029596bfb1a4f97aa1eb89720bdc",
  "traumatic-brain-injury-residuals->insomnia": "d3b316ba3951f4ddb0000504ccaa426d89a842ad20d9c20a4710593b2850b665",
  "asthma->avascular-necrosis": "346edc5656237b4b817718f40cc31576e30a785e63365e21cc5ed33a8d9ad658",
  "diabetes-mellitus-type-2->diabetic-gastroparesis": "d105430f7b09f81cd6ed0fbedf5cfb66be9dac84b22206f2110bb68543474403",
  "hypothyroidism->sleep-apnea": "ea85858fabdf85986140df80c9d3bc613d43ad453ab27d8fc7e211558cf32303",
  "osteoarthritis->peptic-ulcer-disease": "2b9168b803e4f2262b776c47264d573c638af63ff8b4e2c1df56d6786968e7dc",
  "rheumatoid-arthritis->glaucoma": "537c7f2e511f0f5ec9dc1d53406830bcc788c3ff4b7e069d50e55c2b29d12c98",
  "gerd->barretts-esophagus": "c494a8c3710c6d96789da9aea32fc0f2970091d7b270b09ee621f3aae2b7b042",
  "alcohol-use-disorder->peripheral-neuropathy": "f4b01cf58e62d0bc693c05fe217b6b480c6843017cd5105b920402699efa2d1c",
  "diabetes-mellitus-type-2->diabetic-nephropathy": "932773b31174a41d25ca360c1da2599fb14ace84d2b79d54553d996bec82ce7f",
  "hypertension->hypertensive-retinopathy": "9ed3bfbd6be6c6357cf720e868f23e3b7dd8f2ce02edbe47b762bcdc8d68801f",
  "hypertension->gout": "7fe8588269398bfcc2e5828d752f103711ae6450cf7892de3135ab37f035b1d6",
  "degenerative-disc-disease->radiculopathy-sciatic": "898dbb00fe662ab1ca280f29b8972bbc9b5b7c7ac8ad09dfdd4fb819272afc86",
  "degenerative-disc-disease->radiculopathy-upper-extremity": "cbab416e881512f04e8379280beba15a73cfe74d9e6046aa34f8c7c0f16d7c80",
  "gerd->esophageal-stricture": "48c9f417d00c287b76a4ffc3d3f2e4291c00fc3b97e4f4e7dd9f66106123a53d",
  "schizophrenia->drug-induced-parkinsonism": "82f72d9f8d63cb5694a9ec2d68e584323f0bb177515e9fabf17f65aebbb7c8fb",
  "chronic-kidney-disease->restless-leg-syndrome": "e33d726ec4e8dd6d33398b33061363eed081fa6cf7dc11571320ee3f88e4cc78",
  "asthma->oral-candidiasis": "b9b9b08f18dfcc49f28fb32312b97d2ce610463891ef44a1969a3e1ac1f3d1b4",
  "prostatitis->achilles-tendinopathy-rupture": "2f37c9023c17fb950cd2652f95d952978ea1418b385df775f2e86a8f441504b0",
  "testicular-cancer->hearing-loss": "b92a67aa31486dbf019d526d848c63ec2a93cf6889aa8132bf46ce8b8dd690ff",
  "benign-prostatic-hyperplasia->hydronephrosis": "6c45abe30bc4d2c65450761f32ff0ace322187665eb6c7e83224c33a00bfde4e",
  "diabetes-mellitus-type-2->osteomyelitis": "a146d1ad7d59e31000cba2d67ac4b86a00700af7b9acdcf158c3933c3ad294b3",
  "cerebrovascular-accident-stroke-residuals->complex-regional-pain-syndrome": "6e9cdfb887ca8115df2cc5bd47c8890de12300c0a2fa309677f187fb31afd984",
  "rheumatoid-arthritis->addisons-disease": "0c8b6a37895c10f30e14d1bf6baad1f6973aafdca2feb19014cf7277a5de643e",
  "gerd->tardive-dyskinesia": "7abe2ed1958d995e90fb98a218464deee67a4c206a1e08c357ce5b7b43e534eb",
  "oral-cancer->osteonecrosis-of-the-jaw": "e3877550047ba68a2cc7aa005a5443e376f6873176dc3fd27ddbd7bb423f39d4",
  "traumatic-brain-injury-residuals->heterotopic-ossification": "55147e7f42a77bbebba0b8e81e80fa995a4c17dbc10f394179be3f96043debe2",
  "gerd->dental-abrasion-erosion-abfraction": "08d86518755a244028b7f9ff5e4f7df7b58ffadf80d2276dc11f74009c679c1e",
  "copd->stress-urinary-incontinence": "6f117075cbd1e1e29bec94ea4083b63cd1b1b34a3829d7d136c92f9ac78a2251",
  "diabetes-mellitus-type-2->urge-urinary-incontinence": "413c2c0a93622dab0bf728f440038f98e1eae40d9a6cf2e3a6e66fddde359de0",
  "congestive-heart-failure->pleural-effusion": "80f099b3c20a58131f085b9f57a4fddf5b4b29f4ee9bd878e91ddfecde8063b8",
  "diabetes-mellitus-type-2->rotator-cuff-tear": "ac30d0ff676b6e3feb863d77b12282ea1968615baf514cfe23c888f973713668",
  "hypertension->aortic-aneurysm": "a217f01c06c7e4d8b232ee4f52ac9e798a6fdeadd2bff287083643557616e6df",
  "diabetes-mellitus-type-2->trigger-finger": "3ac588aea6847e60ec860fcd78d1494269ce1e4ba4dc53cc61490bd979501a5e",
  "copd->xerostomia": "870b82dacdf35ed0328cc449b66fd2eeab1530cc0bd2aa668b162a64819fac4e",
  "rheumatoid-arthritis->flatfoot": "c765fb0c67ad5b70b84035d3263eb32ed87658609a492a5bf2669358ce7a4cf0",
  "diabetes-mellitus-type-2->femoral-neuropathy": "fb4b5543dcfbbfdd3fea3bfaa041c66401cd129eda9124170e7874e3ebbe1ded",
  "cirrhosis-of-the-liver->cholelithiasis": "4cfbaded9d1a0d8ac6deb3daba1b424c161d2c304d986dd7ba38ab8c01f0873c",
  "hypothyroidism->fibromyalgia": "8c35bb7b9cda243a0211f7a7eb7b65ffd48edb6a1478687437d11d3f67f7d7c2",
  "traumatic-brain-injury-residuals->menieres-disease": "4848469035dad928d4d2aed15f6cad871af0edcbc31efda6851eca884368e194",
  "hyperthyroidism->dry-eye-syndrome": "18b0cbd789ce3439436f1cc28949cd33389e51a2ef7921738bdfd8229470ec36",
  "diabetes-mellitus-type-2->meralgia-paresthetica": "d2dc06bbb47148551bcf33115b9c7b77416706b347690ca431474f3f1b5eb5da",
  "chronic-kidney-disease->osteomalacia": "ac80780318bdd2b0e0e62b1f44b227e63afc359c299bb9d2d8bfc9ccb457a21e",
  "nontoxic-thyroid-enlargement->vocal-cord-paralysis": "9b788783240b8b508a5b7dbfe1c5bf674957dc86c9a54c8fd2fd15a394ecfe6e",
  "prostatitis->tendinopathy": "8ef000537d50e6876f90c5059c756098ade65fe1fd216c2ffc891e3058a49c89",
  "scleroderma->raynauds-syndrome": "778d7e2ba7c6c94f2e14b48c8256f75ff7515a12ea247c355f71ea53049556c7",
  "hypertension->subacute-cutaneous-lupus": "c906d28a45816db7277190bb35c097f6196d3a0ab6257e872d00503dd30c1b8d",
  "hypertension->myositis": "3beccbd42a9d31d034257e6d095c4a50f7729ab79a88582d3622db18d0db5650",
  "diabetes-mellitus-type-2->tarsal-tunnel-syndrome": "3b48e116777c1f9cca3184d9cadc84149dbaa509904b1cd4dbc867b87598d2cd",
  "gout->toxic-epidermal-necrolysis": "58d47b17a706f4a54d7ddc19ff996081ddf24f4746eddb36c18819e5c97f0eb9",
  "cholelithiasis->peritoneal-adhesions": "5d4b0d5ffd4fd68bb71ec1586402de148c9feb8d55b6fcaacd5b973838b6a460",
  "ptsd->takotsubo-cardiomyopathy": "b9a82268c3c8827b4c297417fdccce294cc58eea1264c1423d60869a41ccd373",
};

type FlatRow = z.infer<typeof flatPacketRowSchema>;
export type Projection = {
  mapping: string;
  conditionId: string;
  nexusClassification: z.infer<typeof nexusClassificationSchema>;
  mechanismCategory: z.infer<typeof mechanismCategorySchema>;
  etiologicalConsensus: z.infer<typeof etiologicalConsensusSchema>;
  originalProbability: z.infer<typeof vaNexusProbabilityAlignmentSchema>;
  rawCells: string[];
};

type Hold = { code: string; detail: string };
type Proposal = {
  wave: number;
  row: number;
  primaryId: string;
  secondaryId: string;
  stagedRank: number;
  packet: string;
  validationRecord: string;
  originalRow: FlatRow;
  projection: Projection;
  holds: Hold[];
  graphIncluded: boolean;
};

export const STAGING_NOTICE = "Staging-only research proposal, not a signed medical opinion or publication approval. No patient records were supplied. No individual probability is asserted here. Population associations and mechanism plausibility do not establish an individual nexus.";
const REVIEW_GAP = "Qualified clinical/legal and claim-versus-source review, citation verification, source-status preflight and synchronized registry/graph authoring remain required; no automated verification or publication is performed.";
const INDIVIDUAL_GAP = "Obtain confirmed diagnoses, exposure/onset chronology, objective findings and treatment history; assess competing causes and the individual's evidence before any at least as likely as not conclusion.";
const AGGRAVATION_GAP = "For § 3.310(b), establish a qualifying medical baseline and an actual attributable increase beyond natural progression; no baseline or aggravation increment is fabricated here.";
const RATING_GAP = "Qualified-human review must establish claim-period Part 4 criteria, diagnostic-code applicability, analogous-rating scope where needed, and § 4.14 nonpyramiding.";

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function parseProjection(text: string): Projection[] {
  const sections = text.split(/^## /m).filter((section) => section.startsWith("Schema projection"));
  if (sections.length !== 1) throw new Error("Expected exactly one Schema projection section.");
  const table = sections[0].split("\n").filter((line) => line.startsWith("|"));
  const expected = ["Mapping", "conditionId (secondary)", "nexusClassification", "mechanismCategory", "etiologicalConsensus", "vaNexusProbabilityAlignment"];
  const cells = (line: string) => line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (JSON.stringify(cells(table[0] ?? "")) !== JSON.stringify(expected)) throw new Error("Unexpected projection table header.");
  if (!/^\|\s*---/.test(table[1] ?? "")) throw new Error("Missing projection table separator.");
  if (table.length !== 7) throw new Error("Expected exactly five projection rows.");
  const token = (cell: string) => {
    const match = /^([A-Z_]+)(?:\s+\(.+\))?$/.exec(cell);
    if (!match) throw new Error(`Malformed projection token: ${cell}`);
    return match[1];
  };
  return table.slice(2).map((line) => {
    const c = cells(line);
    if (c.length !== 6 || c.some((cell) => !cell)) throw new Error("Malformed six-column projection row.");
    return {
      mapping: c[0],
      conditionId: z.string().regex(/^[a-z0-9-]+$/).parse(c[1]),
      nexusClassification: nexusClassificationSchema.parse(token(c[2])),
      mechanismCategory: mechanismCategorySchema.parse(token(c[3])),
      etiologicalConsensus: etiologicalConsensusSchema.parse(token(c[4])),
      originalProbability: vaNexusProbabilityAlignmentSchema.parse(token(c[5])),
      rawCells: c,
    };
  });
}

export function convertRow(input: unknown, projection: Projection, plan: PacketRowPlan, rank: number): Suggestion {
  const row = flatPacketRowSchema.parse(input);
  if (projection.conditionId !== plan.target) throw new Error(`Identity plan mismatch: ${projection.conditionId} != ${plan.target}`);
  if (plan.host === plan.target) throw new Error("A proposal cannot target its own primary.");
  const identityDigest = sha256(JSON.stringify([plan.host, plan.target, row.primaryCondition, row.secondaryCondition]));
  if (identityDigest !== PACKET_IDENTITY_BINDINGS[`${plan.host}->${plan.target}`]) throw new Error(`Packet identity binding mismatch: ${plan.host}->${plan.target}`);
  const expectedNexus = row.nexusTheory === "Aggravation" ? "AGGRAVATION" : "DIRECT_CAUSATION";
  if (projection.nexusClassification !== expectedNexus) throw new Error("Packet theory and projected nexus classification disagree.");
  if (row.nexusTheory === "Medication Side Effect" && !["PHARMACOLOGICAL_IATROGENIC", "POST_SURGICAL_OR_TREATMENT"].includes(projection.mechanismCategory)) {
    throw new Error("Medication/treatment theory requires an iatrogenic mechanism category.");
  }
  if (plan.alternatives.length < 2 || new Set(plan.alternatives).size !== plan.alternatives.length) throw new Error("Provide at least two distinct packet-grounded alternative etiologies.");
  if (new Set(row.medicalEvidence.map((evidence) => evidence.url)).size !== 3) throw new Error("Duplicate clinical sources within a proposal.");

  let nexusClaim: Suggestion["nexusClaim"];
  if (expectedNexus === "AGGRAVATION") {
    if (!plan.baselineProgression || !plan.aggravatingFactor) throw new Error("Aggravation requires separately authored baselineProgression and aggravatingFactor.");
    nexusClaim = { nexusClassification: "AGGRAVATION", baselineProgression: plan.baselineProgression, aggravatingFactor: plan.aggravatingFactor };
  } else {
    nexusClaim = { nexusClassification: "DIRECT_CAUSATION", etiologicalTrigger: `Proposed route from ${row.primaryCondition} to ${row.secondaryCondition}; individual attribution is not established.\n\n${row.etiologicalMechanism}` };
  }

  const evidenceGaps = [REVIEW_GAP, INDIVIDUAL_GAP, AGGRAVATION_GAP, RATING_GAP];
  const treatment = row.nexusTheory === "Medication Side Effect" || projection.mechanismCategory === "POST_SURGICAL_OR_TREATMENT";
  if (treatment) evidenceGaps.push("Verify the actual treatment indication linking the exposure to the service-connected primary, agent/procedure, dose/duration where applicable, pre-exposure status and latency; no rechallenge or unsupervised treatment change is recommended.");
  if (projection.originalProbability === "LEGALLY_PRESUMED") evidenceGaps.push("The original projection contains a conditional § 3.310(d) presumption proposal. Confirm the listed phenotype, TBI severity, onset window and regulatory applicability; no individual presumption eligibility is asserted by conversion.");
  const contested = projection.etiologicalConsensus === "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE";
  if (contested) evidenceGaps.push("Contested nexus: retain the packet's direction, confounding and disease-scope limitations; specific DBQ/clinical evidence and at least two competing-etiology assessments are required.");

  const primaryVector = row.etiologicalMechanism.split(/\n\s*\n/)[0];
  return suggestionSchema.parse({
    conditionId: plan.target,
    rank,
    nexusClaim,
    causalMechanism: {
      mechanismCategory: projection.mechanismCategory,
      primaryVector,
      ...(treatment ? { iatrogenicFactor: `Treatment-related proposal; verify the actual indication and exposure described in: ${row.primaryCondition}` } : {}),
      hypothesizedOnly: false,
    },
    evidentiaryProfile: {
      etiologicalConsensus: projection.etiologicalConsensus,
      vaNexusProbabilityAlignment: "NOT_ASSERTED",
      conservativeRationale: `${STAGING_NOTICE} The projected etiological consensus describes the proposed literature-level relationship, not this veteran's probability. Original projection annotations: ${projection.rawCells.slice(2).join("; ")}. Original probability/presumption labels are retained only in provenance; converted probability is NOT_ASSERTED.`,
      evidenceGaps: evidenceGaps.join("\n\n"),
      alternativeEtiologiesToRuleOut: plan.alternatives,
      requiresSpecificDbqEvidence: contested,
    },
    rationale: `${STAGING_NOTICE}\n\nOriginal proposal mechanism (preserved verbatim):\n${row.etiologicalMechanism}\n\nPrimary condition: ${row.primaryCondition}\nPrimary diagnostic-code proposal: ${row.primaryDiagnosticCode}\nSecondary condition: ${row.secondaryCondition}\nSecondary diagnostic-code proposal: ${row.secondaryDiagnosticCode}\nOriginal nexus theory: ${row.nexusTheory}\nCFR citations (preserved in order):\n${JSON.stringify(row.cfrCitations, null, 2)}\n\nLegal boundary: § 3.310(a) concerns proximate causation; § 3.310(b) concerns attributable worsening beyond natural progression against a qualifying baseline. The at least as likely as not standard requires individual evidence and competing causes to be weighed. Apply claim-period rating criteria and § 4.14 nonpyramiding.`,
    claimTheories: [expectedNexus === "AGGRAVATION" ? "secondary-aggravation" : "secondary-causation", ...(projection.originalProbability === "LEGALLY_PRESUMED" ? ["presumptive"] : [])],
    nexusRequirement: projection.originalProbability === "LEGALLY_PRESUMED" ? "theory-dependent" : "individual-medical-opinion",
    pathwayIntelligence: {
      pathways: [expectedNexus === "AGGRAVATION" ? "aggravation" : projection.mechanismCategory === "POST_SURGICAL_OR_TREATMENT" ? "treatment-complication" : row.nexusTheory === "Medication Side Effect" ? "medication-related" : "direct-secondary"],
      developmentQuestions: ["Are both diagnoses confirmed and is the proposed temporal sequence documented?", "Which competing etiologies and packet-specific limitations have been assessed?"],
      issuesToResolve: ["Citation verification and governed publication approval remain open."],
    },
    evidenceGaps,
    sourceReferences: row.medicalEvidence.map((evidence) => ({
      citation: `${evidence.authors}. ${evidence.title} PMID ${evidence.url.split("/").at(-2)}.`,
      note: evidence.summary,
      verificationScope: "clinical-evidence",
      authorityCategory: "medical-scientific-evidence",
      propositionRole: "clinical-evidence",
      sourceUrl: evidence.url,
      verified: false,
    })),
  });
}

function readJsonFiles(dir: string): Array<{ file: string; content: string; value: unknown }> {
  return readdirSync(dir).filter((name) => name.endsWith(".json") && statSync(path.join(dir, name)).isFile()).sort().map((file) => {
    const content = readFileSync(path.join(dir, file), "utf8");
    return { file, content, value: JSON.parse(content) };
  });
}

export function assertAcyclic(nodes: readonly KbNodeMapping[]): void {
  const adjacency = new Map(nodes.map((node) => [node.nodeId, node.outgoingEdges.map((edge) => edge.targetConditionId)]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`Staged graph cycle: ${[...stack.slice(stack.indexOf(id)), id].join(" -> ")}`);
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const target of adjacency.get(id) ?? []) visit(target);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of [...adjacency.keys()].sort()) visit(id);
}

export function buildStaging(root: string = process.cwd()) {
  const inputs: Array<{ path: string; sha256: string }> = [];
  const capture = (relative: string) => {
    const content = readFileSync(path.join(root, relative), "utf8");
    inputs.push({ path: relative, sha256: sha256(content) });
    return content;
  };
  const corpusFiles = readJsonFiles(path.join(root, "data/knowledge-base"));
  const corpus = new Map(corpusFiles.map(({ file, value }) => {
    const mapping = conditionMappingSchema.parse(value);
    if (file !== `${mapping.id}.json`) throw new Error(`KB filename/identity mismatch: ${file}`);
    return [mapping.id, mapping] as const;
  }));
  const catalogFiles = readJsonFiles(path.join(root, "data/conditions"));
  const catalog = new Set(catalogFiles.flatMap(({ value }) => z.object({ conditions: z.array(z.object({ id: z.string() })) }).parse(value).conditions.map((condition) => condition.id)));
  for (const { file, content } of corpusFiles) inputs.push({ path: `data/knowledge-base/${file}`, sha256: sha256(content) });
  for (const { file, content } of catalogFiles) inputs.push({ path: `data/conditions/${file}`, sha256: sha256(content) });
  const sourceRegistry = capture("data/evidence/master-sources.json");
  const relationshipRegistry = capture("data/evidence/master-relationships.json");
  capture("src/lib/kb/schema.ts");
  capture("scripts/lib/crg-packet-plan.ts");
  capture("scripts/convert-crg-packets.ts");
  const mappings = new Map<string, ConditionMapping>();
  const proposals: Proposal[] = [];
  const pairs = new Set<string>();
  const registrySources = z.object({ sources: z.array(z.object({ sourceId: z.string(), pmid: z.string().nullable(), status: z.string() })) }).parse(JSON.parse(sourceRegistry)).sources;
  const registryPmids = new Map(registrySources.filter((source) => source.pmid !== null).map((source) => [source.pmid!, source]));
  const relationshipPmids = new Set(relationshipRegistry.match(/\b\d{6,9}\b/g) ?? []); // Supplemental identifier-level screen, not a source-status verdict.

  for (const [index, plans] of CRG_PACKET_PLAN.entries()) {
    const wave = index + 1;
    if (plans.length !== 5) throw new Error(`Wave ${wave} must have five identity plans.`);
    const packet = `docs/crg-draft-identity-mapping-packet${wave === 1 ? "" : `-wave${wave}`}-2026-10-05.json`;
    const validationRecord = `docs/crg-mapping-validation-2026-10-05${wave === 1 ? "" : `-wave-${wave}`}.md`;
    const rawRows: unknown = JSON.parse(capture(packet));
    // Preserve the unparsed JSON too; Zod's trim transformations must not change provenance.
    const rows = z.array(flatPacketRowSchema).length(5).parse(rawRows);
    const originalRows = z.array(z.unknown()).length(5).parse(rawRows) as FlatRow[];
    const recordText = capture(validationRecord);
    const projections = parseProjection(recordText);
    for (const [rowIndex, row] of rows.entries()) {
      const plan = plans[rowIndex];
      const host = corpus.get(plan.host);
      const target = corpus.get(plan.target);
      if (!host || !target || !catalog.has(plan.host) || !catalog.has(plan.target)) throw new Error(`Unknown catalog/KB identity in wave ${wave}, row ${rowIndex + 1}.`);
      const hostLine = recordText.split("\n").find((line) => line.startsWith(`| ${plan.target} |`) && /Chosen host primary/.test(recordText));
      if (wave >= 8 && (!hostLine || hostLine.split("|").at(-2)?.trim().split(/\s/)[0] !== plan.host)) throw new Error(`Host selection table disagrees with identity plan: wave ${wave}, row ${rowIndex + 1}.`);
      const pair = `${plan.host}->${plan.target}`;
      if (pairs.has(pair)) throw new Error(`Duplicate proposed relationship: ${pair}`);
      pairs.add(pair);
      let mapping = mappings.get(plan.host);
      if (!mapping) {
        mapping = { id: plan.host, draft: true, todo: [REVIEW_GAP, "This file contains staged additions only, not a replacement for the live host. Preserve existing suggestions and publication state; reconcile ranks at landing."], governanceNotes: ["STAGING ONLY. All references remain verified:false. No live KB, graph, registry or publication-state changes are authorized by this artifact."], suggestions: [] };
        mappings.set(plan.host, mapping);
      }
      const rank = mapping.suggestions.length + 1;
      const suggestion = convertRow(originalRows[rowIndex], projections[rowIndex], plan, rank);
      mapping.suggestions.push(suggestion);
      const holds: Hold[] = [{ code: "QUALIFIED_REVIEW_REQUIRED", detail: REVIEW_GAP }];
      if (!host.draft) holds.push({ code: "PUBLISHED_HOST_UNVERIFIED_REFERENCES", detail: "The live host is published; these verified:false additions cannot pass its citation-purity gate. Do not flip its draft state or replace the live file." });
      if (host.suggestions.some((existing) => existing.conditionId === plan.target)) holds.push({ code: "EXISTING_HOST_TARGET", detail: "The live authored host already contains this target; reconciliation is required, not append." });
      if (host.governanceNotes?.length) holds.push({ code: "HOST_GOVERNANCE_REVIEW", detail: "Review the current host governanceNotes; their presence is not automatically cleared or classified as a deferral." });
      if (target.governanceNotes?.length) holds.push({ code: "TARGET_GOVERNANCE_REVIEW", detail: "Review the current target governanceNotes; no governance disposition is overridden." });
      if (!target.draft) holds.push({ code: "TARGET_NOT_DRAFT", detail: "The original draft-target selection requirement was not met for this live identity; preserve that discrepancy for review." });
      const pointer = host.quarantine ?? target.quarantine;
      if (pointer) holds.push({ code: "QUARANTINED_IDENTITY", detail: `No graph inclusion or live claim is permitted for this pointer. Canonical identity is ${pointer.canonicalId}; changing the proposed target requires reviewed scope reconciliation.` });
      const reused = row.medicalEvidence.map((evidence) => evidence.url.split("/").at(-2)!).filter((pmid) => registryPmids.has(pmid) || relationshipPmids.has(pmid));
      if (reused.length) holds.push({ code: "REGISTRY_IDENTIFIER_MATCH", detail: `Identifier-level registry matches require evidence/redundancy and source-status review: ${reused.map((pmid) => `${pmid} (${registryPmids.get(pmid)?.status ?? "relationship-registry match"})`).join(", ")}.` });
      proposals.push({ wave, row: rowIndex + 1, primaryId: plan.host, secondaryId: plan.target, stagedRank: rank, packet, validationRecord, originalRow: originalRows[rowIndex], projection: projections[rowIndex], holds, graphIncluded: !pointer });
    }
  }
  if (proposals.length !== 65) throw new Error("Expected all 65 proposals from 13 waves.");
  const authored = [...mappings.values()].sort((a, b) => a.id.localeCompare(b.id)).map((mapping) => conditionMappingSchema.parse(mapping));
  const graph = authored.map((mapping) => KbNodeMappingSchema.parse({
    nodeId: mapping.id,
    outgoingEdges: mapping.suggestions.filter((suggestion) => proposals.find((proposal) => proposal.primaryId === mapping.id && proposal.secondaryId === suggestion.conditionId)?.graphIncluded).map((suggestion, index) => ({
      sourceConditionId: mapping.id,
      targetConditionId: suggestion.conditionId,
      rank: index + 1,
      nexusClaim: { nexusClassification: suggestion.nexusClaim.nexusClassification },
      causalMechanism: suggestion.causalMechanism,
      evidentiaryProfile: suggestion.evidentiaryProfile,
      rationale: suggestion.nexusClaim.nexusClassification === "AGGRAVATION"
        ? `${suggestion.rationale}\n\nSeparately authored baseline progression (preserved verbatim):\n${suggestion.nexusClaim.baselineProgression}\n\nSeparately authored aggravating factor (preserved verbatim):\n${suggestion.nexusClaim.aggravatingFactor}`
        : suggestion.rationale,
      evidenceGaps: suggestion.evidenceGaps,
    })),
  }));
  assertAcyclic(graph);
  const holdCounts: Record<string, number> = {};
  for (const proposal of proposals) for (const hold of proposal.holds) holdCounts[hold.code] = (holdCounts[hold.code] ?? 0) + 1;
  const clinicalUrls = proposals.flatMap((proposal) => proposal.originalRow.medicalEvidence.map((evidence) => evidence.url));
  return {
    authored,
    graph,
    manifest: {
      formatVersion: 1,
      status: "STAGING_ONLY_NOT_PUBLISHABLE",
      authorityBoundary: STAGING_NOTICE,
      schemaValidation: "All nested suggestions and staging-only host mappings pass the actual strict authored schemas. Catalog/quarantine publication approval is separate; the quarantined proposal is intentionally retained only for review and excluded from the staged graph.",
      counts: { waves: 13, proposals: proposals.length, uniqueSecondaryIds: new Set(proposals.map((proposal) => proposal.secondaryId)).size, hosts: authored.length, clinicalReferenceUses: clinicalUrls.length, uniqueClinicalUrls: new Set(clinicalUrls).size, graphEdges: graph.reduce((sum, node) => sum + node.outgoingEdges.length, 0), publicationReady: 0 },
      probabilityNormalizations: proposals.filter((proposal) => proposal.projection.originalProbability !== "NOT_ASSERTED").map((proposal) => ({ wave: proposal.wave, row: proposal.row, from: proposal.projection.originalProbability, to: "NOT_ASSERTED", reason: "No patient records or individual presumption eligibility were supplied." })),
      holdCounts,
      inputFiles: inputs.sort((a, b) => a.path.localeCompare(b.path)),
      proposals,
    },
  };
}

// Only create a fresh docs/ subdirectory. Resolve its ancestor so symlinked
// paths cannot redirect writes into data/, source files or an existing artifact.
export function assertSafeOutput(root: string, out: string): void {
  const docs = realpathSync(path.join(root, "docs"));
  const resolved = path.resolve(root, out);
  if (existsSync(resolved)) throw new Error("Output must be a new directory; existing artifacts are never overwritten.");
  const relative = path.relative(path.join(root, "docs"), resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new Error("Output must be a new subdirectory under docs/; live corpus writes are refused.");
  let ancestor = path.dirname(resolved);
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const realAncestor = realpathSync(ancestor);
  const realRelative = path.relative(docs, realAncestor);
  if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) throw new Error("Output ancestor escapes docs/ through a symlink.");
}

export function writeStaging(root: string, out: string, result: ReturnType<typeof buildStaging>): void {
  assertSafeOutput(root, out);
  const destination = path.resolve(root, out);
  // Verify the read snapshot before creating anything, including packet/record hashes.
  for (const input of result.manifest.inputFiles) {
    if (sha256(readFileSync(path.join(root, input.path), "utf8")) !== input.sha256) throw new Error(`Input changed during conversion: ${input.path}`);
  }
  mkdirSync(path.join(destination, "graph"), { recursive: true });
  const outputHashes: Array<{ path: string; sha256: string }> = [];
  const write = (relative: string, value: unknown) => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(path.join(destination, relative), content, { flag: "wx" });
    outputHashes.push({ path: relative, sha256: sha256(content) });
  };
  write("authored-mappings.json", result.authored);
  for (const node of result.graph) write(`graph/${node.nodeId}.json`, node);
  write("manifest.json", { ...result.manifest, outputFiles: outputHashes });
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] !== undefined && !args[0].startsWith("--out="))) throw new Error("Usage: node scripts/convert-crg-packets.ts [--out=docs/<new-staging-directory>]");
  const root = process.cwd();
  const out = args[0]?.slice("--out=".length) ?? "docs/crg-staging-2026-10-06";
  assertSafeOutput(root, out);
  const result = buildStaging(root);
  writeStaging(root, out, result);
  console.log(JSON.stringify({ output: out, status: result.manifest.status, ...result.manifest.counts, holdCounts: result.manifest.holdCounts }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(`convert-crg-packets: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
