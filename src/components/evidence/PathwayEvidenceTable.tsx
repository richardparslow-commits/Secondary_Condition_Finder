"use client";

import { useId, useMemo } from "react";

import { COMPOSITE_NEXUS_SUMMARY, NEXUS_CLAIM_LABEL } from "@/lib/evidence/pathway-mapper";

/**
 * PathwayEvidenceTable — per-hop evidence review for multi-hop pathways.
 *
 * ## Multi-hop mapping logic
 *
 * The CRG refactor models a claim as a pathway: a chain of 1–2 hops
 * (Primary → Secondary, or Primary → Secondary → Tertiary). This component
 * iterates the pathway's hops in `stepIndex` order and renders one semantic
 * table group per hop, so the veteran sees exactly which documents speak to
 * which legal link in the chain — a multi-hop claim is only as strong as its
 * weakest hop, so evidence must be reviewable hop by hop.
 *
 * Excerpts arrive from Step 4 browser-local analysis already annotated with
 * the `stepIndex` of the hop they support (`supportedHopIndex`, assigned by
 * `annotateExcerptsWithHopIndex` in the pathway-evidence mapper before this
 * component renders). Filtering is a strict equality join on that annotation:
 * an excerpt appears under exactly one hop section, and a hop with no
 * matching excerpts renders an explicit empty state rather than silently
 * swallowing the gap. Excerpts annotated with a stepIndex outside the
 * pathway's hops are never rendered.
 *
 * ## Client boundary
 *
 * The canonical pathway types live in the server-only knowledge-base layer,
 * so this component consumes the client-safe view-model from
 * `@/lib/engine/pathway-view` (the sanctioned bridge module — it imports no kb
 * runtime and is imported by the server page only to build props). This
 * component strictly renders local browser state — no data fetching of any
 * kind.
 */

import type {
  ClaimPathwayView,
  NexusClassificationView,
  PathwayHopView,
} from "@/lib/engine/pathway-view";
import type { HopAnnotatedExcerpt } from "@/lib/evidence/pathway-mapper";

/** A browser-local excerpt annotated with the pathway hop it supports. */
export type HopEvidenceExcerpt = HopAnnotatedExcerpt;

interface PathwayEvidenceTableProps {
  /** The traversed 1–2 hop pathway being evidenced. */
  pathway: ClaimPathwayView;
  /** Local excerpts (Step 4 sessionStorage payload) mapped to hops upstream. */
  excerpts: readonly HopEvidenceExcerpt[];
  /** Catalog condition ID → display name; missing IDs fall back to the ID. */
  conditionNameById: Readonly<Record<string, string>>;
}

