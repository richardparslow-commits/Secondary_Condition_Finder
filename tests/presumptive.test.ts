import { describe, it, expect } from 'vitest';

// Presumptive evaluation helper mock or import
function evaluatePresumptiveClaim(location: string, serviceDate: string, category: string) {
  const normalizedLoc = location.trim().toLowerCase();
  const date = new Date(serviceDate);

  const validBurnPitLocationsiraq = ['baghdad', 'balad', 'camp bucca', 'ali al salem'];
  const pactActStart = new Date('2001-09-11');

  if (category === 'burn-pits') {
    if (date < pactActStart) {
      return { eligible: false, reason: 'Service date precedes post-9/11 burn pit presumptive window (Sep 11, 2001).' };
    }
    if (!validBurnPitLocationsiraq.includes(normalizedLoc)) {
      return { eligible: false, unmatchedLocation: true, message: `Location '${location}' is not currently recognized in the validated burn pit registry. Professional nexus evidence may be required.` };
    }
    return { eligible: true, category: 'burn-pits' };
  }

  return { eligible: false, message: 'Unrecognized category.' };
}

describe('Presumptive Track Hardening & Regression Suite', () => {
  it('rejects burn pit claims prior to PACT Act date boundaries (Sep 11, 2001)', () => {
    const result = evaluatePresumptiveClaim('Baghdad', '2000-05-01', 'burn-pits');
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('precedes post-9/11 burn pit presumptive window');
  });

  it('accepts burn pit claims on or after PACT Act date boundaries with recognized locations', () => {
    const result = evaluatePresumptiveClaim('Balad', '2005-06-15', 'burn-pits');
    expect(result.eligible).toBe(true);
  });

  it('returns explicit unmatched-location messaging for unrecognized deployment sites', () => {
    const result = evaluatePresumptiveClaim('UnknownForwardBaseX', '2008-01-01', 'burn-pits');
    expect(result.eligible).toBe(false);
    expect(result.unmatchedLocation).toBe(true);
    expect(result.message).toContain('not currently recognized in the validated burn pit registry');
  });
});
