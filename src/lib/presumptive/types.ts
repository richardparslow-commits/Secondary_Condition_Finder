/**
 * Presumptive Track Audit & Data Schema Types
 */

export interface PresumptiveSourceAudit {
  sourceUrl: string;
  sourceCheckedOn: string; // ISO date string (YYYY-MM-DD)
  auditedBy: string;
  notes?: string;
}

export interface PresumptiveConditionRule {
  id: string;
  conditionName: string;
  category: 'agent-orange' | 'burn-pits' | 'radiation' | 'camp-lejeune' | 'other';
  eligibleEras: {
    startDate: string;
    endDate?: string;
  }[];
  locations: string[];
  audit: PresumptiveSourceAudit;
}