/** Visual identity of the legal nexus badge per hop classification. */
const NEXUS_BADGE: Record<NexusClassificationView, { label: string; className: string }> = {
  DIRECT_CAUSATION: {
    label: "Direct causation",
    className: "border-emerald-300 bg-emerald-100 text-emerald-900",
  },
  AGGRAVATION: {
    label: "Aggravation",
    className: "border-amber-300 bg-amber-100 text-amber-900",
  },
  ASSOCIATION_ONLY: {
    label: "Association only",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

function conditionName(conditionId: string, conditionNameById: Readonly<Record<string, string>>): string {
  return conditionNameById[conditionId] ?? conditionId;
}

function excerptKey(excerpt: HopEvidenceExcerpt, index: number): string {
  return `${excerpt.supportedHopIndex}-${excerpt.locator}-${excerpt.sourceName}-${index}`;
}

export function PathwayEvidenceTable({ pathway, excerpts, conditionNameById }: PathwayEvidenceTableProps) {
  const baseId = useId();

  /** Step indexes covered by this pathway — annotations outside are dropped. */
  const hopStepIndexes = useMemo(() => new Set(pathway.hops.map((hop) => hop.stepIndex)), [pathway.hops]);

  /** Join excerpts to hops once, not once per render of each hop section. */
  const excerptsByHop = useMemo(() => {
    const byHop = new Map<number, HopEvidenceExcerpt[]>();
    for (const excerpt of excerpts) {
      if (!hopStepIndexes.has(excerpt.supportedHopIndex)) continue;
      const bucket = byHop.get(excerpt.supportedHopIndex);
      if (bucket) bucket.push(excerpt);
      else byHop.set(excerpt.supportedHopIndex, [excerpt]);
    }
    return byHop;
  }, [excerpts, hopStepIndexes]);

  return (
    <section className="ui-card mt-5" aria-labelledby={`${baseId}-heading`}>
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">⇄</span>
        <div>
          <h2 id={`${baseId}-heading`} className="text-xl font-bold">
            Evidence by pathway hop
          </h2>
          <p className="text-sm text-slate-600">
            Your browser-local excerpts grouped under the specific hop of the claim pathway they support. Nothing leaves this browser tab.
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">
          {conditionName(pathway.originConditionId, conditionNameById)}
          {" → "}
          {conditionName(pathway.terminalConditionId, conditionNameById)}
        </span>{" "}
        — {COMPOSITE_NEXUS_SUMMARY[pathway.compositeNexus]}
      </p>

      <div className="mt-5 space-y-6">
        {pathway.hops.map((hop) => (
          <HopSection
            key={hop.stepIndex}
            hop={hop}
            hopNumber={hop.stepIndex + 1}
            excerpts={excerptsByHop.get(hop.stepIndex) ?? []}
            conditionNameById={conditionNameById}
            baseId={baseId}
          />
        ))}
      </div>
    </section>
  );
}

interface HopSectionProps {
  hop: PathwayHopView;
  /** 1-based hop number for headings (stepIndex itself is 0-based). */
  hopNumber: number;
  excerpts: readonly HopEvidenceExcerpt[];
  conditionNameById: Readonly<Record<string, string>>;
  baseId: string;
}

/**
 * One hop of the pathway: a titled section ("Hop 1: PTSD → Sleep Apnea") with
 * the hop's legal-nexus badge and a semantic table of the excerpts mapped to
 * this hop's stepIndex — or an explicit empty state when none are mapped.
 */
function HopSection({ hop, hopNumber, excerpts, conditionNameById, baseId }: HopSectionProps) {
  const { edge } = hop;
  const badge = NEXUS_BADGE[edge.nexusClassification];
  const headingId = `${baseId}-hop-${hop.stepIndex}`;
  const sourceName = conditionName(edge.sourceConditionId, conditionNameById);
  const targetName = conditionName(edge.targetConditionId, conditionNameById);

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-lg font-bold text-slate-900">
          Hop {hopNumber}: {sourceName} → {targetName}
        </h3>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">{NEXUS_CLAIM_LABEL[edge.nexusClassification]}</p>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Evidence excerpts supporting hop {hopNumber} ({sourceName} to {targetName})
          </caption>
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Evidence excerpt (exact quote)
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Source
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Classification
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {excerpts.length === 0 ? (
              <tr>
                <td colSpan={3} className="bg-amber-50 px-3 py-4 text-sm text-amber-950">
                  No evidence mapped for this step.
                </td>
              </tr>
            ) : (
              excerpts.map((excerpt, index) => (
                <tr key={excerptKey(excerpt, index)}>
                  <td className="px-3 py-3 align-top">
                    <blockquote className="whitespace-pre-line break-words border-l-4 border-slate-300 pl-3 leading-relaxed text-slate-900">
                      “{excerpt.quote}”
                    </blockquote>
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-slate-700">
                    <span className="block font-semibold text-slate-900">{excerpt.sourceName}</span>
                    <span className="block">{excerpt.locator}</span>
                    <span className="mt-1 inline-block rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-700">
                      {excerpt.clinicianAuthored ? "Clinician-authored" : "Not clinician-authored"}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-slate-700">
                    <span className="block capitalize">{excerpt.category.replace(/-/g, " ")}</span>
                    <span className="mt-1 inline-block rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-700">
                      {excerpt.strength === "nexus-relevant" ? "Nexus-relevant" : "Supporting"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
