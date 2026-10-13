import type { Metadata } from "next";
import Link from "next/link";

import { PrivacyIntakeLinks } from "@/components/privacy/PrivacyIntakeLinks";
import { PRIVACY_COMPLETION_DAYS } from "@/lib/privacy/intake";

export const metadata: Metadata = {
  title: "Privacy Request | Secondary Condition Finder",
};

/**
 * Privacy-request intake page (R-01 / VA Lighthouse blocker B-02).
 *
 * The deletion right, the 45-day commitment and the monitored address are
 * published in the Privacy Policy (section 8). The policy also says what
 * happens if a request cannot be completed in full. This page is the *intake*
 * half of that promise: the destination the policy points at, where a visitor
 * starts a deletion, access, correction, or question request.
 *
 * It is a static server-rendered page with no form. Everything it can do is
 * prepare a message in the visitor's own mail client — see
 * `src/components/privacy/PrivacyIntakeLinks.tsx` for why that is a design
 * requirement rather than a limitation. Nothing on this page is submitted to
 * the application, so there is no request body, no server record, and no
 * identifier for the application to hold.
 */
export default function PrivacyRequestPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Request a privacy action</h1>
      <p className="text-sm text-gray-600 mb-6">
        Your rights under the{" "}
        <Link href="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        , section 8.
      </p>

      <section className="space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-semibold mt-6">Start your request</h2>
        <PrivacyIntakeLinks />

        <h2 className="text-xl font-semibold mt-6">What happens next</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Acknowledgement.</strong> A person reads every message sent
            to the monitored mailbox and replies to it.
          </li>
          <li>
            <strong>Verification, when it is needed.</strong> We may need to
            verify your identity before acting on a request. We will tell you
            what is required, and we will not use it for any other purpose.
          </li>
          <li>
            <strong>Completion within {PRIVACY_COMPLETION_DAYS} days.</strong>{" "}
            A verified request is completed within 45 days of receipt, including
            any constituent partial request. If part of a request cannot be
            completed, the same confirmation says what was not done and why.
          </li>
          <li>
            <strong>By the same channel.</strong> The acknowledgement and the
            completion confirmation come back to the message you sent.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">What a request covers</h2>
        <p>
          A request covers the server-side records this application holds in
          association with your use of it — the read-only account session
          described in section 6, and operational records that identify you. It
          does not need to cover anything held in your browser: your workflow
          state, local evidence excerpts and OCR checkpoints are already under
          your control through the in-app clearing controls described in
          sections 1 and 4, and they are discarded when you close the tab.
          Hosting-platform request and operational logs are addressed by the
          operator log-retention review rather than by host-independent
          deletion.
        </p>
        <p>
          <strong>Exceptions.</strong> We may retain records that VA or federal
          law requires us to keep, including records subject to 36 CFR Chapter
          XII (National Archives and Records Administration recordkeeping) and
          VA recordkeeping obligations under Title 38, United States Code. Where
          an exception applies to part of a request, we identify the record and
          the reason in the confirmation.
        </p>

        <h2 className="text-xl font-semibold mt-6">What this page does not do</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            It does not submit anything to this application. There is no form
            here, and no request content is sent to the application server.
          </li>
          <li>
            It does not reach VA, and it does not change a VA record, a VA
            claim, or a VA decision. Requests about a VA record go to VA
            directly.
          </li>
          <li>
            It is not a channel for health information. Do not include medical
            records, a claim number, or a Social Security number in a request —
            none of them is needed to action it.
          </li>
          <li>
            VA resources remain independent of this application: VA&apos;s
            privacy program at{" "}
            <a
              href="https://www.va.gov/privacy/"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.va.gov/privacy/
            </a>{" "}
            and VA&apos;s main benefits line, 1-800-827-1000 (not a
            privacy-request intake channel).
          </li>
        </ul>
      </section>

      <div className="mt-8 pt-4 border-t">
        <Link
          href="/privacy"
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          &larr; Back to the Privacy Policy
        </Link>
      </div>
    </main>
  );
}
