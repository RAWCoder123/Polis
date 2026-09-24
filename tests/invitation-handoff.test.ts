import test from "node:test";
import assert from "node:assert/strict";
import { invitationCookie, pendingInvitation } from "../lib/social/invitation-handoff.ts";
test("invitation handoff uses a bounded HttpOnly cookie and never accepts arbitrary cookie data", () => {
  const request = new Request("https://polis.example/api/polis");
  const cookie = invitationCookie(request, "polis-abcd-efgh-jklm");
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=3600; Secure$/);
  assert.equal(pendingInvitation(new Request(request, { headers: { Cookie: cookie } })), "POLISABCDEFGHJKLM");
  assert.equal(pendingInvitation(new Request(request, { headers: { Cookie: "polis_pilot_invitation=unexpected%0Avalue" } })), "");
  assert.match(invitationCookie(request, null), /Max-Age=0/);
});
