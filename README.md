# Polis

An interactive civic social MVP with an Ithaca demo community.

## Experience

- Rank policies, news, fictional politicians, and sample events.
- Compare items head-to-head, edit scores and notes, reorder lists, and copy lists as text.
- Read linked explainers and policy context; save items for later.
- Explore a schematic event map, filter events, preview friends' RSVPs, and save event plans.
- Follow sample friends, compare explicit shared ratings, edit a local profile, and build a civic passport.

## Data and scope

All people, proposals, candidates, news, events, scores, and geographic placements are illustrative. The generated street photograph depicts a fictional town. No political preferences are preassigned to the viewer.

The demo stores rankings, notes, bookmarks, plans, and profile settings in localStorage on the current browser. Audience controls are previews. There is no multi-user backend, live news ingestion, real booking, outbound messaging, location tracking, or real public posting.

## Development

Use the existing package-lock.json and Sites scripts. The application uses React with the Vinext App Router, installed Radix/Shadcn primitives, Lucide icons, and CSS responsive layouts.

Type check: npx tsc --noEmit. Build: npm run build.

App composition is in components/polis/polis-app.tsx; domain data and local demo state are in lib/polis-data.ts and lib/polis-state.ts.
