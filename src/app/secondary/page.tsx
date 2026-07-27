import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { IntakeForm, type IntakeOption } from "@/components/IntakeForm";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { mappedConditionIds } from "@/lib/kb/lookup";

export default function SecondaryIntakePage() {
  const catalog = loadConditionCatalog();
  const mapped = mappedConditionIds(loadKnowledgeBase());

  const options: IntakeOption[] = [...catalog]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((condition) => ({
      id: condition.id,
      name: condition.name,
      bodySystem: condition.bodySystem,
      aliases: condition.aliases,
      hasResearch: mapped.has(condition.id),
    }));

  return (
    <main>
      <Link href="/" className="text-sm underline hover:text-slate-900">
        Back to start
      </Link>

      <header className="mt-3 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Conditions secondary to a service-connected condition
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Explore conditions commonly considered alongside a condition you are
          already service connected for, with the reasoning and the evidence a
          claim would typically need.
        </p>
      </header>

      <div className="mb-8">
        <DisclaimerBanner />
      </div>

      <IntakeForm options={options} />

      <p className="mt-8 text-sm text-slate-600">
        Want to see how it works first?{" "}
        <Link href="/scenarios" className="underline hover:text-slate-900">
          Run a demo scenario
        </Link>
        .
      </p>

      <DisclaimerFooter />
    </main>
  );
}
