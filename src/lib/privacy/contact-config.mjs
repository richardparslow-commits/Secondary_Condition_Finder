/**
 * A public, operator-approved mailbox; never infer one from an account login.
 * @param {{ PRIVACY_CONTACT_EMAIL?: string }} env
 */
export function configuredPrivacyContact(env = process.env) {
  const address = env.PRIVACY_CONTACT_EMAIL?.trim();
  if (!address) return null;
  // A single bare ASCII mailbox, never a mailto URL, display name, query or header.
  if (address.length > 254 || !/^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(address)) return null;
  return address;
}
