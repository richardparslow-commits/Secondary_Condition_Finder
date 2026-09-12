import { z } from "zod";

/**
 * Controlled symptom-research vocabulary. These entries are prompts for a
 * provider discussion only; they are not diagnoses, medical assessments, or
 * secondary-condition mappings.
 */
export const symptomBridgeEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(120),
  aliases: z.array(z.string().min(1).max(120)).max(8),
  discussionConditionIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(5),
  prompt: z.string().min(1).max(500),
}).strict();

export type SymptomBridgeEntry = z.infer<typeof symptomBridgeEntrySchema>;

const SYMPTOM_BRIDGE_ENTRIES: SymptomBridgeEntry[] = [
  {
    id: "distal-numbness-tingling",
    label: "Numbness or tingling in the feet or hands",
    aliases: ["numbness", "tingling", "pins and needles", "paresthesia"],
    discussionConditionIds: ["peripheral-neuropathy"],
    prompt: "Ask a qualified provider whether the reported sensory symptoms warrant evaluation for peripheral neuropathy or another explanation; symptoms alone do not establish a diagnosis.",
  },
  {
    id: "recurrent-headache",
    label: "Recurrent or severe headaches",
    aliases: ["headache", "headaches", "migraine-like headache"],
    discussionConditionIds: ["migraine-headaches", "post-traumatic-headache"],
    prompt: "Discuss headache history, red flags, phenotype, and whether a formal evaluation is appropriate; this prompt does not diagnose migraine or post-traumatic headache.",
  },
  {
    id: "daytime-sleepiness-snoring",
    label: "Loud snoring or daytime sleepiness",
    aliases: ["snoring", "daytime sleepiness", "sleepy during the day"],
    discussionConditionIds: ["sleep-apnea"],
    prompt: "Discuss whether a qualified provider should evaluate sleep-disordered breathing, including whether a sleep study is appropriate; these symptoms do not establish sleep apnea.",
  },
  {
    id: "persistent-low-mood",
    label: "Persistent low mood or loss of interest",
    aliases: ["low mood", "depressed mood", "loss of interest", "anhedonia"],
    discussionConditionIds: ["depressive-disorder"],
    prompt: "Discuss these symptoms with a qualified mental-health professional; they can have many explanations and do not establish depressive disorder.",
  },
  {
    id: "shortness-of-breath",
    label: "Shortness of breath or reduced exercise tolerance",
    aliases: ["shortness of breath", "breathlessness", "dyspnea"],
    discussionConditionIds: ["asthma", "copd", "interstitial-lung-disease"],
    prompt: "Discuss cardiopulmonary evaluation with a qualified provider; shortness of breath is nonspecific and does not identify any particular diagnosis.",
  },
  {
    id: "joint-pain-limited-motion",
    label: "Persistent joint pain or limited movement",
    aliases: ["joint pain", "limited motion", "stiff joint", "stiffness"],
    discussionConditionIds: ["osteoarthritis", "rheumatoid-arthritis"],
    prompt: "Discuss examination and appropriate diagnostic evaluation with a qualified provider; pain or limited movement alone does not establish arthritis.",
  },
  {
    id: "chronic-widespread-pain",
    label: "Chronic widespread pain and fatigue",
    aliases: ["widespread pain", "chronic pain", "pain all over", "fatigue with pain"],
    discussionConditionIds: ["fibromyalgia"],
    prompt: "Discuss widespread pain and fatigue patterns with a qualified provider, including tender-point examination and alternative explanations; these symptoms do not establish fibromyalgia.",
  },
  {
    id: "ringing-in-ears",
    label: "Ringing or buzzing in the ears",
    aliases: ["ringing in ears", "tinnitus", "buzzing in ears", "ear noise"],
    discussionConditionIds: ["tinnitus", "hearing-loss"],
    prompt: "Discuss ear symptoms with a qualified provider, including an audiometric evaluation; ringing or buzzing does not establish tinnitus or hearing loss.",
  },
  {
    id: "heartburn-reflux",
    label: "Heartburn or acid reflux",
    aliases: ["heartburn", "acid reflux", "reflux", "burning in chest after eating"],
    discussionConditionIds: ["gerd", "esophagitis"],
    prompt: "Discuss persistent reflux symptoms with a qualified provider, including whether endoscopic evaluation is appropriate; heartburn does not establish GERD or esophagitis.",
  },
  {
    id: "stomach-pain-ulcers",
    label: "Recurring stomach pain or burning",
    aliases: ["stomach pain", "burning stomach", "stomach ulcers", "indigestion"],
    discussionConditionIds: ["gastritis"],
    prompt: "Discuss recurrent stomach symptoms with a qualified provider, including medication and dietary factors; stomach pain alone does not establish gastritis.",
  },
  {
    id: "bowel-habit-changes",
    label: "Ongoing changes in bowel habits",
    aliases: ["bowel changes", "irritable bowel", "alternating diarrhea and constipation", "bloating with bowel changes"],
    discussionConditionIds: ["irritable-bowel-syndrome"],
    prompt: "Discuss bowel habit changes with a qualified provider, including red-flag screening and differential considerations; these symptoms do not establish irritable bowel syndrome.",
  },
  {
    id: "low-back-pain-stiffness",
    label: "Persistent low back pain or stiffness",
    aliases: ["low back pain", "back stiffness", "back pain down the leg", "lumbar pain"],
    discussionConditionIds: ["lumbar-strain", "lumbar-spinal-stenosis", "intervertebral-disc-syndrome"],
    prompt: "Discuss low back symptoms with a qualified provider, including neurological examination and imaging considerations; back pain alone does not establish any specific spinal diagnosis.",
  },
  {
    id: "neck-pain-numbness",
    label: "Neck pain with hand or arm numbness",
    aliases: ["neck pain", "hand numbness", "arm tingling", "neck stiffness with numbness"],
    discussionConditionIds: ["cervical-strain", "carpal-tunnel-syndrome"],
    prompt: "Discuss neck and upper-extremity symptoms with a qualified provider, including examination to distinguish spine from nerve entrapment; these symptoms do not establish either diagnosis.",
  },
  {
    id: "weight-or-temperature-change",
    label: "Unexplained weight change or temperature intolerance",
    aliases: ["weight change", "heat intolerance", "cold intolerance", "unexplained weight loss"],
    discussionConditionIds: ["hyperthyroidism", "hypothyroidism"],
    prompt: "Discuss weight and temperature-sensitivity changes with a qualified provider, including thyroid function testing; these symptoms do not establish thyroid dysfunction.",
  },
  {
    id: "pelvic-pain",
    label: "Chronic pelvic pain",
    aliases: ["pelvic pain", "lower abdominal pelvic pain"],
    discussionConditionIds: ["chronic-pelvic-pain-syndrome"],
    prompt: "Discuss persistent pelvic pain with a qualified provider, including a differential evaluation; pelvic pain alone does not establish chronic pelvic pain syndrome.",
  },
];

