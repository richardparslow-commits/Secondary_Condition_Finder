import React from 'react';

interface CoverageNoticeProps {
  conditionName: string;
  isUnmapped?: boolean;
}

export function CoverageNotice({ conditionName, isUnmapped = false }: CoverageNoticeProps) {
  if (!isUnmapped) return null;

  return (
    <div 
      className="p-4 my-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 shadow-sm"
      role="region"
      aria-label="Coverage Notice"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-amber-800">Recognized Condition ({conditionName}) — Expanding Knowledge Base</h3>
          <p className="mt-1 text-sm text-amber-700">
            This condition is officially recognized in our medical catalog, but detailed secondary mapping rules are currently in development. A missing pre-authored mapping does not rule out the possibility of a valid secondary or aggravated service connection supported by an independent medical opinion (IMO).
          </p>
        </div>
      </div>
    </div>
  );
}
