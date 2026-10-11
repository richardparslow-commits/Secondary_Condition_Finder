"use client";

import { useState } from "react";

// Keep client boundary clean — no @/lib/kb/schema import (server-only per composition audit).
// Shape mirrors SourceReference fields actually rendered here.
type SourceReferenceView = {
  citation: string;
  note: string;
  verificationScope?: string;
  authorityCategory?: string;
  propositionRole?: string;
  federalRegisterType?: string;
  bindingStatus?: string;
  effectiveDate?: string;
  applicability?: string;
  ruleVersion?: string;
  sourceUrl?: string;
  verified?: boolean;
  sourceCheckedOn?: string;
  sourceLocator?: string;
};

interface CitationDeepDiveExplorerProps {
  sourceReferences: SourceReferenceView[];
  conditionName?: string;
}

const ROLE_LABEL: Record<string, string> = {
  "legal-framework": "Legal framework",
  "clinical-evidence": "Clinical evidence",
  "procedural-guidance": "Procedural guidance",
  "legal-presumption": "Legal presumption",
  "regulatory-history": "Regulatory history",
  "effective-date-applicability": "Effective date / applicability",
  "rating-criteria": "Rating criteria",
  "clinical-evidence-proposition": "Clinical evidence",
  "individual-fact": "Individual fact",
};

const AUTHORITY_LABEL: Record<string, string> = {
  "statutory-authority": "Statutory authority (U.S.C.)",
  "current-regulatory-authority": "Current regulatory authority (CFR/eCFR)",
  "federal-register-final-rule": "Federal Register — final rule",
  "federal-register-proposed-or-notice": "Federal Register — proposed rule / notice",
  "va-adjudication-guidance": "VA adjudication guidance (M21-1/WARMS)",
  "medical-scientific-evidence": "Medical / scientific evidence",
  "individual-evidence": "Individual evidence",
};

function trustCopy(reference: SourceReferenceView): { label: string; tone: string; detail: string } {
  if (reference.verified) {
    return {
      label: "Verified",
      tone: "bg-emerald-100 text-emerald-900 border-emerald-200",
      detail: `Verified on ${reference.sourceCheckedOn ?? "—"} via ${reference.sourceLocator ?? "locator not listed"}. Verified sources were confirmed by qualified human review; they are still research starting points.`,
    };
  }
  return {
    label: "Unverified — confirm before relying",
    tone: "bg-amber-100 text-amber-900 border-amber-200",
    detail:
      "Unverified. This citation is a research starting point only — confirm the current source text, applicability, and that you have the correct edition/date before relying on it for a claim.",
  };
}

