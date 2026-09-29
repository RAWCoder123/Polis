import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { appAlert, launchBrowser } from "./browser.mjs";
import { expect as baseExpect } from "playwright/test";

// Synthetic local identities only. Never run fixture writes against a deployed Site.
// The tester and second member are new run-scoped accounts, so every run redeems
// the code for the first time and the suite can repeat on one database.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5180";
const target = new URL(origin);
assert.ok(target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname));
const expect = baseExpect.configure({ timeout: 15000 });
const output = path.join(tmpdir(), "polis-invitation-qa");
await mkdir(output, { recursive: true });
const browser = await launchBrowser();
const errors = [];
const run = Date.now().toString(36);
const account = role => "qa_invites_" + run + "_" + role;
const username = role => "invite_" + run + "_" + role;
async function session(width) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  return { context, page };
}
async function command(actor, data, expected = 200) {
  const r = await actor.context.request.post(origin + "/api/polis", { headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), data } });
  const result = await r.json();
  assert.equal(r.status(), expected, result.error ?? "Unexpected response");
  return result;
}
async function snapshot(actor, params = "") {
  const r = await actor.context.request.get(origin + "/api/polis" + params);
  assert.equal(r.status(), 200);
  return r.json();
}
async function layout(actor, name, masks = []) {
  const dimensions = await actor.page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(dimensions.content <= dimensions.viewport + 1, name + " overflow");
  await actor.page.screenshot({ path: path.join(output, name + ".png"), fullPage: false, mask: masks });
}
async function checkCode(actor, code) {
  await actor.page.goto(origin + "/#join");
  await actor.page.reload();
  const another = actor.page.getByRole("button", { name: "Use another code" });
  if (await another.isVisible()) await another.click();
  await actor.page.getByRole("textbox", { name: "Invite code", exact: true }).fill(code);
  await actor.page.getByRole("button", { name: "Check code", exact: true }).click();
  await expect(actor.page.getByRole("heading", { name: "Your community is waiting." })).toBeVisible();
}
try {
  const owner = await session(1440);
  await owner.page.goto(origin + "/sign-in?test_account=1&return_to=%2F%23admin");
  if ((await snapshot(owner)).status === "onboarding")
    await command(owner, { action: "join", name: "Beta Alex", username: "beta_alex" });
  // Other suites move the shared owner between communities; return it to Ithaca.
  await command(owner, { action: "community.manage", communityId: "ithaca" });
  await owner.page.reload();
  await expect(owner.page.getByRole("heading", { name: "Invite with a code" })).toBeVisible();
  await owner.page.getByRole("combobox", { name: "University / community" }).selectOption("emory");
  await owner.page.getByRole("checkbox", { name: "Limit the number of people" }).uncheck();
  await owner.page.getByRole("combobox", { name: "Code expires in" }).selectOption("7");
  await owner.page.getByRole("button", { name: "Generate code", exact: true }).click();
  const generated = owner.page.getByRole("textbox", { name: "Your invitation code" });
  await expect(generated).toBeVisible();
  const code = await generated.inputValue();
  await owner.page.getByRole("button", { name: "Copy code", exact: true }).click();
  await expect(owner.page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  assert.equal(await owner.page.evaluate(() => navigator.clipboard.readText()), code);
  await layout(owner, "desktop-admin", [generated]);
  const created = (await snapshot(owner)).admin.invitationCodes.find(c => c.communityId === "emory" && c.maxUses === null && !c.revokedAt);
  assert.ok(created);
  console.log("PASS desktop admin: community, expiration, optional limit, generate and copy");

  const tester = await session(390);
  await tester.page.goto(origin + "/#join");
  await tester.page.getByRole("textbox", { name: "Invite code", exact: true }).fill("not-a-code");
  await tester.page.getByRole("button", { name: "Check code", exact: true }).click();
  await expect(tester.page.locator(appAlert)).toContainText("invalid");
  await tester.page.getByRole("textbox", { name: "Invite code", exact: true }).fill(code.toLowerCase().replaceAll("-", " "));
  await tester.page.getByRole("button", { name: "Check code", exact: true }).click();
  await expect(tester.page.getByRole("heading", { name: "Emory University", exact: true })).toBeVisible();
  assert.equal((await snapshot(owner)).admin.invitationCodes.find(c => c.id === created.id).useCount, 0);
  assert.equal(await tester.page.evaluate(() => document.cookie.includes("polis_pilot_invitation")), false);
  assert.ok(!tester.page.url().includes(code));
  await tester.page.reload();
  await expect(tester.page.getByRole("link", { name: "Confirm community & sign in" })).toBeVisible();
  await layout(tester, "mobile-confirm-community");
  // Choose an isolated synthetic identity through the local sign-in shim only.
  await tester.page.route("**/sign-in?**", route => {
    const url = new URL(route.request().url()); url.searchParams.set("test_account", account("b"));
    return route.continue({ url: url.href });
  });
  await tester.page.getByRole("link", { name: "Confirm community & sign in" }).click();
  await expect(tester.page.getByRole("button", { name: "Join Emory University", exact: true })).toBeVisible();
  await tester.page.reload();
  await expect(tester.page.getByRole("button", { name: "Join Emory University", exact: true })).toBeVisible();
  const name = tester.page.getByRole("textbox", { name: "Your name", exact: true });
  if (await name.isVisible()) {
    await name.fill("Beta Blair");
    await tester.page.getByRole("textbox", { name: "Username", exact: true }).fill(username("b"));
  }
  let failedOnce = false;
  await tester.page.route("**/api/polis", async route => {
    if (!failedOnce && route.request().method() === "POST" && route.request().postDataJSON()?.data?.action === "invite.redeem") {
      failedOnce = true;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic interrupted submission. Please retry." }) });
    }
    return route.continue();
  });
  await tester.page.getByRole("button", { name: "Join Emory University", exact: true }).click();
  await expect(tester.page.getByText("Synthetic interrupted submission. Please retry.").last()).toBeVisible();
  if (await name.isVisible()) await expect(name).toHaveValue("Beta Blair");
  await layout(tester, "mobile-retry");
  await tester.page.getByRole("button", { name: "Join Emory University", exact: true }).click();
  await expect(tester.page).toHaveURL(origin + "/#home");
  await tester.page.reload();
  assert.equal((await snapshot(tester)).community.id, "emory");
  assert.equal((await snapshot(tester)).me.role, "member");
  assert.equal((await snapshot(owner)).admin.invitationCodes.find(c => c.id === created.id).useCount, 1);
  await expect(tester.page.getByRole("combobox", { name: "Current community" })).toHaveValue("emory");
  await layout(tester, "mobile-community-home");
  console.log("PASS mobile tester: invalid code, confirmation, login handoff, reload, failed submission recovery and persistent membership");

  const second = await session(1440);
  await checkCode(second, code);
  await second.page.route("**/sign-in?**", route => {
    const url = new URL(route.request().url()); url.searchParams.set("test_account", account("c")); return route.continue({ url: url.href });
  });
  await second.page.getByRole("link", { name: "Confirm community & sign in" }).click();
  await expect(second.page.getByRole("button", { name: "Join Emory University", exact: true })).toBeVisible();
  if (await second.page.getByRole("textbox", { name: "Your name", exact: true }).isVisible()) {
    await second.page.getByRole("textbox", { name: "Your name", exact: true }).fill("Beta Casey");
    await second.page.getByRole("textbox", { name: "Username", exact: true }).fill(username("c"));
  }
  await second.page.getByRole("button", { name: "Join Emory University", exact: true }).click();
  await expect(second.page).toHaveURL(origin + "/#home");
  assert.equal((await snapshot(owner)).admin.invitationCodes.find(c => c.id === created.id).useCount, 2);
  await checkCode(tester, code);
  await expect(tester.page.getByText(/You’ve already joined this community/)).toBeVisible();
  await tester.page.getByRole("button", { name: "Continue to community", exact: true }).click();
  await expect(tester.page).toHaveURL(origin + "/#home");
  assert.equal((await snapshot(owner)).admin.invitationCodes.find(c => c.id === created.id).useCount, 2);
  // A ordinary tester cannot select another community or administer invitations.
  await command(tester, { action: "community.select", communityId: "ithaca" }, 403);
  await command(tester, { action: "invite.code", communityId: "emory" }, 403);
  await owner.page.reload();
  await owner.page.getByRole("button", { name: "Revoke code", exact: true }).first().click();
  await expect(owner.page.getByText(/· Revoked/).first()).toBeVisible();
  await owner.page.reload();
  assert.ok((await snapshot(owner)).admin.invitationCodes.find(c => c.id === created.id).revokedAt);
  const stranger = await session(390);
  await command(stranger, { action: "invite.preview", code }, 403);
  assert.equal((await snapshot(tester)).community.id, "emory");
  console.log("PASS independent second account, duplicate redemption, permission limits, persisted counts and revocation");
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log("PASS screenshots and overflow checks: " + output);
} finally { await browser.close(); }
