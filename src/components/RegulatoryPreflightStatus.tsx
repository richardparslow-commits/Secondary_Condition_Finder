import type {
  RegulatoryPreflightChange,
  RegulatoryPreflightSnapshot,
} from "@/lib/regulatory/preflight";

const statusCopy = (snapshot: RegulatoryPreflightSnapshot) => {
  if (snapshot.freshness === "current") {
    return {
      title: "Regulatory sources checked",
      summary: "Federal Register and OIRA/Reginfo checks completed for this review snapshot.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    };
  }
  if (snapshot.freshness === "degraded") {
    return {
      title: "Regulatory check degraded",
      summary: snapshot.reviewMode === "medical-only"
        ? "A current-law verification gap was detected. Medical relationship review can continue, but legal/regulatory conclusions are disabled."
        : "A required live source was unavailable, so this review is using a recent verified regulatory snapshot with a visible warning.",
      className: "border-amber-200 bg-amber-50 text-amber-950",
    };
  }
  return {
    title: "Regulatory sources stale",
    summary: "No sufficiently recent verified regulatory snapshot is available. Medical relationship review can continue, but current-law/regulatory conclusions are disabled.",
    className: "border-rose-200 bg-rose-50 text-rose-950",
  };
};

const changeLabel = (change: RegulatoryPreflightChange): string => {
  if (change.classification === "current-law-change") return "Current-law change";
  if (change.classification === "pending-regulatory-change") return "Pending regulatory change";
  return "Regulatory-development signal";
};

export function RegulatoryPreflightStatus({
  snapshot,
  changes,
}: {
  snapshot: RegulatoryPreflightSnapshot;
  changes: RegulatoryPreflightChange[];
}) {
  const copy = statusCopy(snapshot);
  const sourceSummary = snapshot.sourceResults
    .filter((source) => source.status !== "skipped")
    .map((source) => `${source.source}: ${source.status}`)
    .join(" • ");

  return (
    <section className={`mb-5 rounded-xl border p-4 text-sm ${copy.className}`} aria-label="Regulatory preflight status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{copy.title}</h2>
          <p className="mt-1">{copy.summary}</p>
        </div>
        <span className="rounded-lg border border-current/20 px-2.5 py-1 text-xs font-semibold">
          Snapshot {snapshot.asOfDate}
        </span>
      </div>
      <p className="mt-2 text-xs opacity-80">{sourceSummary || "Live-source checks did not return a normal source summary."}</p>
      {changes.length > 0 && (
        <div className="mt-3 border-t border-current/15 pt-3">
          <p className="font-semibold">Regulatory activity relevant to this review</p>
          <ul className="mt-2 space-y-2">
            {changes.slice(0, 5).map((change) => (
              <li key={change.id}>
                <strong>{changeLabel(change)}:</strong> {change.title}
                <span className="block text-xs opacity-80">{change.reason}</span>
              </li>
            ))}
          </ul>
          {changes.length > 5 && <p className="mt-2 text-xs">{changes.length - 5} additional regulatory item(s) are retained in this review snapshot.</p>}
        </div>
      )}
      {!snapshot.legalRegulatoryConclusionsAllowed && (
        <p className="mt-3 border-t border-current/15 pt-3 font-semibold">
          Current-law/regulatory conclusions are disabled for this snapshot; clinical relationship research remains available.
        </p>
      )}
    </section>
  );
}
