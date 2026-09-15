import test from "node:test";
import assert from "node:assert/strict";
import { readResponse } from "../lib/social/read-response.ts";

test("unexpected server pages yield a retry message without exposing HTML", async () => {
  for (const response of [
    new Response("<!DOCTYPE html><title>Proxy failure</title>", {
      status: 502,
      headers: { "content-type": "text/html" },
    }),
    new Response("truncated", {
      headers: { "content-type": "application/json" },
    }),
  ]) {
    await assert.rejects(readResponse(response), {
      message: "Polis is temporarily unavailable. Please try again.",
    });
  }
  assert.deepEqual(
    await readResponse(
      Response.json(
        { error: "Only the author can edit this." },
        { status: 403 },
      ),
    ),
    { error: "Only the author can edit this." },
  );
});
