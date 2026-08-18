/**
 * Where to land after sign-in or email confirmation.
 *
 * Both the sign-in form and the auth callback route hand this an
 * untrusted `next` query param. Without validation, someone could hand a
 * victim `/sign-in?next=https://evil.example` — they'd authenticate for
 * real and then be thrown at attacker infrastructure, the classic
 * open-redirect phishing pivot. So the value is treated as untrusted: one
 * leading slash, and not `//` or `/\` (protocol-relative forms browsers
 * resolve to a different host).
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}
