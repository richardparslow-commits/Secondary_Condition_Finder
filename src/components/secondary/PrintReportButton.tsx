"use client";

export function PrintReportButton({ label = "Print research report" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 print:hidden"
      aria-label={label}
    >
      🖨 {label}
    </button>
  );
}
