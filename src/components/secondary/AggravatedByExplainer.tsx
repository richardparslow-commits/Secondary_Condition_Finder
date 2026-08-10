export function AggravatedByExplainer() {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
        <p className="mb-2 font-medium">Legal/Regulatory Basis:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><em>Allen v. Brown</em>, 29 Vet. App. 106 (2004) - Presumption of aggravation when worsened beyond normal progression</li>
          <li>38 C.F.R. § 3.310(b) - Governs non-service-connected disabilities that are permanently worsened</li>
        </ul>
      </div>
      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
        <p className="mb-2 font-medium">Adjudicative Mechanics:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Baseline evidence:</strong> Evidence showing the condition&apos;s status before the service-connected disability was established</li>
          <li><strong>Benefit-of-the-doubt:</strong> Applied when evidence is in relative equipoise</li>
          <li><strong>Medical theory standard:</strong> Any medical theory for causation/aggravation must be accepted or reasonably capable of acceptance</li>
        </ul>
      </div>
      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
        <p className="mb-2 font-medium">Primary Clinical Pathways:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Biomechanical:</strong> Joint strain from compensating for another condition</li>
          <li><strong>Metabolic/diabetes:</strong> Hormonal changes affecting insulin regulation</li>
          <li><strong>Mental health/gut:</strong> Post-Traumatic Stress/Psychosomatic effects, P-SPRU</li>
          <li><strong>Medication side effects:</strong> Long-term drug use leading to adverse reactions</li>
          <li><strong>Obesity chain:</strong> Secondary conditions from obesity (osteoarthritis, hypertension, sleep apnea)</li>
        </ul>
      </div>
    </div>
  );
}
