"use client";

import { useCallback } from "react";

interface PrintReportButtonProps {
  label?: string;
  /**
   * Optional scoped-print contract: a body class applied only for this print
   * job (see the matching `@media print` rules in globals.css). The class is
   * added before window.print() and removed afterwards — including after a
   * canceled dialog — so the full-report print view is never left active.
   */
  printScopeClass?: string;
}

export function PrintReportButton({ label = "Print research report", printScopeClass }: PrintReportButtonProps) {
  const handlePrint = useCallback(() => {
    if (!printScopeClass) {
      window.print();
      return;
    }
    document.body.classList.add(printScopeClass);
    try {
      window.print();
    } finally {
      document.body.classList.remove(printScopeClass);
    }
  }, [printScopeClass]);

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="no-print rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 print:hidden"
      aria-label={label}
    >
      🖨 {label}
    </button>
  );
}
