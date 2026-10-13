import type { EvidenceLimits } from "./limits";

/**
 * Browser-local DD-214 field extraction. No network egress. Only masked SSN leaves this module.
 * Caller must gate submission behind an explicit Veteran verification checkbox.
 */

export interface Dd214Fields {
  /** Normalized service-branch codes when recognized. */
  serviceBranchCodes?: string[];
  /** ISO yyyy-mm-dd or null if not confidently parsed. */
  serviceStart: string | null;
  /** ISO yyyy-mm-dd or null if not confidently parsed. */
  serviceEnd: string | null;
  /** Raw location/assignment strings as read from the form. */
  locations: string[];
  /** Masked SSN preview, e.g. XXX-XX-1234 or XXX-XX-****. Never the full SSN. */
  maskedSsn?: string;
  warnings: string[];
}

export interface Dd214Extraction {
  rawText: string;
  fields: Dd214Fields;
  /** Per-page locator hint for the presumptive adapter (presentation only). */
  locator?: { page?: number };
}

const BRANCH_MAP: Record<string, string> = {
  army: "ARMY",
  navy: "NAVY",
  "air force": "AIR_FORCE",
  "marine corps": "MARINE_CORPS",
  marines: "MARINE_CORPS",
  "coast guard": "COAST_GUARD",
  "space force": "SPACE_FORCE",
};

function maskSsn(value: string): string | undefined {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  const last4 = digits.slice(-4);
  // Always mask to XXX-XX-1234 form; never return the full value.
  return `XXX-XX-${last4}`;
}

/**
 * One SSN shape instead of a list of the layouts we happened to think of
 * (audit A06, preview minimization). Three digits, two digits, four digits
 * separated by **any run of up to three non-digit characters** — hyphen,
 * spaces, dots, underscores, en/em dashes, NBSP, or nothing at all — which is
 * what scanned and OCR'd forms actually produce. The previous pattern list
 * covered only hyphen, space, and bare-digit forms, so `123.45.6789`,
 * `123–45–6789`, and `123_45_6789` survived into the raw preview.
 *
 * The 3-3-4 phone shape stays readable by construction: after a 3-digit group,
 * a separator, and a 2-digit group, a phone's next character is a digit, which
 * neither `[^\d\n]{0,3}` nor the following 4-digit group can consume.
 */
const SSN_SEPARATOR = "[^\\d\\n]{0,3}";
const SSN_PATTERNS = [
  new RegExp(`\\b(\\d{3}${SSN_SEPARATOR}\\d{2}${SSN_SEPARATOR}\\d{4})\\b`, "g"),
];

function extractMaskedSsn(text: string): string | undefined {
  for (const re of SSN_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const raw = m[1] ?? m[0];
      const masked = maskSsn(raw);
      if (masked) return masked;
    }
  }
  return undefined;
}

function extractBranches(text: string): string[] | undefined {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [needle, code] of Object.entries(BRANCH_MAP)) {
    if (lower.includes(needle)) found.push(code);
  }
  if (found.length === 0) return undefined;
  return [...new Set(found)];
}

