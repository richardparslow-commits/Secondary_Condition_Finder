import { describe, it, expect } from 'vitest';
import { MEDICAL_DISCLAIMER, NEVER_DIAGNOSTIC_NOTICE, validateGuardrails } from '../src/lib/guardrails';
import fs from 'fs';
import path from 'path';

describe('Phase 1 Guardrails & Regression Suite', () => {
  it('enforces centralized legal and medical disclaimer copy', () => {
    expect(MEDICAL_DISCLAIMER).toContain('Educational guidance tool only');
    expect(NEVER_DIAGNOSTIC_NOTICE).toContain('never diagnostic');
  });

  it('detects and blocks forbidden diagnostic or guarantee phrases', () => {
    const badCopy = "Based on your records, you have been diagnosed with PTSD and a guaranteed VA rating.";
    const check = validateGuardrails(badCopy);
    expect(check.isValid).toBe(false);
    expect(check.violations.length).toBeGreaterThan(0);
  });

  it('allows safe educational copy', () => {
    const safeCopy = "This platform is an informational estimate only and is never diagnostic.";
    const check = validateGuardrails(safeCopy);
    expect(check.isValid).toBe(true);
  });

  it('preserves data architecture separation between catalog, secondary, and presumptive routes', () => {
    const srcDir = path.join(process.cwd(), 'src', 'app');
    const hasCatalog = fs.existsSync(path.join(srcDir, 'scenarios')) || fs.existsSync(path.join(srcDir, 'results'));
    const hasSecondary = fs.existsSync(path.join(srcDir, 'secondary'));
    const hasPresumptive = fs.existsSync(path.join(srcDir, 'presumptive'));

    expect(hasCatalog).toBe(true);
    expect(hasSecondary).toBe(true);
    expect(hasPresumptive).toBe(true);
  });
});