export function CitationDeepDiveExplorer({ sourceReferences, conditionName }: CitationDeepDiveExplorerProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (sourceReferences.length === 0) return null;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard may be unavailable in insecure context; ignore
    }
  };

  return (
    <section
      aria-label={conditionName ? `Sources for ${conditionName}` : "Sources supporting the mapped relationship(s)"}
      className="mt-4"
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Sources supporting the mapped relationship(s) — deep dive
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Each citation is shown with its full provenance (source role, authority type, locator, applicability, and
        verification status). This is research provenance, not proof of causation or eligibility.
      </p>

      <ul className="mt-3 space-y-3">
        {sourceReferences.map((reference, index) => {
          const trust = trustCopy(reference);
          const isExpanded = expanded === index;
          const propositionRole = reference.propositionRole ?? reference.verificationScope;
          const authority = reference.authorityCategory;
          return (
            <li
              key={`${reference.citation}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : index)}
                  aria-expanded={isExpanded}
                  aria-controls={`citation-deep-dive-${index}`}
                  className="text-left"
                >
                  <span className="font-mono text-xs font-semibold text-slate-900">{reference.citation}</span>
                  <span className="ml-2 inline-flex flex-wrap gap-1.5 align-middle">
                    {propositionRole && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                        {ROLE_LABEL[propositionRole] ?? propositionRole}
                      </span>
                    )}
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${trust.tone}`}>{trust.label}</span>
                    {reference.bindingStatus && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-900">{reference.bindingStatus}</span>
                    )}
                  </span>
                  <span className="ml-2 text-xs font-medium text-blue-700 underline">{isExpanded ? "Hide details" : "Show details"}</span>
                </button>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(reference.citation, `cit-${index}`)}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                    aria-label={`Copy citation ${reference.citation}`}
                  >
                    {copied === `cit-${index}` ? "Copied" : "Copy citation"}
                  </button>
                  {reference.sourceLocator && (
                    <button
                      type="button"
                      onClick={() => copy(reference.sourceLocator!, `loc-${index}`)}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                      aria-label={`Copy source locator for ${reference.citation}`}
                    >
                      {copied === `loc-${index}` ? "Copied" : "Copy locator"}
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-slate-700">{reference.note}</p>

              <p className={`mt-2 rounded-lg border px-2.5 py-2 text-xs leading-relaxed ${trust.tone}`}>{trust.detail}</p>

              {isExpanded && (
                <div
                  id={`citation-deep-dive-${index}`}
                  className="mt-3 space-y-3 border-t border-slate-100 pt-3"
                >
                  <dl className="grid gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <dt className="font-semibold text-slate-900">Authority category</dt>
                      <dd className="mt-1 text-slate-700">
                        {authority ? AUTHORITY_LABEL[authority] ?? authority : "Not explicitly authored — inferred from source text/URL at review time"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <dt className="font-semibold text-slate-900">Proposition role</dt>
                      <dd className="mt-1 text-slate-700">
                        {reference.propositionRole
                          ? ROLE_LABEL[reference.propositionRole] ?? reference.propositionRole
                          : reference.verificationScope
                            ? ROLE_LABEL[reference.verificationScope] ?? reference.verificationScope
                            : "Not specified"}
                      </dd>
                    </div>
                    {reference.federalRegisterType && (
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <dt className="font-semibold text-slate-900">Federal Register type</dt>
                        <dd className="mt-1 text-slate-700">{reference.federalRegisterType}</dd>
                      </div>
                    )}
                    {reference.effectiveDate && (
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <dt className="font-semibold text-slate-900">Effective date</dt>
                        <dd className="mt-1 text-slate-700">{reference.effectiveDate}</dd>
                      </div>
                    )}
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <dt className="font-semibold text-slate-900">Source URL</dt>
                      <dd className="mt-1 break-all">
                        {reference.sourceUrl ? (
                          <a
                            href={reference.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 underline"
                          >
                            {reference.sourceUrl}
                          </a>
                        ) : (
                          <span className="text-muted">No canonical URL provided — verify via the citation text.</span>
                        )}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <dt className="font-semibold text-slate-900">Source locator</dt>
                      <dd className="mt-1 font-mono text-slate-700">{reference.sourceLocator ?? "—"}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <dt className="font-semibold text-slate-900">Source checked on</dt>
                      <dd className="mt-1 text-slate-700">{reference.sourceCheckedOn ?? "—"}</dd>
                    </div>
                    {reference.ruleVersion && (
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <dt className="font-semibold text-slate-900">Rule version</dt>
                        <dd className="mt-1 text-slate-700">{reference.ruleVersion}</dd>
                      </div>
                    )}
                    {reference.applicability && (
                      <div className="sm:col-span-2 rounded-lg bg-blue-50 p-2.5">
                        <dt className="font-semibold text-blue-950">Applicability</dt>
                        <dd className="mt-1 leading-relaxed text-blue-950">{reference.applicability}</dd>
                      </div>
                    )}
                  </dl>

                  {sourceReferences.length > 1 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <p className="text-xs font-semibold text-slate-900">Related citations in this recommendation</p>
                      <ul className="mt-1.5 list-disc pl-5 text-xs text-slate-700">
                        {sourceReferences
                          .filter((_, siblingIndex) => siblingIndex !== index)
                          .map((sibling) => (
                            <li key={sibling.citation}>
                              <span className="font-mono">{sibling.citation}</span>
                              <span className="text-muted"> — {sibling.note.slice(0, 120)}{sibling.note.length > 120 ? "…" : ""}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-muted">
                    How to use this: Check that the source URL still resolves, that the “checked on” date is recent,
                    and that any applicability/effective-date note matches your claim date. When a Federal Register
                    source is shown, a final rule is binding guidance; a proposed rule or notice is history only. A
                    legal or procedural source does not by itself prove a medical nexus — that requires medical
                    evidence.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Citations are research starting points to verify. An “unverified” badge does not mean the source is wrong —
        it means a qualified human has not yet confirmed this exact locator and scope.
      </p>
    </section>
  );
}
