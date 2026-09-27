import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  socialService,
  type Database,
  type CommandData,
  type ServiceOptions,
} from "../lib/social/service.ts";

// Real migration SQL and service code; only the D1 transport is adapted to SQLite.
// Identities default to reserved example.test emails; `emails` overrides one to
// exercise sign-in email-domain behavior.
export function fixture(emails: Record<string, string> = {}, options: ServiceOptions = {}) {
  const raw = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    raw.exec(readFileSync("drizzle/" + file, "utf8"));
  type Statement = { sql: string; args: SQLInputValue[] };
  const hooks: { batch: null | ((rows: Statement[]) => Promise<void>) } = {
    batch: null,
  };
  const adapter = {
    prepare(sql: string) {
      return {
        bind(...args: SQLInputValue[]) {
          return {
            sql,
            args,
            async first() {
              return raw.prepare(sql).get(...args) ?? null;
            },
            async all() {
              return { results: raw.prepare(sql).all(...args) };
            },
          };
        },
      };
    },
    async batch(rows: Statement[]) {
      if (hooks.batch) await hooks.batch(rows);
      raw.exec("BEGIN");
      try {
        const results = rows.map((s) => ({
          success: true,
          meta: { changes: raw.prepare(s.sql).run(...s.args).changes },
        }));
        raw.exec("COMMIT");
        return results;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const db = adapter as unknown as Database;
  const service = (id: string | null, email = (id && emails[id]) || id + "@example.test") =>
    socialService(
      db,
      id ? { userId: id, email, displayName: id } : null,
      "owner@example.test",
      options,
    );
  const act = (
    id: string,
    data: CommandData,
    requestId = crypto.randomUUID(),
  ) => service(id).execute({ requestId, data });
  const snap = (id: string | null, params: Record<string, string> = {}) =>
    service(id).snapshot(new URLSearchParams(params));
  const count = (table: string) =>
    Number(raw.prepare("SELECT COUNT(*) n FROM " + table).get()!.n);
  async function setup() {
    await act("owner", { action: "join", name: "Owner", username: "owner" });
    for (const id of ["a", "b", "c"]) {
      const inv = await act("owner", {
        action: "invite",
        email: id + "@example.test",
      });
      await act(id, {
        action: "join",
        name: "Person " + id,
        username: "person_" + id,
        invite: inv.invite,
      });
    }
  }
  async function friends() {
    await act("a", { action: "friend", targetId: "b", operation: "request" });
    await act("b", { action: "friend", targetId: "a", operation: "accept" });
  }
  async function post(
    audience: "friends" | "community" | "only_me" = "friends",
  ) {
    return (
      await act("a", {
        action: "post",
        kind: "opinion",
        subjectId: "homes",
        text: "Test contribution",
        audience,
      })
    ).postId as string;
  }
  return { raw, hooks, service, act, snap, count, setup, friends, post };
}
export const denied = (p: Promise<unknown>, status: number) =>
  assert.rejects(p, (e: { status?: number }) => e.status === status);