// Accepts MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, and common DD MMM YYYY variants.
const DATE_REGEXES: RegExp[] = [
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
  /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g,
  /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
  /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/gi,
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

/**
 * Real calendar validation (audit A06). The previous bound was `d <= 31`, so
 * `02/31/2020` was emitted as an ISO-shaped date and only the downstream
 * adapter could object. A date that does not exist is not a date: it is
 * dropped so the Veteran verifies it instead of confirming a value the app
 * invented.
 */
function toIso(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseDates(text: string): string[] {
  const out: string[] = [];
  for (const re of DATE_REGEXES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      let iso: string | null = null;
      if (re.source.includes("\\d{4})-")) {
        // YYYY-MM-DD capture
        iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
      } else if (/jan|feb/i.test(re.source)) {
        const monthMap: Record<string, number> = {
          jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
          jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
        };
        const mon = monthMap[m[2].toLowerCase().slice(0, 3)] ?? 0;
        iso = toIso(Number(m[3]), mon, Number(m[1]));
      } else {
        // MM/DD/YYYY or MM-DD-YYYY
        iso = toIso(Number(m[3]), Number(m[1]), Number(m[2]));
      }
      if (iso) out.push(iso);
    }
  }
  return out;
}

function extractServiceDates(text: string): { start: string | null; end: string | null; warnings: string[] } {
  const warnings: string[] = [];
  // Prefer labeled lines typical of DD-214 boxes 12a/12b or \"Service dates\".
  const labeled = text.match(
    /(?:box\s*12[ab]|service\s*(?:start|end)?\s*date|period\s*of\s*service)[^\n]{0,80}/gi,
  );
  const searchText = labeled ? labeled.join("\n") : text;
  const dates = parseDates(searchText);
  if (dates.length === 0) return { start: null, end: null, warnings };
  // Heuristic: earliest is start, latest is end; warn if ambiguous.
  const sorted = [...new Set(dates)].sort();
  const start = sorted[0] ?? null;
  const end = sorted[sorted.length - 1] ?? null;
  if (sorted.length > 2) warnings.push("Multiple dates detected — verify service start/end against your DD-214.");
  if (start && end && start > end) warnings.push("Detected dates appear out of order — verify service dates.");
  return { start: sorted.length >= 1 ? start : null, end: sorted.length >= 2 ? end : null, warnings };
}

function extractLocations(text: string): string[] {
  // Keep as user-editable strings; do not normalize to catalog values here.
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const candidates: string[] = [];
  for (const line of lines) {
    // \"Station / Location / Organization\" box or explicit \"Location:\" lines often carry a location-ish value.
    if (/station|location|organization|assignment|duty\s*station/i.test(line)) {
      // Take the suffix after a colon or dash as the location string.
      const parts = line.split(/[:\-–—]/);
      const tail = parts[parts.length - 1]?.trim();
      if (tail && tail.length >= 2 && tail.length <= 80) candidates.push(tail);
    }
  }
  // Filter out obvious non-locations (date-like or very short) and dedupe.
  const filtered = candidates.filter((c) => !/^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/.test(c));
  return [...new Set(filtered)].slice(0, 8);
}

function redactSsnFromRaw(text: string): string {
  let out = text;
  for (const re of SSN_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, (m) => {
      const masked = maskSsn(m);
      return masked ?? "XXX-XX-****";
    });
  }
  return out;
}

export function parseDd214Text(
  rawText: string,
  limits: EvidenceLimits,
): Dd214Extraction {
  // A06: honor the caller's character budget instead of a private constant.
  // The analyzer retains `limits.textChars` (500,000 in Standard depth) and the
  // parser used to slice at 200,000 regardless, so a caller that passed a
  // smaller budget (or a larger one) got a different bound than it asked for —
  // silently, and without any disclosure that the tail was never inspected.
  const budget =
    Number.isFinite(limits.textChars) && limits.textChars > 0
      ? Math.floor(limits.textChars)
      : 0;
  const trimmed = rawText.slice(0, budget);
  const branches = extractBranches(trimmed);
  const ssn = extractMaskedSsn(trimmed);
  const { start, end, warnings: dateWarnings } = extractServiceDates(trimmed);
  const locations = extractLocations(trimmed);
  const warnings: string[] = [...dateWarnings];
  if (trimmed.length < rawText.length) {
    warnings.push(
      `Only the first ${trimmed.length.toLocaleString("en-US")} characters were analyzed — verify dates and locations against your DD-214.`,
    );
  }
  if (!ssn) warnings.push("No SSN pattern detected — manual entry preserved.");
  if (!start && !end) warnings.push("Service dates not detected — verify dates/locations before proceeding.");
  if (locations.length === 0) warnings.push("Duty-station/location not detected — verify and edit before matching.");
  // Retain a redacted raw preview for the verification form; never emit full SSN.
  const redacted = redactSsnFromRaw(trimmed);
  return {
    rawText: redacted,
    fields: {
      serviceBranchCodes: branches,
      serviceStart: start,
      serviceEnd: end,
      locations,
      maskedSsn: ssn,
      warnings,
    },
  };
}

/** Shape guard for renderer: ensure no fullSsn/ssn field is ever returned. */
export function assertNoFullSsn(extraction: Dd214Extraction): void {
  const raw: unknown = extraction as unknown;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("fullSsn" in obj || "ssn" in obj) {
      throw new Error("DD-214 extraction must not contain a full SSN field.");
    }
  }
}
