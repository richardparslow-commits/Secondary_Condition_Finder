import React from "react";

interface DataProvenanceProps {
  status: "published" | "draft" | "unmapped";
  conditionName: string;
}

export const DataProvenanceBadge: React.FC<DataProvenanceProps> = ({ status, conditionName }) => {
  if (status === "published") {
    return (
      <div className="p-3 my-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
        <span className="font-semibold">Source Provenance:</span> Local Knowledge Base (Published & Research-Ready)
        <p className="text-xs text-blue-700 mt-1">
          Citations ship with <code className="bg-blue-100 px-1 py-0.5 rounded">verified: false</code> requiring formal human review.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 my-3 bg-amber-50 border border-amber-300 rounded-md text-sm text-amber-900">
      <div className="flex items-center gap-2 font-semibold text-amber-950">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>
        Recognized Condition — Secondary Mapping Research in Progress
      </div>
      <p className="mt-1 text-xs text-amber-800 leading-relaxed">
        <strong>{conditionName}</strong> exists in the VASRD catalog, but authored secondary mappings are currently in draft status. 
        Absence of published mappings in this research tool does <em>not</em> imply that a secondary connection under 38 CFR 3.310 is impossible.
      </p>
    </div>
  );
};
