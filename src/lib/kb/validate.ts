import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import { FORBIDDEN_PHRASES } from "@/lib/guardrails";

import type { KbNodeMapping, KnowledgeBase } from "./schema";

/**
 * Quarantined pointer identities (mapping id → canonical id) declared by the
 * machine-readable `quarantine` marker. A pointer preserves a stable ID and
 * its variant name after canonical-identity reconciliation; claims are
 * authored under the canonical identity, never under the pointer.
 */
function quarantinedPointers(kb: KnowledgeBase): Map<string, string> {
  const pointers = new Map<string, string>();
  for (const mapping of kb) {
    if (mapping.quarantine?.status === "pointer") {
      pointers.set(mapping.id, mapping.quarantine.canonicalId);
    }
  }
  return pointers;
}

/**
 * Fails fast when mappings drift from the catalog.
 *
 * Tests enforce the same invariant, but this guards every runtime path that
 * loads the knowledge base.
 *
 * Fail-closed quarantine guard (canonical-identity reconciliation): a
 * quarantined pointer record must never author suggestions itself, and no
 * mapping may file a suggestion under a pointer ID — every claim belongs to
 * the pointer's canonical identity. Pointer chains and unknown canonical
 * targets are refused as well, so a mis-edited marker cannot silently reopen
 * authoring under a retired identity.
 */
export function validateKnowledgeBaseAgainstCatalog(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
): void {
  const byId = indexById(catalog);

  for (const mapping of kb) {
    if (!byId.has(mapping.id)) {
      throw new Error(
        `Mapping "${mapping.id}" has no matching condition in data/conditions.`,
      );
    }

    for (const suggestion of mapping.suggestions) {
      if (!byId.has(suggestion.conditionId)) {
        throw new Error(
          `Mapping "${mapping.id}" suggests unknown condition "${suggestion.conditionId}".`,
        );
      }
    }
  }

  // Fail-closed quarantine guard: a pointer identity is not an authoring home.
  const pointers = quarantinedPointers(kb);
  for (const mapping of kb) {
    if (mapping.quarantine?.status === "pointer" && mapping.suggestions.length > 0) {
      throw new Error(
        `Quarantined pointer "${mapping.id}" authors suggestions; claims must be filed under its canonical identity "${mapping.quarantine.canonicalId}".`,
      );
    }
  }
  for (const [pointerId, canonicalId] of pointers) {
    if (canonicalId === pointerId) {
      throw new Error(
        `Quarantined pointer "${pointerId}" names itself as canonical; claims have no authoring home.`,
      );
    }
    if (!byId.has(canonicalId)) {
      throw new Error(
        `Quarantined pointer "${pointerId}" names canonical identity "${canonicalId}" which has no matching condition in data/conditions.`,
      );
    }
    if (pointers.has(canonicalId)) {
      throw new Error(
        `Quarantined pointer "${pointerId}" points at quarantined pointer "${canonicalId}"; pointer chains are refused.`,
      );
    }
  }
  if (pointers.size > 0) {
    for (const mapping of kb) {
      for (const suggestion of mapping.suggestions) {
        const canonicalId = pointers.get(suggestion.conditionId);
        if (canonicalId) {
          throw new Error(
            `Mapping "${mapping.id}" files a claim under quarantined pointer identity "${suggestion.conditionId}"; author it under the canonical identity "${canonicalId}".`,
          );
        }
      }
    }
  }
}

/**
 * Fail-closed quarantine guard for adjacency-graph nodes: a pointer identity
 * must never own an adjacency node, and no edge may target one — otherwise a
 * multi-hop claim could be filed under a record that exists only to preserve
 * a retired ID. Called by the graph loader (`graph.ts`) after schema parsing,
 * so a pointer node cannot reach the pathway generator.
 */
export function assertNoQuarantinedPointerGraphNodes(
  kb: KnowledgeBase,
  nodes: readonly KbNodeMapping[],
): void {
  const pointers = quarantinedPointers(kb);
  if (pointers.size === 0) return;

  for (const node of nodes) {
    const canonicalId = pointers.get(node.nodeId);
    if (canonicalId) {
      throw new Error(
        `[kb-graph] Node "${node.nodeId}" is a quarantined pointer identity; adjacency nodes may only be authored under its canonical identity "${canonicalId}".`,
      );
    }
    for (const edge of node.outgoingEdges) {
      const target = pointers.get(edge.targetConditionId);
      if (target) {
        throw new Error(
          `[kb-graph] Edge "${node.nodeId}" -> "${edge.targetConditionId}" files a claim under quarantined pointer identity "${edge.targetConditionId}"; author it under the canonical identity "${target}".`,
        );
      }
    }
  }
}

/**
 * Fail-closed copy guardrail: authored knowledge-base text must never contain
 * diagnostic or guarantee phrasing (e.g., "guaranteed VA rating"). Tests
 * enforce the same invariant over rendered pages; this guards the authored
 * data itself on every runtime path that loads the knowledge base.
 */
export function assertNoForbiddenPhrases(kb: KnowledgeBase): void {
  const violations: string[] = [];

  for (const mapping of kb) {
    for (const suggestion of mapping.suggestions) {
      const fields: Array<[string, string]> = [
        ["rationale", suggestion.rationale],
        ["evidenceGaps", suggestion.evidenceGaps.join(" ")],
      ];
      for (const phrase of FORBIDDEN_PHRASES) {
        const lower = phrase.toLowerCase();
        for (const [field, text] of fields) {
          if (text.toLowerCase().includes(lower)) {
            violations.push(
              `${mapping.id} -> ${suggestion.conditionId}: ${field} contains forbidden phrase "${phrase}".`,
            );
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Forbidden legal/medical phrasing in knowledge base:\n${violations.join("\n")}`,
    );
  }
}