const parsedEntries = SYMPTOM_BRIDGE_ENTRIES.map((entry) => symptomBridgeEntrySchema.parse(entry));

export function listSymptomBridgeEntries(): readonly SymptomBridgeEntry[] {
  return parsedEntries;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function parseSymptomBridgeSelection(values: readonly string[]): string[] {
  const allowed = new Set(parsedEntries.map((entry) => entry.id));
  return [...new Set(values.map((value) => value.trim()).filter((value) => allowed.has(value)))];
}

export interface SymptomDiscussionPrompt {
  symptomId: string;
  symptomLabel: string;
  conditionIds: string[];
  conditionNames: string[];
  prompt: string;
}

export function buildSymptomDiscussionPrompts(
  selectedIds: readonly string[],
  conditionNamesById: ReadonlyMap<string, string>,
): SymptomDiscussionPrompt[] {
  const selected = new Set(parseSymptomBridgeSelection(selectedIds));
  return parsedEntries
    .filter((entry) => selected.has(entry.id))
    .map((entry) => ({
      symptomId: entry.id,
      symptomLabel: entry.label,
      conditionIds: [...entry.discussionConditionIds],
      conditionNames: entry.discussionConditionIds
        .map((id) => conditionNamesById.get(id))
        .filter((name): name is string => Boolean(name)),
      prompt: entry.prompt,
    }));
}

export function findSymptomBridgeMatches(
  values: readonly string[],
): SymptomBridgeEntry[] {
  const normalizedValues = values.map(normalize).filter(Boolean);
  return parsedEntries.filter((entry) => {
    const terms = [entry.label, ...entry.aliases].map(normalize);
    return normalizedValues.some((value) => terms.includes(value));
  });
}
