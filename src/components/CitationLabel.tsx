type CitationLabelProps = {
  citation: string;
};

export function CitationLabel({ citation }: CitationLabelProps) {
  return (
    <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
      {citation}
    </span>
  );
}
