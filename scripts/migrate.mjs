import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createClient } from "@libsql/client";

// Applies drizzle/*.sql in order, each migration and its record in one
// transaction, so a failed migration leaves the database as it was. Applied
// files are never edited; add new ones with `npm run db:generate`.
//
// Runs before `next build` on Vercel and before `next dev` locally. Preview
// deployments skip it unless they have their own database, so an unmerged
// branch can never change the production schema. Before accounts open,
// production deploys the public pages alone; once sign-in is configured, a
// production build without its database fails rather than go live without it.

const vercel = process.env.VERCEL_ENV;
if (!vercel && existsSync(".env.local")) process.loadEnvFile(".env.local");

if (vercel === "preview" && process.env.POLIS_MIGRATE_PREVIEW !== "1") {
  console.log("migrate: skipped on a preview deployment (set POLIS_MIGRATE_PREVIEW=1 with a separate preview database)");
  process.exit(0);
}

const url = process.env.TURSO_DATABASE_URL || (vercel ? "" : "file:.data/polis-local.db");
if (!url) {
  if (vercel === "production" && process.env.CLERK_SECRET_KEY) {
    console.error("migrate: sign-in is configured but TURSO_DATABASE_URL is not set; refusing to deploy production without its database");
    process.exit(1);
  }
  if (vercel === "production") {
    console.log("migrate: no database yet; deploying the public pages only (accounts open once Turso and Clerk are connected)");
    process.exit(0);
  }
  console.log("migrate: no database configured; skipped");
  process.exit(0);
}
if (url.startsWith("file:")) mkdirSync(".data", { recursive: true });

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
// Same bookkeeping table as Cloudflare D1, so an exported D1 database from the
// earlier Sites pilot can be imported and continue from where it was.
await db.execute(
  "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
);
const applied = new Set((await db.execute("SELECT name FROM d1_migrations")).rows.map((r) => r.name));
const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const statements = readFileSync("drizzle/" + file, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.batch([...statements, { sql: "INSERT INTO d1_migrations(name) VALUES(?)", args: [file] }], "write");
  console.log("migrate: applied " + file);
  count++;
}
console.log("migrate: " + (count ? count + " applied" : "up to date") + " (" + files.length + " total, " + (url.startsWith("file:") ? "local file" : "Turso") + ")");
db.close();
