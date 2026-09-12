import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { socialService, ApiError } from "@/lib/social/service";
export const dynamic = "force-dynamic";
const respond = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
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
    if (!env.DB)
      return respond(
        { error: "The community database is not configured yet." },
        503,
      );
    const user = await getChatGPTUser();
    const service = socialService(env.DB, user, env.POLIS_OWNER_EMAIL ?? "");
    if (write) {
      const raw = await request.text();
      if (raw.length > 32000)
        return respond({ error: "Submission is too large." }, 413);
      return respond(await service.execute(JSON.parse(raw)));
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
