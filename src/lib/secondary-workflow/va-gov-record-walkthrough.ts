/**
 * Guided VA.gov medical-records download walkthrough (Step 4 research aid).
 *
 * Authored steps mirror the real sign-in and download flow as experienced on
 * VA.gov: ID.me email → ID.me password → MFA event → SMS "continue" → SMS code
 * entry → post-login redirect → My Health → medical records → download tool →
 * date range → record type → file type → "Download report".
 *
 * Boundaries:
 * - The application never collects, transmits, or stores VA.gov or ID.me
 *   credentials, MFA codes, or session data. Every step opens VA.gov in a new
 *   browser tab; the user completes it there.
 * - Step locations are convenience deep links into the VA.gov flow. Signing in
 *   always lands on My VA first; navigating onward from there matches the
 *   described experience. VA.gov may change its flow, MFA method, labels, or
 *   URLs at any time — the component copy states this and never claims to
 *   drive the VA.gov session.
 * - Nothing about the walkthrough is submitted to the server: progress
 *   checkmarks live in tab-scoped session storage via the local-state
 *   registry, and the text export is a browser-only blob download.
 *
 * This is research/records-gathering aid copy only. It is not VA guidance, it
 * does not determine what evidence VA requires, and VA.gov is the authority
 * for its own sign-in and download experience.
 */

export interface VaGovWalkthroughStep {
  /** Stable identifier used as the session-storage checkmark key. */
  id: string;
  /** Short label for the step, e.g. "Sign in — ID.me email". */
  label: string;
  /** Where the step happens (VA.gov page or ID.me page). */
  location: string;
  /** What the user does on that page. */
  detail: string;
  /** Optional VA.gov URL to open for this step (never proxied, never fetched). */
  url?: string;
  /** Optional link text; defaults to a generic "Open on VA.gov". */
  urlLabel?: string;
  /**
   * Optional secondary note for steps with common variations (e.g. MFA
   * methods other than SMS). Rendered as small text, never a new step.
   */
  note?: string;
  /** True for the final step (download), which has no onward link. */
  final?: boolean;
}

export const VA_GOV_WALKTHROUGH_DISCLAIMER =
  "This walkthrough mirrors the VA.gov sign-in and download flow as of the date it was " +
  "authored. VA.gov may change its pages, buttons, labels, or MFA options at any time — " +
  "follow what VA.gov shows. This aid is not VA guidance, does not determine what evidence " +
  "VA requires, and never sees or stores your VA.gov or ID.me credentials, MFA codes, or " +
  "session. Confirm the current process directly on VA.gov.";

