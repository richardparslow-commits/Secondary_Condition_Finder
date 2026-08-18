import { regulatoryActionRegistrySchema, type RegulatoryAction, type FederalRegisterDocument } from "../schema";
import type {
  AgendaDiscovery,
  FederalRegisterDiscovery,
  OiraMeetingDiscovery,
  OiraReviewDiscovery,
  RegulationsGovDocketDiscovery,
} from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cfrKey = (reference: RegulatoryAction["cfrReferences"][number]): string =>
  `${reference.title}:${reference.part ?? ""}:${reference.section ?? ""}:${reference.text ?? ""}`;

const mergeUnique = <T>(existing: T[], incoming: T[], key: (value: T) => string): T[] => {
  const map = new Map(existing.map((value) => [key(value), value] as const));
  for (const value of incoming) map.set(key(value), value);
  return [...map.values()];
};

const ensureAction = (
  map: Map<string, RegulatoryAction>,
  input: { rin: string; title?: string; agencyDepartment?: string; agencySubagency?: string },
): RegulatoryAction => {
  const existing = map.get(input.rin);
  if (existing) {
    if (existing.title.startsWith("Regulatory action ") && input.title) existing.title = input.title;
    if (!existing.agency.subagency && input.agencySubagency) existing.agency.subagency = input.agencySubagency;
    return existing;
  }
  const action: RegulatoryAction = {
    rin: input.rin,
    title: input.title ?? `Regulatory action ${input.rin}`,
    agency: {
      department: input.agencyDepartment ?? "Department of Veterans Affairs",
      subagency: input.agencySubagency,
    },
    relatedRins: [],
    cfrReferences: [],
    legalAuthorities: [],
    agenda: [],
    oiraReviews: [],
    oiraMeetingAvailability: "unknown",
    oiraMeetings: [],
    federalRegisterDocuments: [],
  };
  map.set(input.rin, action);
  return action;
};

export function mergeCuratedAndCachedRegistry(
  curated: RegulatoryAction[],
  cached: RegulatoryAction[] | undefined,
): RegulatoryAction[] {
  if (!cached?.length) return regulatoryActionRegistrySchema.parse(clone(curated));
  const map = new Map(cached.map((action) => [action.rin, clone(action)] as const));
  for (const curatedAction of curated) {
    const cachedAction = map.get(curatedAction.rin);
    if (!cachedAction) {
      map.set(curatedAction.rin, clone(curatedAction));
      continue;
    }
    cachedAction.title = curatedAction.title;
    cachedAction.agency = clone(curatedAction.agency);
    cachedAction.relatedRins = [...new Set([...cachedAction.relatedRins, ...curatedAction.relatedRins])];
    cachedAction.cfrReferences = mergeUnique(cachedAction.cfrReferences, curatedAction.cfrReferences, cfrKey);
    cachedAction.legalAuthorities = [...new Set([...cachedAction.legalAuthorities, ...curatedAction.legalAuthorities])];
    cachedAction.agenda = mergeUnique(cachedAction.agenda, curatedAction.agenda, (status) => `${status.publicationId}:${status.edition}`);
    cachedAction.oiraReviews = mergeUnique(cachedAction.oiraReviews, curatedAction.oiraReviews, (review) => review.reviewId);
    cachedAction.oiraMeetings = mergeUnique(cachedAction.oiraMeetings, curatedAction.oiraMeetings, (meeting) => meeting.meetingId);
    cachedAction.federalRegisterDocuments = mergeUnique(cachedAction.federalRegisterDocuments, curatedAction.federalRegisterDocuments, (document) => document.documentNumber);
    cachedAction.oiraMeetingAvailability = curatedAction.oiraMeetingAvailability !== "unknown"
      ? curatedAction.oiraMeetingAvailability
      : cachedAction.oiraMeetingAvailability;
    cachedAction.impact = curatedAction.impact ?? cachedAction.impact;
    cachedAction.manualLifecycleOverride = curatedAction.manualLifecycleOverride ?? cachedAction.manualLifecycleOverride;
    cachedAction.sourceCheckedOn = [cachedAction.sourceCheckedOn, curatedAction.sourceCheckedOn].filter(Boolean).sort().at(-1);
  }
  return regulatoryActionRegistrySchema.parse([...map.values()].sort((a, b) => a.rin.localeCompare(b.rin)));
}

