import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Knowledge Base Cross-File Integrity & Quality Gates', () => {
  const kbDir = path.join(process.cwd(), 'data', 'knowledge-base');
  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.json'));

  it('validates cross-file invariants, rank continuity, and placeholder limits', () => {
    files.forEach(file => {
      const filePath = path.join(kbDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const conditionId = file.replace('.json', '');

      // If marked as published/non-draft, strictly forbid placeholder strings
      if (data.draft === false) {
        expect(content).not.toContain('TODO');
        expect(content).not.toContain('TBD');
      }

      if (data.suggestions && Array.isArray(data.suggestions)) {
        const seenTargets = new Set();
        
        data.suggestions.forEach((s, idx) => {
          // 1. Non-self reference check
          expect(s.conditionId).not.toBe(conditionId);

          // 2. Rank continuity & gapless sequence check (1, 2, 3...)
          expect(s.rank).toBe(idx + 1);

          // 3. No duplicate suggestion targets across the same condition
          expect(seenTargets.has(s.conditionId)).toBe(false);
          seenTargets.add(s.conditionId);

          // 4. Evidence gap depth check (must provide at least one concrete gap)
          expect(Array.isArray(s.evidenceGaps)).toBe(true);
          expect(s.evidenceGaps.length).toBeGreaterThan(0);

          // 5. Source references citation and unverified flag check
          if (s.sourceReferences && Array.isArray(s.sourceReferences)) {
            s.sourceReferences.forEach(ref => {
              expect(ref.citation).toBeDefined();
              expect(typeof ref.verified).toBe('boolean');
            });
          }
        });
      }
    });
  });
});
