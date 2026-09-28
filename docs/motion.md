# Motion

Verification date: September 27, 2026. Branch: `codex/polis-motion`, on top of `codex/polis-anywhere`. Locally verified; **not deployed**.

The app now moves the way the launch film (`marketing/launch-video/`, not part of this branch) shows it. The same curves, springs and durations come from the film's `engine.js` and `timeline.js`. Motion is progressive enhancement: browsers without the View Transitions API change views instantly as before, and nothing animates when the viewer prefers reduced motion.

## What moves

| Moment | Behavior | Film reference |
| --- | --- | --- |
| Tap a card, row or chip (`[data-morph]`) | The card grows into the content area (0.74 s, container curve) while the new page is revealed inside it and the old page recedes. | Question card → discussion; source → issue page |
| Navigate forward (rail, tab bar, links) | The old view recedes (0.34 s); the new one rises 14 px into place (0.56 s). The rail, header and tab bar stay still and only cross-fade their active state. | Map → profile; community switch |
| Back | Wide screens slide briefly. Under 760 px the old page is swiped off to the right while the previous one slides in underneath with parallax, like an edge swipe. | Swipe back from the issue page |
| Return to a view | It reappears at once from memory, at the scroll position you left, while it is fetched again. | Swipe back reveals the intact conversation |
| Open a conversation | Its post shows immediately; replies load behind a skeleton and rise in. | Replies arrive one by one |
| New reply or post in a list on screen | Opens its own space (height and fade); a single live arrival is highlighted briefly. | Maya's nested reply |
| React or save | Shows immediately and the icon pops; rolls back with the error message if the request fails. Controls no longer dim during short requests. | "Thought-provoking" tap |
| Follow, save, going (`[data-pop]`) | Icon pops on, settles off. | "Follow updates", "Going" |
| Map | Pins drop in on a spring, one after another; a chosen pin pulses; place cards rise; Leaflet zooms, fades tiles and pans smoothly. | Pins drop; forum card rises |
| Dialogs and badge | Dialogs arrive on the film's curves (sliding up on phones); the unread badge bumps when its count changes. | Sheet; bell badge |
| First view of a visit | The content comes into focus; Home's headline arrives word by word once. | Opening line; feed comes into focus |

Only `transform`, `opacity`, `clip-path` and (for arrivals) layout height animate. A tap or key press during a page transition finishes it immediately, so the page never waits on an animation.

## How it works

- `lib/motion.ts`: the film's curves and springs (sampled into CSS `linear()`), `transition()` around `document.startViewTransition`, the per-tap container-transform geometry, and the pop, settle, rise and expand helpers.
- `lib/social/route.ts`: the hash route as an external store, committed inside view transitions. Each history entry records its position, so back and forward are told apart. Fragment links fire `popstate` too and animate forward. Tabs and filters within one page (for example the Commons tabs) change in place. Back swipes the browser has already animated (`hasUAVisualTransition`) are not animated twice.
- `lib/social/use-social.ts`: remembers up to 12 recent views for two minutes, in memory only, keyed by community and query. The server's answer always replaces them. Actions that change visibility (delete, block, mute, friendship, audience) and authentication failures clear them.
- `lib/social/use-arrivals.ts`: animates `[data-arrive-id]` items when they first appear.
- `components/polis/motion.css`: tokens, transition keyframes, touch feedback, skeletons, map, dialogs.

## Verification

- `npm run lint` (0 errors, the 7 inherited warnings), `npm run typecheck`, `npm run build`, `npm test` (77): pass.
- New `npm run test:motion-browser` (`scripts/verify-motion-browser.mjs`, local-only synthetic accounts `motion_a` and `motion_b`) checks:
  - forward cross-fade, card morph with its container transform, and the instant conversation header while reads are delayed;
  - a new reply's arrival animation;
  - back returning to the remembered Commons within 300 ms without skeletons;
  - fragment links animating forward, and in-page tabs not transitioning;
  - a reaction showing within 80 ms, other controls not dimming, and rollback on a synthetic 500;
  - interrupting a transition, which must not raise errors, and a newer navigation winning over an older one (both steps fail without the fixes below);
  - the phone back swipe;
  - reduced motion: no transitions and no pops;
  - no page errors or horizontal overflow at 1280 px and 390 px.
- Frames were captured mid-transition in headless Chromium at 1280 and 390 px and inspected. Frame pacing during transitions had at most two frames over 34 ms, both coinciding with screenshot capture.

Verification found and fixed two intermittent failures:

- A tap or newer navigation that skipped a transition before its first frame left `AbortError: Transition was skipped` unhandled. That opened the dev error overlay locally and would log a console error in production. Skipped transitions are now expected, while a failing update still surfaces.
- A navigation started just before another one (for example right after sign-up) could land late and overwrite the newer URL, because its URL change waited for the transition. The URL now changes at once, and the view commits from whatever the URL is when the transition runs.

Both have steps in `test:motion-browser` that fail without their fix.

## Known limits

- View Transitions need Chrome/Edge 111+, Safari 18+ or Firefox 144+. Other browsers change views instantly.
- Real-device testing (iOS Safari swipe-back, Android Chrome), a screen-reader pass on transitions, and hosted performance have not been done.