export function mergeRegulatoryDiscoveries(options: {
  baseRegistry: RegulatoryAction[];
  federalRegister: FederalRegisterDiscovery[];
  agenda: AgendaDiscovery[];
  oiraReviews: OiraReviewDiscovery[];
  oiraMeetings: OiraMeetingDiscovery[];
  dockets: RegulationsGovDocketDiscovery[];
  checkedOn: string;
}): RegulatoryAction[] {
  const map = new Map(options.baseRegistry.map((action) => [action.rin, clone(action)] as const));

  for (const discovery of options.federalRegister) {
    const document = discovery.normalizedDocument;
    const rin = document?.rin ?? discovery.rin;
    if (!document || !rin) continue;
    const action = ensureAction(map, { rin, title: discovery.title });
    action.federalRegisterDocuments = mergeUnique(action.federalRegisterDocuments, [document], (value) => value.documentNumber);
    action.relatedRins = [...new Set([...action.relatedRins, ...document.relatedRins.filter((value) => value !== rin)])];
    action.cfrReferences = mergeUnique(action.cfrReferences, document.cfrReferences, cfrKey);
    action.sourceCheckedOn = options.checkedOn;
  }

  for (const discovery of options.agenda) {
    const action = ensureAction(map, {
      rin: discovery.rin,
      title: discovery.title,
      agencyDepartment: discovery.agencyDepartment,
      agencySubagency: discovery.agencySubagency,
    });
    action.agenda = mergeUnique(action.agenda, [discovery.status], (value) => `${value.publicationId}:${value.edition}`);
    action.sourceCheckedOn = options.checkedOn;
  }

  for (const discovery of options.oiraReviews) {
    const action = ensureAction(map, {
      rin: discovery.rin,
      title: discovery.title,
      agencyDepartment: discovery.agencyDepartment,
      agencySubagency: discovery.agencySubagency,
    });
    action.oiraReviews = mergeUnique(action.oiraReviews, [discovery.review], (value) => value.reviewId);
    action.sourceCheckedOn = options.checkedOn;
  }

  for (const discovery of options.oiraMeetings) {
    const action = ensureAction(map, { rin: discovery.rin, title: discovery.title });
    action.oiraMeetings = mergeUnique(action.oiraMeetings, [discovery.meeting], (value) => value.meetingId);
    action.oiraMeetingAvailability = action.oiraMeetings.length > 0 ? "available" : action.oiraMeetingAvailability;
    action.sourceCheckedOn = options.checkedOn;
  }

  const docketById = new Map(options.dockets.map((docket) => [docket.docketId, docket] as const));
  for (const action of map.values()) {
    action.federalRegisterDocuments = action.federalRegisterDocuments.map((document): FederalRegisterDocument => {
      const docket = document.docketIds.map((id) => docketById.get(id)).find(Boolean);
      if (!docket) return document;
      return {
        ...document,
        publicParticipation: {
          docketIds: document.publicParticipation?.docketIds ?? document.docketIds,
          regulationsGovUrl: docket.sourceUrl,
          commentOpenOn: document.publicParticipation?.commentOpenOn,
          commentCloseOn: document.publicParticipation?.commentCloseOn,
          commentStatus: document.publicParticipation?.commentStatus ?? "unknown",
          commentInstructions: document.publicParticipation?.commentInstructions,
        },
      };
    });
  }

  return regulatoryActionRegistrySchema.parse([...map.values()].sort((a, b) => a.rin.localeCompare(b.rin)));
}
