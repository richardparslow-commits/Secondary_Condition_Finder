export function CausedByExplainer() {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 font-medium">Three Required Elements:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Medical diagnosis of current condition</li>
          <li>Statement showing the current condition is caused by a service-connected disability (nexus)</li>
          <li>Medical evidence showing the condition is related to the current disease or injury</li>
        </ul>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 font-medium">Common Causal Pathways:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Biomechanical pathway:</strong> Compensatory injuries from service-connected disability</li>
          <li><strong>Medication side effects:</strong> Adverse reactions to prescribed treatment</li>
          <li><strong>Intermediate conditions:</strong> One condition leads to another</li>
        </ul>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 font-medium">Key Legal Precedents:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><em>Spicer v. Derwinski</em>, 1 Vet. App. 511 (1991) - Proximately due to or the result of standard</li>
          <li><em>Roper v. Shinseki</em>, 592 F.3d 166 (Fed. Cir. 2010) - Medical apportionment rejected</li>
          <li><em>Ellington v. Derwinski</em> / <em>Manzanares v. Brown</em> - Nexus to current disease or injury standard</li>
        </ul>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
        <p className="font-medium">Presumptive Secondary Note:</p>
        <p>Some conditions have presumptive service connection. This Caused By track applies when your condition is secondary to a disability you already have service-connected for.</p>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 font-medium">How to Prepare Your Claim:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Get a medical nexus opinion from a qualified physician connecting your current condition to your service-connected disability</li>
          <li>Gather any service treatment records (STRs) showing your service-connected disability</li>
          <li>Collect post-service medical records showing the progression of the current condition</li>
          <li>Prepare a timeline of events showing when the current condition was diagnosed and how it relates to your service-connected disability</li>
        </ol>
      </div>
    </div>
  );
}
