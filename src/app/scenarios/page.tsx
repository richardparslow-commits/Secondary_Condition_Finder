import Link from "next/link";

import scenarios from "../../../data/demo-scenarios.json";
import { DisclaimerFooter } from "@/components/Disclaimer";

function toQuery(intake: {
  primaryConditions: string[];
  symptoms: string[];
  medications: string[];
  exposures: string[];
  notes: string;
}): string {
  const params = new URLSearchParams();
  for (const condition of intake.primaryConditions) {
    params.append("primary", condition);
  }
  if (intake.symptoms.length) params.set("symptoms", intake.symptoms.join(","));
  if (intake.medications.length) {
    params.set("medications", intake.medications.join(","));
  }
  if (intake.exposures.length) {
    params.set("exposures", intake.exposures.join(","));
  }
  if (intake.notes) params.set("notes", intake.notes);
  return params.toString();
}

export default function ScenariosPage() {
  return (
    <main>
      <Link href="/" className="text-sm underline hover:text-slate-900">
        Back to start
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Demo scenarios
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Repeatable walkthroughs for demos. Each one runs the same engine as the
        intake form.
      </p>

      <div className="mt-6 space-y-4">
        {scenarios.map((scenario) => (
          <article
            key={scenario.id}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">
              {scenario.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {scenario.description}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Conditions: {scenario.intake.primaryConditions.join(", ")}
            </p>
            <Link
              href={`/results?${toQuery(scenario.intake)}`}
              className="mt-4 inline-block rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Run scenario
            </Link>
          </article>
        ))}
      </div>

      <DisclaimerFooter />
    </main>
  );
}
