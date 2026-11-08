import { configuredPrivacyContact } from "./contact-config.mjs";

/**
 * Privacy-request intake vocabulary (R-01 / VA Lighthouse blocker B-02).
 *
 * The policy's commitment is a deletion right completed within 45 days plus a
 * monitored contact channel; publishing that promise with no way to *receive* a
 * request is worse than the original omission. This module owns the intake half:
 * the request types a visitor can start, the monitored address, and the exact
 * message each type pre-composes.
 *
 * The intake is deliberately **not** a server submission. Every value here
 * feeds a `mailto:` link that the visitor's own mail client opens, so no request
 * content — and none of the identifiers needed to answer one — is ever sent to
 * this application. Two consequences are the point:
 *
 *   1. The PHI-free Server Action boundary
 *      (`src/lib/security/phi-free-action-input.ts`) stays intact instead of
 *      being carved open for an intake. It refuses `email`, `name`, `phone`,
 *      `address` and every other direct identifier as action *input*, and
 *      `tests/phi-logging-boundary.test.ts` enforces that for every action
 *      module — so a server-side intake that stored a reply address would have
 *      required weakening a boundary that exists to keep health context out of
 *      the server. It also means the promise on this page is honest: the
 *      application cannot receive the request because it has nowhere to put it.
 *   2. There is no application-side mail queue or request store. An operator
 *      must configure a monitored mailbox; unconfigured pages do not publish
 *      dead mailto links or claim that requests can be received.
 *
 * The monitored mailbox is the channel of record. This module never invents a
 * second one, and `tests/privacy-request-intake.test.ts` pins the address, the
 * 45-day commitment, the statutory exceptions, and the absence of placeholder
 * text.
 */

/**
 * Historical address retained for the dated delivery finding. It is not a
 * fallback for publication: the operator must configure an approved mailbox.
 */
export const PRIVACY_CONTACT_EMAIL = "privacy@secondaryconditionfinder.org";
export { configuredPrivacyContact };

/** Where the policy sends a visitor who wants to start a request. */
export const PRIVACY_INTAKE_PATH = "/privacy/request";

/**
 * The completion commitment, stated once here so the page and every composed
 * message cannot drift apart. The policy states the same number in prose.
 */
export const PRIVACY_COMPLETION_DAYS = 45;

/** The request types a visitor can start from the intake page. */
export const PRIVACY_REQUEST_TYPES = [
  "deletion",
  "access",
  "correction",
  "question",
] as const;

export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export interface PrivacyRequestDefinition {
  type: PrivacyRequestType;
  /** Link label shown to the visitor. */
  label: string;
  /** One line explaining what the request asks for. */
  summary: string;
  /** The request line the composed message states. */
  requestLine: string;
  /** The `mailto:` subject line. */
  subject: string;
}

export const PRIVACY_REQUESTS: readonly PrivacyRequestDefinition[] = [
  {
    type: "deletion",
    label: "Request deletion",
    summary:
      "Ask us to delete the account-associated data this application holds about you.",
    requestLine:
      "Deletion of the account-associated data this application holds about me.",
    subject: "Privacy request: deletion of account-associated data",
  },
  {
    type: "access",
    label: "Request access",
    summary: "Ask what data this application holds about your use of it.",
    requestLine:
      "Access to the categories of data this application holds about my use of it.",
    subject: "Privacy request: access to data held about me",
  },
  {
    type: "correction",
    label: "Request a correction",
    summary: "Ask us to correct a factual error in data you supplied.",
    requestLine: "Correction of a factual error in data I supplied.",
    subject: "Privacy request: correction of data I supplied",
  },
  {
    type: "question",
    label: "Ask a privacy question",
    summary: "Ask about this policy, retention, or the browser-local records.",
    requestLine: "An answer to a privacy question about this application.",
    subject: "Privacy question",
  },
];

function definitionFor(type: PrivacyRequestType): PrivacyRequestDefinition {
  const definition = PRIVACY_REQUESTS.find((candidate) => candidate.type === type);
  if (!definition) throw new Error(`Unknown privacy request type: ${type}`);
  return definition;
}

/**
 * The message body for one request type.
 *
 * It states the request, the 45-day commitment, and the partial-handling
 * promise, and it names the one thing the requester must supply themselves.
 * That split is deliberate: the identifying details are typed in the
 * requester's own mail client, never here.
 */
export function privacyRequestMessage(type: PrivacyRequestType): string {
  const definition = definitionFor(type);
  return [
    "Hello,",
    "",
    "I am using Secondary Condition Finder and I want to exercise a privacy right.",
    "",
    `Request: ${definition.requestLine}`,
    "",
    `Please treat this message as my request. I understand a verified request is completed within ${PRIVACY_COMPLETION_DAYS} days of receiving it, and that if some records cannot be deleted you will tell me what was retained and why. If you need to verify my identity, tell me what is required.`,
    "",
    "Details you may need in order to act on this request — replace the line below with your own details:",
    "",
    "  [your name, the email address the reply should go to, and any connected-account information you can give]",
    "",
    "Please do not include a Social Security number, a claim number, or medical records — this request does not need them.",
    "",
    "Please reply with an acknowledgement, and with a completion confirmation when the request is finished.",
    "",
    "Thank you.",
  ].join("\n");
}

/** Subject plus body as one copyable block, for a mail client that will not open. */
export function privacyRequestPlainText(type: PrivacyRequestType): string {
  return `Subject: ${definitionFor(type).subject}\n\n${privacyRequestMessage(type)}`;
}

/**
 * The `mailto:` URL that opens the visitor's own mail client with the request
 * already composed. Built here rather than inline in the component so the URL
 * shape (subject and body percent-encoded, monitored address as the only
 * recipient) is pinned by a test instead of by reading JSX.
 */
export function privacyRequestMailto(type: PrivacyRequestType, address: string | null = configuredPrivacyContact()): string {
  if (!address || configuredPrivacyContact({ PRIVACY_CONTACT_EMAIL: address }) !== address) {
    throw new Error("A valid privacy contact must be configured before composing a request");
  }
  const definition = definitionFor(type);
  const query = new URLSearchParams({
    subject: definition.subject,
    body: privacyRequestMessage(type),
  });
  // URLSearchParams encodes spaces as "+", which mail clients render literally.
  return `mailto:${address}?${query.toString().replace(/\+/g, "%20")}`;
}
