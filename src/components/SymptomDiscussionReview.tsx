import type { SymptomDiscussionPrompt } from "@/lib/secondary-workflow/symptom-bridge";

interface Props {
  prompts: SymptomDiscussionPrompt[];
}

export function SymptomDiscussionReview({ prompts }: Props) {
  if (prompts.length === 0) return null;

  return (
    <section className="rounded-lg border border-violet-300 bg-violet-50 p-4" aria-labelledby="symptom-discussion-heading">
      <h3 id="symptom-discussion-heading" className="text-sm font-bold uppercase tracking-wide text-violet-900">
        Symptoms to discuss with a provider
      </h3>
      <p className="mt-2 text-sm text-violet-950">
        These prompts connect selected symptom descriptions to possible conditions to discuss with a qualified provider. They are not diagnoses, do not add conditions to this review, and do not create or change a secondary-condition recommendation.
      </p>
      <div className="mt-3 space-y-3">
        {prompts.map((prompt) => (
          <div key={prompt.symptomId} className="rounded-lg border border-violet-200 bg-white p-3">
            <p className="font-semibold text-violet-950">{prompt.symptomLabel}</p>
            <p className="mt-1 text-sm text-slate-700">
              Possible discussion topics: {prompt.conditionNames.length > 0 ? prompt.conditionNames.join(", ") : "a qualified provider's differential evaluation"}.
            </p>
            <p className="mt-1 text-sm text-slate-700">{prompt.prompt}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
