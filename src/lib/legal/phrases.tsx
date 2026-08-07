import React from 'react';

export const SECONDARY_TRACK_OVERVIEW =
  "Use this track when you already have at least one service-connected condition and want to organize other diagnosed conditions that may be relevant.";

export const CAUSED_AGGRAVATED_DISTINCTION =
  "A secondary claim can involve a condition that may have been caused by a service-connected disability, or a condition that already existed but may have been aggravated (made worse beyond normal progression) by it.";

export const TRACK_DISTINCTION_NOTICE =
  "This is separate from presumptive service connection, which is based on qualifying service exposures rather than one condition causing or aggravating another.";

export const PRESUMPTIVE_TRACK_OVERVIEW =
  "Use this track for conditions tied to specific service exposures (e.g., herbicide, radiation, burn pit, cold exposure). VA presumes service connection if you served during a qualifying period and are diagnosed with a recognized condition. No nexus opinion required.";

export const UNVERIFIED_REFERENCE_NOTICE =
  "Citations shown in this app are unverified starting points in Phase 1 and should be confirmed against current VA guidance.";

export const SECONDARY_CONTINUE_CTA = "Click Here to Proceed to Wizard Step 1";
export const PRESUMPTIVE_CONTINUE_CTA = "View Presumptive Conditions";

export const DISCLAIMER_NONDIAGNOSTIC =
  "This tool provides information and educational guidance only and is not diagnostic. It does not provide medical advice, diagnosis, or treatment. Do not rely on this tool for medical decisions.";

// ========== UI Components =========

export const CitationLabel: React.FC<{ citation: string }> = ({ citation }) => {
  return (
    <span className="inline-block px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
      {citation}
    </span>
  );
};

// ========== Secondary Track Explainer Components =========

export const CausedByExplainer: React.FC = () => {
  return (
    <div className="mt-3 space-y-3 text-sm">
      {/* Three Required Elements */}
      <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
        <p className="font-medium mb-2">Three Required Elements:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Medical diagnosis of current condition</li>
          <li>Statement showing the current condition is caused by a service-connected disability (nexus)</li>
          <li>Medical evidence showing the condition is related to the current disease or injury</li>
        </ul>
      </div>

      {/* Common Causal Pathways */}
      <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
        <p className="font-medium mb-2">Common Causal Pathways:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Biomechanical pathway:</strong> Compensatory injuries from service-connected disability</li>
          <li><strong>Medication side effects:</strong> Adverse reactions to prescribed treatment</li>
          <li><strong>Intermediate conditions:</strong> One condition leads to another</li>
        </ul>
      </div>

      {/* Key Legal Precedents */}
      <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
        <p className="font-medium mb-2">Key Legal Precedents:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><em>Spicer v. Derwinski</em>, 1 Vet. App. 511 (1991) - Proximately due to or the result of standard</li>
          <li><em>Roper v. Shinseki</em>, 592 F.3d 166 (Fed. Cir. 2010) - Medical apportionment rejected</li>
          <li><em>Ellington v. Derwinski</em> / <em>Manzanares v. Brown</em> - Nexus to current disease or injury standard</li>
        </ul>
      </div>

      {/* Presumptive Secondary Note */}
      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
        <p className="font-medium">Presumptive Secondary Note:</p>
        <p>Some conditions have presumptive service connection. This Caused By track applies when your condition is secondary to a disability you already have service-connected for.</p>
      </div>

      {/* How to Prepare Your Claim */}
      <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
        <p className="font-medium mb-2">How to Prepare Your Claim:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Get a medical nexus opinion from a qualified physician connecting your current condition to your service-connected disability</li>
          <li>Gather any service treatment records (STRs) showing your service-connected disability</li>
          <li>Collect post-service medical records showing the progression of the current condition</li>
          <li>Prepare a timeline of events showing when the current condition was diagnosed and how it relates to your service-connected disability</li>
        </ol>
      </div>
    </div>
  );
};

// ========== Aggravated By Explainer Component =========

export const AggravatedByExplainer: React.FC = () => {
  return (
    <div className="mt-3 space-y-3 text-sm">
      {/* Legal/Regulatory Basis */}
      <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200">
        <p className="font-medium mb-2">Legal/Regulatory Basis:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><em>Allen v. Brown</em>, 29 Vet. App. 106 (2004) - Presumption of aggravation when worsened beyond normal progression</li>
          <li>38 C.F.R. § 3.310(b) - Governs non-service-connected disabilities that are permanently worsened</li>
        </ul>
      </div>

      {/* Adjudicative Mechanics */}
      <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200">
        <p className="font-medium mb-2">Adjudicative Mechanics:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Baseline evidence:</strong> Evidence showing the condition's status before the service-connected disability was established</li>
          <li><strong>Benefit-of-the-doubt:</strong> Applied when evidence is in relative equipoise</li>
          <li><strong>Medical theory standard:</strong> Any medical theory for causation/aggravation must be accepted or reasonably capable of acceptance</li>
        </ul>
      </div>

      {/* Primary Clinical Pathways */}
      <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200">
        <p className="font-medium mb-2">Primary Clinical Pathways:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Biomechanical:</strong> Joint strain from compensating for another condition</li>
          <li><strong>Metabolic/diabetes:</strong> Hormonal changes affecting insulin regulation</li>
          <li><strong>Mental health/gut:</strong> Post-Traumatic Stress/Psychosomatic effects, P-SPRU</li>
          <li><strong>Medication side effects:</strong> Long-term drug use leading to adverse reactions</li>
          <li><strong>Obesity chain:</strong> Secondary conditions from obesity (osteoarthritis, hypertension, sleep apnea)</li>
        </ul>
      </div>
    </div>
  );
};
