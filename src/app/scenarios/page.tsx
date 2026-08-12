import Link from "next/link";

import scenarios from "../../../data/demo-scenarios.json";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { ScenarioLaunchForm } from "@/components/ScenarioLaunchForm";

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
        Repeatable synthetic walkthroughs that launch the same privacy-safe
        secondary workflow used by normal intake.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Demo content is synthetic. Launching submits only the scenario identifier;
        scenario workflow state is validated on the server and stored in the
        encrypted short-lived workflow session rather than in the URL.
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
              Diagnosed condition ids: {scenario.workflow.diagnosedConditionIds.join(", ")}
            </p>
            <ScenarioLaunchForm scenarioId={scenario.id} />
          </article>
        ))}
      </div>

      <DisclaimerFooter />
    </main>
  );
}
