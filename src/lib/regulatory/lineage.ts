import type { RegulatoryAction } from "./schema";

export type RegulatoryLineageNode = {
  id: string;
  kind: "rin" | "federal-register-document" | "agenda-entry" | "oira-review" | "oira-meeting";
  label: string;
};

export type RegulatoryLineageEdge = {
  from: string;
  to: string;
  kind: "related-rin" | "contains" | "corrects" | "supersedes" | "agenda-of" | "review-of" | "meeting-on";
};

export type RegulatoryLineageGraph = {
  nodes: RegulatoryLineageNode[];
  edges: RegulatoryLineageEdge[];
  unresolvedReferences: string[];
};

export const buildRegulatoryLineage = (actions: RegulatoryAction[]): RegulatoryLineageGraph => {
  const nodes = new Map<string, RegulatoryLineageNode>();
  const edges: RegulatoryLineageEdge[] = [];
  const unresolved = new Set<string>();
  const knownRins = new Set(actions.map((action) => action.rin));
  const knownDocuments = new Set(actions.flatMap((action) => action.federalRegisterDocuments.map((document) => document.documentNumber)));

  for (const action of actions) {
    const rinNode = `rin:${action.rin}`;
    nodes.set(rinNode, { id: rinNode, kind: "rin", label: `${action.rin} — ${action.title}` });

    for (const related of action.relatedRins) {
      edges.push({ from: rinNode, to: `rin:${related}`, kind: "related-rin" });
      if (!knownRins.has(related)) unresolved.add(`Related RIN ${related} referenced by ${action.rin} is not present in the registry.`);
    }

    for (const agenda of action.agenda) {
      const id = `agenda:${action.rin}:${agenda.publicationId}`;
      nodes.set(id, { id, kind: "agenda-entry", label: `${agenda.edition} ${agenda.stage}` });
      edges.push({ from: id, to: rinNode, kind: "agenda-of" });
    }

    for (const review of action.oiraReviews) {
      const id = `oira-review:${review.reviewId}`;
      nodes.set(id, { id, kind: "oira-review", label: `${review.stage} ${review.status}` });
      edges.push({ from: id, to: rinNode, kind: "review-of" });
    }

    for (const meeting of action.oiraMeetings) {
      const id = `oira-meeting:${meeting.meetingId}`;
      nodes.set(id, { id, kind: "oira-meeting", label: `${meeting.scheduledOn} ${meeting.status}` });
      edges.push({ from: id, to: rinNode, kind: "meeting-on" });
    }

    for (const document of action.federalRegisterDocuments) {
      const id = `fr:${document.documentNumber}`;
      nodes.set(id, { id, kind: "federal-register-document", label: document.citation ? `${document.citation} — ${document.title}` : document.title });
      edges.push({ from: rinNode, to: id, kind: "contains" });

      for (const corrected of document.correctsDocumentNumbers) {
        edges.push({ from: id, to: `fr:${corrected}`, kind: "corrects" });
        if (!knownDocuments.has(corrected)) unresolved.add(`Correction ${document.documentNumber} references missing Federal Register document ${corrected}.`);
      }
      for (const superseded of document.supersedesDocumentNumbers) {
        edges.push({ from: id, to: `fr:${superseded}`, kind: "supersedes" });
        if (!knownDocuments.has(superseded)) unresolved.add(`Document ${document.documentNumber} supersedes missing Federal Register document ${superseded}.`);
      }
    }
  }

  return { nodes: [...nodes.values()], edges, unresolvedReferences: [...unresolved].sort() };
};
