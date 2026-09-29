import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import type { Database, Statement } from "@/lib/social/service";

// The community database. Production uses Turso (hosted libSQL, which speaks
// SQLite); `next dev` falls back to a local file so no account is needed.
// Every query in lib/social/service.ts runs unchanged on either.

type Bound = Statement & { sql: string; args: InValue[] };

const objects = (rs: ResultSet) => rs.rows.map((row) => Object.fromEntries(rs.columns.map((name, i) => [name, row[i]])));

export function libsqlDatabase(client: Client): Database {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          const args = values as InValue[];
          const statement: Bound = {
            sql,
            args,
            async first<T>() {
              return ((objects(await client.execute({ sql, args }))[0] as T | undefined) ?? null);
            },
            async all<T>() {
              return { results: objects(await client.execute({ sql, args })) as T[] };
            },
          };
          return statement;
        },
      };
    },
    // One transaction: a failing guard or constraint rolls back every write.
    batch(statements) {
      return client.batch(
        (statements as Bound[]).map(({ sql, args }) => ({ sql, args })),
        "write",
      );
    },
  };
}

export const LOCAL_DATABASE_URL = "file:.data/polis-local.db";

let database: Database | null | undefined;

export function getDatabase(): Database | null {
  if (database !== undefined) return database;
  const url = process.env.TURSO_DATABASE_URL || (process.env.NODE_ENV === "development" ? LOCAL_DATABASE_URL : "");
  database = url ? libsqlDatabase(createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined })) : null;
  return database;
}
