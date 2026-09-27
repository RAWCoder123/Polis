// This bearer code stays in an HttpOnly, same-site cookie during the existing
// ChatGPT login flow. It is always checked against the database before admission.
const cookieName = "polis_pilot_invitation";
export function pendingInvitation(request: Request): string {
  const value = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(cookieName + "="))?.slice(cookieName.length + 1) ?? "";
  // Matches the service's code format: generated POLIS codes and 6–32 character
  // owner-chosen codes, already normalized when the cookie was set.
  return /^[A-Z0-9]{6,32}$/.test(value) ? value : "";
}
export function invitationCookie(request: Request, code: string | null): string {
  const normalized = (code ?? "").replace(/[\s-]/g, "").toUpperCase();
  return `${cookieName}=${normalized}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${code ? 3600 : 0}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