export const VA_GOV_WALKTHROUGH_STEPS: readonly VaGovWalkthroughStep[] = [
  {
    id: "sign-in-start",
    label: "Sign in on VA.gov",
    location: "www.va.gov — Sign in modal",
    detail:
      "Go to VA.gov and choose Sign in. Signing in takes you through ID.me, one of VA's " +
      "credential providers. If you are brought to a sign-in modal, continue from there.",
    url: "https://www.va.gov/?next=loginModal&oauth=true",
    urlLabel: "Open VA.gov sign-in",
  },
  {
    id: "idme-email",
    label: "ID.me — email address",
    location: "api.id.me — Sign in",
    detail:
      "On the ID.me sign-in page, enter the email address for your ID.me account and continue.",
  },
  {
    id: "idme-password",
    label: "ID.me — password",
    location: "api.id.me — Authentication options",
    detail: "Enter your ID.me password on the authentication options page and continue.",
  },
  {
    id: "idme-mfa",
    label: "ID.me — multi-factor authentication",
    location: "api.id.me — Multifactor event",
    detail:
      "ID.me asks for multi-factor authentication. If you use text-message (SMS) MFA, choose " +
      "the phone option to continue; other MFA methods follow ID.me's own prompts.",
    note:
      "Set up a different method? If your ID.me account uses an authenticator app, push " +
      "notification, security key/passkey, or PIV/CAC instead of text messages, ID.me shows " +
      "that verification prompt here. The surrounding steps stay the same — verify, then " +
      "continue back to VA.gov.",
  },
  {
    id: "idme-mfa-phone",
    label: "ID.me — send the text code",
    location: "api.id.me — Phone",
    detail:
      "Select Continue to have ID.me text a one-time security code to your phone. Codes are " +
      "sent to the phone number on your ID.me account — the app never receives them.",
  },
  {
    id: "idme-mfa-code",
    label: "ID.me — enter the code",
    location: "api.id.me — Phone code entry",
    detail:
      "Type the code from the text message into ID.me's code-entry page and continue. If the " +
      "code expires, request a new one from ID.me.",
  },
  {
    id: "post-login",
    label: "Back on VA.gov — My VA",
    location: "www.va.gov — My VA",
    detail:
      "After ID.me verifies you, VA.gov returns you to your My VA page, signed in. From here " +
      "you navigate to your health records.",
    url: "https://www.va.gov/my-va/?postLogin=true",
    urlLabel: "Open My VA",
  },
  {
    id: "my-health",
    label: "Open My Health",
    location: "www.va.gov — My Health",
    detail: "From My VA, open the My Health section.",
    url: "https://www.va.gov/my-health",
    urlLabel: "Open My Health",
  },
  {
    id: "medical-records",
    label: "Open Medical records",
    location: "www.va.gov — Medical records",
    detail: "Within My Health, open the Medical records area.",
    url: "https://www.va.gov/my-health/medical-records/",
    urlLabel: "Open Medical records",
  },
  {
    id: "download-tool",
    label: "Open the download tool",
    location: "www.va.gov — Download",
    detail: "Choose Download to start building a records report.",
    url: "https://www.va.gov/my-health/medical-records/download",
    urlLabel: "Open Download",
  },
  {
    id: "date-range",
    label: "Choose date range — All time",
    location: "www.va.gov — Download: date range",
    detail:
      "Select All time for the date range, then press Continue. Pick a narrower range only if " +
      "you specifically want a smaller report.",
    url: "https://www.va.gov/my-health/medical-records/download/date-range",
    urlLabel: "Open date range",
  },
  {
    id: "record-type",
    label: "Choose record type — Select all VA records",
    location: "www.va.gov — Download: record type",
    detail:
      "Select all VA records, then press Continue. This builds the most complete report; " +
      "individual record types can be selected instead if you want a smaller file.",
    url: "https://www.va.gov/my-health/medical-records/download/record-type",
    urlLabel: "Open record type",
  },
  {
    id: "file-type",
    label: "Choose file type — PDF",
    location: "www.va.gov — Download: file type",
    detail: "Select PDF as the file type for the report.",
    url: "https://www.va.gov/my-health/medical-records/download/file-type",
    urlLabel: "Open file type",
  },
  {
    id: "download-report",
    label: "Download report",
    location: "www.va.gov — Download: file type",
    detail:
      "Press Download report. VA.gov generates the PDF and saves it to your computer (by " +
      "default, your Downloads folder or Desktop, depending on your browser). You can then " +
      "add it to the local evidence analyzer on this page — the file is analyzed only in your " +
      "browser and is not uploaded.",
    note:
      "Can't find the file? Check your browser's Downloads (Ctrl+J / ⌘+Shift+J) or your " +
      "Desktop. The report is your property — keep an unedited copy for your own records and " +
      "share it only with people you intend to see it.",
    final: true,
  },
] as const;

/** Formats the walkthrough as a plain-text keepsake for printing or offline use. */
export function formatVaGovRecordWalkthrough(): string {
  const lines: string[] = [];
  lines.push("VA.GOV MEDICAL RECORDS DOWNLOAD WALKTHROUGH");
  lines.push("Guided sign-in and download steps — research aid, not VA guidance");
  lines.push("");
  lines.push(
    "The application never collects or stores your VA.gov or ID.me credentials,",
    "MFA codes, or session data. Each step happens in your own browser on VA.gov.",
  );
  lines.push("");

  let stepNumber = 0;
  for (const step of VA_GOV_WALKTHROUGH_STEPS) {
    stepNumber += 1;
    lines.push(`${stepNumber}. ${step.label}`);
    lines.push(`   Where: ${step.location}`);
    lines.push(`   Do: ${step.detail}`);
    if (step.note) lines.push(`   Note: ${step.note}`);
    if (step.url) lines.push(`   Link: ${step.url}`);
    lines.push("");
  }

  lines.push("DISCLAIMER");
  lines.push(VA_GOV_WALKTHROUGH_DISCLAIMER);
  lines.push("");

  return lines.join("\n");
}
