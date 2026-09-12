import assert from "node:assert/strict";

// Read-only and rejected writes against the local Worker; creates no user data.
const origin = "http://localhost:5173";
const get = await fetch(origin + "/api/polis", {
  headers: {
    "oai-authenticated-user-id": "forged-owner",
    "oai-authenticated-user-email": "seedy@sites.test",
  },
});
assert.equal(get.status, 200);
assert.match(get.headers.get("cache-control"), /no-store/);
const snapshot = await get.json();
assert.equal(snapshot.status, "signed_out");
assert.equal(snapshot.me, null);
assert.deepEqual(snapshot.posts, []);
const command = JSON.stringify({
  requestId: crypto.randomUUID(),
  data: { action: "visit" },
});
for (const [headers, expected] of [
  [
    { Origin: "https://another.example", "Content-Type": "application/json" },
    403,
  ],
  [{ Origin: origin, "Content-Type": "text/plain" }, 415],
  [{ Origin: origin, "Content-Type": "application/json" }, 401],
]) {
  // Rejected bodies are deliberately unread by the Worker; isolate dev HTTP connections.
  const response = await fetch(origin + "/api/polis", {
    method: "POST",
    headers: { ...headers, Connection: "close" },
    body: command,
  });
  const body = await response.text();
  assert.equal(response.status, expected, body);
}
console.log(
  "PASS local HTTP: anonymous isolation, forged header stripping, no-store, cross-origin/format/auth rejection.",
);
