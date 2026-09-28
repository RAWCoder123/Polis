import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { clickMapPlace, launchBrowser } from './browser.mjs';
import { expect as baseExpect } from 'playwright/test';
import { checkedEventsFor } from '../lib/social/campus-events.ts';

// Local, isolated test sessions only. This does not verify Sites identities.
const origin = process.env.POLIS_TEST_ORIGIN ?? 'http://localhost:5183';
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const expect = baseExpect.configure({ timeout: 15000 });
const output = '/tmp/polis-milestone-qa';
await mkdir(output, { recursive: true });
const browser = await launchBrowser();
const errors = [], checks = [];
const stamp = Date.now().toString(36);
async function actor(account, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/signin-with-chatgpt?test_account=' + account + '&return_to=%2F%23home');
  return { page, context, account };
}
async function state(a, params = '') {
  const r = await a.context.request.get(origin + '/api/polis' + params);
  assert.equal(r.status(), 200); return r.json();
}
async function command(a, data, status = 200) {
  const r = await a.context.request.post(origin + '/api/polis', { headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), data } });
  const v = await r.json(); assert.equal(r.status(), status, v.error ?? data.action); return v;
}
async function ready(a, path) {
  await a.page.goto(origin + '/#' + path); await a.page.reload();
  await expect(a.page.getByText('Loading your community…', { exact: true })).toHaveCount(0);
  await expect(a.page.getByRole('combobox', { name: 'Current community' })).toBeVisible();
}
async function shot(a, name) {
  assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': overflow');
  await a.page.screenshot({ path: output + '/' + name + '.png' });
}
try {
  const owner = await actor('1', 1440), a = await actor('ithaca_a', 390), b = await actor('ithaca_b', 1440), c = await actor('ithaca_c', 320);
  if ((await state(owner)).status === 'onboarding') await command(owner, { action: 'account.create', name: 'Test curator', username: 'milestone_curator' });
  await command(owner, { action: 'community.manage', communityId: 'ithaca' });
  const code = await command(owner, { action: 'invite.code', communityId: 'ithaca', expiresDays: 1, maxUses: 3 });
  for (const user of [a,b,c]) {
    if (!(await state(user)).communities?.some(c => c.id === 'ithaca')) {
      await command(user, { action: 'invite.preview', code: code.invitationCode, expectedCommunityId: 'ithaca' });
      await command(user, { action: 'invite.redeem', confirmedCommunityId: 'ithaca', name: 'Test ' + user.account, username: 'milestone_' + user.account });
    }
    await command(user, { action: 'community.select', communityId: 'ithaca' });
  }
  for (const event of checkedEventsFor('ithaca')) await command(owner, { action: 'event.save', event, createOnly: true });
  const aid = (await state(a)).me.id, bid = (await state(b)).me.id;
  await command(a, { action: 'block', targetId: bid, enabled: false });
  await command(b, { action: 'block', targetId: aid, enabled: false });
  await command(b, { action: 'mute', targetId: aid, enabled: false });
  if ((await state(a)).people.find(p => p.id === bid)?.relationship !== 'friends') {
    await command(a, { action: 'friend', targetId: bid, operation: 'request' });
    await command(b, { action: 'friend', targetId: aid, operation: 'accept' });
  }
  for (const user of [a,b]) await command(user, { action: 'preferences', replies: true, reactions: true, issues: false, events: false });
  for (const old of (await state(owner)).events.filter(e => e.id.startsWith('milestone-'))) await command(owner, { action: 'event.status', eventId: old.id, status: 'archived' });
  const event = { ...checkedEventsFor('ithaca').find(e => e.id === 'cornell-north-campus-food-show-2026'), id: 'milestone-' + stamp, seriesId: 'milestone-' + stamp, title: 'SYNTHETIC campus event journey', startsAt: '2099-09-30T20:00:00.000Z', endsAt: '2099-09-30T22:00:00.000Z', sample: true };
  await command(owner, { action: 'event.save', event });
  await ready(a, 'explore/events?scope=campus');
  await a.page.getByRole('button', { name: 'Your interests', exact: true }).click();
  await a.page.getByRole('dialog').getByLabel('Food & markets', { exact: true }).check();
  await a.page.getByRole('dialog').getByRole('button', { name: 'Save interests', exact: true }).click();
  assert.ok((await state(a)).eventPreferences.interests.includes('food_markets'));
  const card = a.page.locator('#event-card-' + event.id);
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  assert.match(a.page.url(), /#explore\/events\?scope=campus/);
  assert.ok(!(await state(b)).saved.includes(event.id));
  await card.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(a.page.getByRole('heading', { name: event.title })).toBeVisible();
  await a.page.getByRole('button', { name: 'Going', exact: true }).click();
  await expect(a.page.locator('.event-plan-confirmed')).toContainText('Going · Private');
  assert.ok(!(await state(b)).venuePlans.some(p => p.eventId === event.id));
  await a.page.getByLabel('Attendance visibility').selectOption('friends');
  await a.page.getByRole('button', { name: 'Save new visibility', exact: true }).click();
  await expect(a.page.locator('.event-plan-confirmed')).toContainText('Friends');
  await a.page.reload();
  await expect(a.page.getByRole('button', { name: 'Saved · Undo', exact: true })).toBeVisible();
  await expect(a.page.locator('.event-plan-confirmed')).toContainText('Friends');
  assert.ok(!(await state(c)).venuePlans.some(p => p.eventId === event.id));
  await ready(b, 'explore/events?scope=campus&mode=map');
  // A friend's shared plan shows as initials on its venue, or on the bubble holding it.
  await expect(b.page.locator('.venue-map-shell .map-plan-faces').first()).toBeVisible();
  await clickMapPlace(b.page, '.venue-map-shell', 'Robert Purcell');
  await b.page.getByLabel('Occurrence at this venue').selectOption(event.id);
  await expect(b.page.locator('.venue-preview .map-shared-plan')).toContainText('Going');
  await expect.poll(async () => { const box = await b.page.locator('.maplibregl-popup').boundingBox(), map = await b.page.locator('.venue-map').boundingBox(); return box.y >= map.y - 2 && box.y + box.height <= map.y + map.height + 2; }).toBe(true);
  await shot(b, 'desktop-shared-plan-map');
  await ready(b, 'event/' + event.id + '?community=ithaca');
  await expect(b.page.locator('.community-event-detail')).toContainText('Test ithaca_a');
  await a.page.getByRole('button', { name: 'Start a conversation', exact: true }).click();
  const dialog = a.page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Your question', exact: true }).fill('Synthetic QA: meet at the entrance? ' + stamp);
  await dialog.getByRole('combobox', { name: 'Who can see this?' }).selectOption('friends');
  let rejected = false;
  await a.page.route('**/api/polis', async route => {
    if (!rejected && route.request().method() === 'POST' && route.request().postDataJSON()?.data?.action === 'post') {
      rejected = true; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic QA temporary failure. Retry.' }) });
    }
    return route.continue();
  });
  await dialog.getByRole('button', { name: 'Publish to Friends', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Your question', exact: true })).toHaveValue('Synthetic QA: meet at the entrance? ' + stamp);
  await expect(dialog.getByRole('alert')).toContainText('Synthetic QA temporary failure');
  await dialog.getByRole('button', { name: 'Publish to Friends', exact: true }).click();
  await a.page.unroute('**/api/polis');
  await expect(a.page).toHaveURL(/#post\//);
  const post = a.page.url().split('#post/')[1].split('?')[0];
  await ready(b, 'post/' + post + '?community=ithaca');
  await b.page.getByRole('textbox', { name: 'Join the conversation' }).fill('Synthetic QA: I can meet there.');
  await b.page.locator('.reply-form').getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(b.page.getByText('Synthetic QA: I can meet there.', { exact: true })).toBeVisible();
  await ready(a, 'notifications');
  const notice = (await state(a)).notifications.find(n => n.targetId === post);
  assert.ok(notice.commentId);
  await a.page.locator('.notification-row').filter({ hasText: 'replied to your conversation' }).first().click();
  await expect(a.page.locator('#comment-' + notice.commentId)).toBeVisible();
  await a.page.reload();
  await expect(a.page.locator('#comment-' + notice.commentId)).toBeVisible();
  assert.equal((await c.context.request.get(origin + '/api/polis?post=' + post)).status(), 404);
  await shot(a, 'mobile-event-conversation');
  checks.push('Interest selection → campus discovery → private save → private plan → friends visibility → friend map icon → conversation → exact notification → reload; third identity denied.');
  await ready(b, 'home');
  await clickMapPlace(b.page, '.civic-map.preview', ''); // any place
  await expect(b.page).toHaveURL(/#home\?selected=/);
  await expect(b.page.locator('.venue-preview')).toBeVisible();
  checks.push('Home map pins select an anchored preview without leaving Home.');
  for (const view of ['home', 'explore?layer=events']) {
    await ready(b, view);
    await clickMapPlace(b.page, '.civic-map', 'North Campus Retail Food Show');
    await b.page.getByLabel('Occurrence at this venue').selectOption(event.id);
    await expect(b.page.locator('.venue-preview .map-shared-plan')).toContainText('Going');
    if (view.startsWith('explore')) await expect(b.page.locator('.civic-map-card')).toContainText(event.title);
    await b.page.locator('.venue-preview').getByRole('button', { name: 'View event', exact: true }).click();
    await expect(b.page).toHaveURL(new RegExp('#event/' + event.id));
  }
  checks.push('Home and Map previews select later occurrences, match shared plans and open the selected date.');
  await ready(a, 'explore/events?scope=campus&sort=date');
  const food = a.page.locator('#event-card-cornell-north-campus-food-show-2026');
  await food.scrollIntoViewIfNeeded();
  const scroll = await a.page.evaluate(() => scrollY);
  await food.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(a.page.getByRole('heading', { name: 'North Campus Retail Food Show', exact: true })).toBeVisible();
  await a.page.goBack();
  await expect(a.page).toHaveURL(/scope=campus&sort=date/);
  await expect.poll(async () => Math.abs((await a.page.evaluate(() => scrollY)) - scroll)).toBeLessThan(60);
  checks.push('Browser Back restores event filters and scroll position; failed publication keeps the draft and retries successfully.');
  await ready(b, 'commons/local');
  await b.page.locator('#post-' + post).getByRole('button', { name: /Open conversation/ }).click();
  await expect(b.page.locator('#discussion-reply textarea')).toBeFocused();
  await a.page.route('**/localist-images.azureedge.net/**', route => route.abort());
  await ready(a, 'event/cornell-north-campus-food-show-2026');
  await expect(a.page.locator('.community-event-detail > .event-image-fallback')).toBeVisible();
  await a.page.unroute('**/localist-images.azureedge.net/**');
  checks.push('Feed Reply focuses the thread composer; broken images show a category fallback.');
  for (const user of [a,b,c]) {
    await ready(user, 'commons/local');
    await shot(user, 'commons-' + user.context.pages()[0].viewportSize().width);
  }
  await ready(a, 'commons/national');
  const nationalPost = await command(b, { action: 'post', kind: 'question', title: 'Synthetic national discussion ' + stamp, coverage: 'national', subjectId: 'community', text: 'Friends-only national discussion', audience: 'friends' });
  await a.page.reload();
  await expect(a.page.locator('#post-' + nationalPost.postId)).toBeVisible();
  await a.page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(a.page.locator('#post-' + nationalPost.postId)).toBeVisible();
  checks.push('National starts with the same eligible conversations as its selected New filter.');
  await a.page.getByRole('button', { name: 'Across Polis', exact: true }).click();
  const join = a.page.getByRole('button', { name: 'Join Across Polis', exact: true });
  if (await join.isVisible()) await join.click();
  await expect.poll(async () => (await state(a)).me.activeCommunityId).toBe('ithaca');
  await a.page.getByRole('button', { name: 'My campus', exact: true }).click();
  await expect(a.page).toHaveURL(/scope=campus/);
  checks.push('National scopes retain the selected campus; wider membership is explicit.');
  await command(owner, { action: 'event.status', eventId: event.id, status: 'canceled' });
  await ready(a, 'event/' + event.id);
  await expect(a.page.getByRole('status').filter({ hasText: 'Canceled by' })).toBeVisible();
  await expect(a.page.getByRole('button', { name: 'Going', exact: true })).toBeDisabled();
  assert.ok(!(await state(b)).venuePlans.some(p => p.eventId === event.id));
  checks.push('Canceled occurrences retain informative direct links and disappear from venue activity.');
  const paginationIds = [];
  for (let i = 0; i < 25; i++) paginationIds.push((await command(b, { action: 'post', kind: 'question', title: 'Synthetic pagination ' + stamp + ' ' + i, subjectId: 'community', text: 'Temporary local pagination fixture', audience: 'only_me' })).postId);
  const pageQuery = '?filter=all&sort=active&q=' + encodeURIComponent('Synthetic pagination ' + stamp);
  const pageOne = await state(b, pageQuery);
  assert.equal(pageOne.posts.length, 20);
  const pageTwo = await state(b, pageQuery + '&cursor=' + encodeURIComponent(pageOne.nextCursor));
  assert.equal(pageTwo.posts.length, 5);
  assert.deepEqual(new Set([...pageOne.posts, ...pageTwo.posts].map(p => p.id)), new Set(paginationIds));
  for (const postId of paginationIds) await command(b, { action: 'post.delete', postId });
  checks.push('Recently active pagination works through the local D1 HTTP boundary without duplicate or missing threads.');
  await ready(b, 'home'); await shot(b, 'desktop-home');
  await ready(a, 'event/cornell-csa-mid-autumn-2026'); await shot(a, 'mobile-campus-event');
  assert.deepEqual(errors, []);
  await writeFile(output + '/verification.json', JSON.stringify({ checks, runtimeErrors: errors, environment: 'local synthetic sessions' }, null, 2));
  console.log('PASS milestone journey:', checks.join('\n')); console.log('Screenshots:', output);
} finally { await browser.close(); }
