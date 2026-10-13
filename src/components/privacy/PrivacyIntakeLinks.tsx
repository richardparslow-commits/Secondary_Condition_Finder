import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_REQUESTS,
  privacyRequestMailto,
  privacyRequestPlainText,
} from "@/lib/privacy/intake";

/**
 * Privacy-request intake (R-01 / B-02).
 *
 * Server-rendered on purpose, and there is no form, no field and no submit
 * handler anywhere in this component: the four prepared `mailto:` links open
 * the visitor's own mail client, and the message body is also offered as
 * plain text for a visitor whose mail client will not open. Nothing here can
 * send anything to the application, which is what makes the page's promise
 * true rather than merely intended.
 *
 * A request is the one privacy surface where the visitor must be able to
 * *identify themselves* so the operator can verify and reply. Keeping that
 * detail in the visitor's own mail client — instead of in an action input — is
 * what avoids weakening the PHI-free Server Action contract, and the copy says
 * so plainly so a reviewer does not have to infer it.
 */
export function PrivacyIntakeLinks() {
  return (
    <div className="space-y-4">
      <p>
        Each link below prepares the message and opens your own email
        application, already addressed to the monitored privacy mailbox. Nothing
        on this page is submitted to this application: there is no form
        submission, no server record, and no account. The message travels from
        your email account to a person, and the identifying details stay in your
        own message.
      </p>
      <ul className="list-disc space-y-4 pl-6">
        {PRIVACY_REQUESTS.map((request) => (
          <li key={request.type}>
            <a
              href={privacyRequestMailto(request.type)}
              className="font-medium text-blue-700 hover:underline"
            >
              {request.label}
            </a>
            {" — "}
            {request.summary}
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-700 hover:underline">
                Copy the message text instead
              </summary>
              <textarea
                readOnly
                rows={14}
                value={privacyRequestPlainText(request.type)}
                aria-label={`Message text for: ${request.label}`}
                className="mt-2 w-full rounded border border-gray-300 p-2 font-mono text-xs"
              />
            </details>
          </li>
        ))}
      </ul>
      <p>
        If your email application does not open, send a message from any email
        account to{" "}
        <a
          href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
          className="font-medium text-blue-700 hover:underline"
        >
          {PRIVACY_CONTACT_EMAIL}
        </a>{" "}
        and copy the message text above.
      </p>
    </div>
  );
}
