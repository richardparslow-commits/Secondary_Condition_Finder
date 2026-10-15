import Link from "next/link";

import { PRIVACY_INTAKE_PATH } from "@/lib/privacy/intake";

/**
 * The privacy-request pointer that travels with a control which clears
 * browser-local state (R-01 / B-02).
 *
 * It exists because two deletions look alike and are not: a clearing control
 * removes what **this browser** holds, and the data the **application** itself
 * keeps is deleted through the published intake. Linking the intake beside the
 * control — rather than leaving discovery to the policy — is the promise being
 * reachable at the moment the question arises, and the wording keeps the two
 * apart so "clear" cannot be read as "everything about me is deleted".
 *
 * Every clearing surface in the app renders this one component (the secondary
 * track's Finish/restart controls and the presumptive track's saved
 * service-history control), so the destination and the distinction are stated
 * once. `PRIVACY_INTAKE_PATH` is imported from the intake module rather than
 * retyped, which is why the route cannot drift from the one the policy and the
 * Terms also point at. The intake page prepares the message in the visitor's own
 * mail client and submits nothing here, which is why linking it is enough and no
 * contact details — and no mail-client link of its own — belong in this
 * component.
 *
 * `clearedStatement` is the one surface-specific sentence: what that control
 * clears. It must keep naming this browser, because everything after it is the
 * half no clearing control can do. `tests/privacy-deletion-pointer.test.tsx`
 * holds the shared properties and both call sites.
 */
export function PrivacyDeletionCue({ clearedStatement }: { clearedStatement: string }) {
  return (
    <p className="text-sm text-muted">
      {clearedStatement} Data the application itself keeps is deleted through a{" "}
      <Link href={PRIVACY_INTAKE_PATH} className="font-medium underline">
        privacy request
      </Link>
      , which prepares the message in your own email application; the commitment
      and its exceptions are in the{" "}
      <Link href="/privacy" className="font-medium underline">
        privacy policy
      </Link>
      , section 8.
    </p>
  );
}
