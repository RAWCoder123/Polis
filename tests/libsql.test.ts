import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { libsqlDatabase } from "../db/index.ts";
import { socialService, type CommandData } from "../lib/social/service.ts";

// Production runs on Turso through db/index.ts. These tests use a libSQL file,
// the same client and SQL dialect, with the real migration runner.

const dir = mkdtempSync(path.join(tmpdir(), "polis-libsql-"));
const url = "file:" + path.join(dir, "polis.db");
test.after(() => rmSync(dir, { recursive: true, force: true }));

const migrate = () =>
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "", VERCEL_ENV: "" },
    encoding: "utf8",
  });

test("the migration runner applies every migration once, then nothing", () => {
  const total = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).length;
  assert.match(migrate(), new RegExp(total + " applied"));
  assert.match(migrate(), /up to date/);
});

test("statements return plain rows, and a failed batch writes nothing", async () => {
  const client = createClient({ url });
  const db = libsqlDatabase(client);
  assert.equal(await db.prepare("SELECT id FROM write_guards WHERE id=?").bind("none").first(), null);
  const { results } = await db.prepare("SELECT ? AS word, ? AS n").bind("hello", 3).all<{ word: string; n: number }>();
  assert.deepEqual(results, [{ word: "hello", n: 3 }]);
  await assert.rejects(
    db.batch([
      db.prepare("INSERT INTO write_guards(id,allowed) VALUES(?,1)").bind("first"),
      db.prepare("INSERT INTO write_guards(id,allowed) VALUES(?,0)").bind("guard"),
    ]),
    /write_allowed/,
  );
  assert.equal(await db.prepare("SELECT id FROM write_guards WHERE id=?").bind("first").first(), null);
  client.close();
});

test("the social service runs unchanged on libSQL", async () => {
  const client = createClient({ url });
  const db = libsqlDatabase(client);
  const service = (id: string) => socialService(db, { userId: id, email: id + "@example.test", displayName: id }, "owner@example.test");
  const act = (id: string, data: CommandData, requestId = crypto.randomUUID()) => service(id).execute({ requestId, data });

  await act("owner", { action: "join", name: "Owner", username: "owner" });
  for (const id of ["a", "b"]) {
    const invitation = await act("owner", { action: "invite", email: id + "@example.test" });
    await act(id, { action: "join", name: "Person " + id, username: "person_" + id, invite: invitation.invite });
  }
  await act("a", { action: "friend", targetId: "b", operation: "request" });
  await act("b", { action: "friend", targetId: "a", operation: "accept" });

  const requestId = crypto.randomUUID();
  const data: CommandData = { action: "post", kind: "opinion", subjectId: "homes", text: "Buses after 10pm", audience: "friends" };
  const first = await act("a", data, requestId);
  // A retried submission returns the saved result instead of posting twice.
  assert.deepEqual(await act("a", data, requestId), first);
  await assert.rejects(act("a", { ...data, text: "Something else" }, requestId), (e: { status?: number }) => e.status === 409);

  const texts = async (id: string) =>
    JSON.stringify(await service(id).snapshot(new URLSearchParams()))
      .match(/Buses after 10pm/g)?.length ?? 0;
  assert.ok((await texts("b")) > 0, "a friend sees the post");
  const posts = await db.prepare("SELECT COUNT(*) AS n FROM posts WHERE authorId=?").bind("a").first<{ n: number }>();
  assert.equal(posts?.n, 1);
  client.close();
});
