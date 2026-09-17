import test from "node:test";
import assert from "node:assert/strict";
import { PendingSubmissions } from "../lib/social/pending-submissions.ts";

function store() {
  const entries = new Map<string, string>();
  return { entries, getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); } };
}
test("a lost reply acknowledgement survives another action and reload without persisting text", async () => {
  const storage = store();
  const journal = new PendingSubmissions(() => storage);
  const reply = { action: "comment", postId: "post", text: "Private civic opinion", parentId: null };
  const first = await journal.start("alice", reply);
  const read = await journal.start("alice", { action: "notifications.read" });
  journal.acknowledge(read);
  assert.equal((await journal.start("alice", reply)).id, first.id);
  const reloaded = new PendingSubmissions(() => storage);
  assert.equal((await reloaded.start("alice", reply)).id, first.id);
  assert.ok(!JSON.stringify([...storage.entries]).includes(reply.text));
  reloaded.acknowledge(first);
  assert.notEqual((await reloaded.start("alice", reply)).id, first.id, "A deliberate new submission gets a new identity.");
});
test("pending identities are isolated by user and exact command, and degrade to same-page retries", async () => {
  const storage = store();
  const journal = new PendingSubmissions(() => storage);
  const a = await journal.start("alice", { action: "comment", text: "One" });
  assert.notEqual((await journal.start("bob", { action: "comment", text: "One" })).id, a.id);
  assert.notEqual((await journal.start("alice", { action: "comment", text: "Two" })).id, a.id);
  const unavailable = new PendingSubmissions(() => { throw new Error("Storage disabled"); });
  const first = await unavailable.start("alice", { action: "save" });
  assert.equal((await unavailable.start("alice", { action: "save" })).id, first.id);
  unavailable.acknowledge(first);
  assert.notEqual((await unavailable.start("alice", { action: "save" })).id, first.id);
});
