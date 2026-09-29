import { getDatabase } from "@/db";
import { getSessionUser, pilotOwnerEmail } from "@/lib/auth/session";
import { socialService, ApiError } from "@/lib/social/service";
import { invitationCookie, pendingInvitation } from "@/lib/social/invitation-handoff";
export const dynamic = "force-dynamic";
const respond = (data: unknown, status = 200, cookie?: string) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
async function handle(request: Request, write: boolean) {
  try {
    if (write) {
      const origin = request.headers.get("origin");
      if (origin !== new URL(request.url).origin)
        return respond({ error: "This request must come from Polis." }, 403);
      if (
        request.headers.get("content-type")?.split(";")[0] !==
        "application/json"
      )
        return respond({ error: "Send JSON." }, 415);
      if (Number(request.headers.get("content-length") ?? 0) > 32000)
        return respond({ error: "Submission is too large." }, 413);
    }
    const db = getDatabase();
    if (!db)
      return respond(
        { error: "The community database is not configured yet." },
        503,
      );
    const user = await getSessionUser();
    const service = socialService(db, user, pilotOwnerEmail(), {
      fetch: (input, init) => fetch(input, init),
      contact: new URL(request.url).origin,
    });
    if (write) {
      const raw = await request.text();
      if (raw.length > 32000)
        return respond({ error: "Submission is too large." }, 413);
      const input = JSON.parse(raw);
      if (input?.data?.action === "invite.preview") {
        if (Object.keys(input.data).some(k => !["action", "code", "expectedCommunityId"].includes(k))) return respond({ error: "Invalid invitation request." }, 400);
        const invitation = await service.previewInvitation(input.data.code);
        if (input.data.expectedCommunityId && input.data.expectedCommunityId !== invitation.community.id) return respond({ error: "This code belongs to another campus. Use the matching campus invitation." }, 400);
        return respond({ invitation }, 200, invitationCookie(request, input.data.code));
      }
      if (input?.data?.action === "invite.clear")
        return respond({ ok: true }, 200, invitationCookie(request, null));
      if (input?.data?.action === "invite.redeem") {
        const invite = pendingInvitation(request);
        if (!invite) return respond({ error: "Enter your invitation code again to continue." }, 403);
        // Client-submitted codes cannot replace the community preview being confirmed.
        const result = await service.execute({ ...input, data: { ...input.data, invite } });
        return respond(result);
      }
      return respond(await service.execute(input));
    }
    const search = new URL(request.url).searchParams;
    if (search.has("communities")) {
      const near = (search.get("near") ?? "").split(",").map(Number);
      return respond({
        communities: await service.searchCommunities(
          search.get("communities") ?? "",
          near.length === 2 && near.every(Number.isFinite) ? [near[0], near[1]] : null,
        ),
      });
    }
    if (search.has("places")) return respond({ places: await service.lookupPlaces(search.get("places") ?? "") });
    if (search.has("reverse")) {
      const [lat, lng] = (search.get("reverse") ?? "").split(",").map(Number);
      return respond({ place: await service.lookupReverse(lat, lng) });
    }
    if (new URL(request.url).searchParams.get("invitation") === "1") {
      const invite = pendingInvitation(request);
      return respond({ invitation: invite ? await service.previewInvitation(invite) : null });
    }
    return respond(await service.snapshot(new URL(request.url).searchParams));
  } catch (error) {
    if (error instanceof ApiError)
      return respond({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
      return respond({ error: "Invalid submission." }, 400);
    console.error(
      "Polis request failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return respond(
      { error: "We couldn’t save or load that just now. Please try again." },
      500,
    );
  }
}
export const GET = (r: Request) => handle(r, false);
export const POST = (r: Request) => handle(r, true);
