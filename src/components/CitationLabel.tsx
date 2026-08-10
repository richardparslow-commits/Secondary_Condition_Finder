import React from 'react';

interface CitationLabelProps {
  citation: string;
  className?: string;
}

export function CitationLabel({ citation, className = "" }: CitationLabelProps) {
  return (
    <span className={`font-mono text-xs ${className}`}>
      {citation}
    </span>
  );
}
