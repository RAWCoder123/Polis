import { flushSync } from "react-dom";
import { morphSource, transition } from "../motion";

// The app's hash route as an external store. Changes are committed inside a
// view transition, so the page can animate between the old and new views.
let href = "";
let pending = "";
const listeners = new Set<() => void>();
// Each history entry records its position, so traversal direction is known:
// fragment links fire popstate too, and must not animate as "back".
let position = 0;
const entryIndex = (): number | null =>
  typeof history.state?.polisIndex === "number" ? history.state.polisIndex : null;
// Next.js marks the history entries it can restore (`__NA` and its page tree)
// and reloads the page when Back reaches an entry without that mark. Fragment
// links create unmarked entries; every Polis view is the same Next.js page, so
// they carry the mark of the entries before them. Marked entries also keep the
// Next.js router out of hash-only navigation, which it would otherwise replay
// later, putting an older URL back over a newer one.
let nextMark: Record<string, unknown> = {};
function marked(state: Record<string, unknown> | null) {
  if (state?.__NA) nextMark = { __NA: state.__NA, __PRIVATE_NEXTJS_INTERNALS_TREE: state.__PRIVATE_NEXTJS_INTERNALS_TREE };
  return { ...nextMark, ...state };
}
function stampEntry() {
  history.replaceState({ ...marked(history.state), polisIndex: ++position }, "");
}

function commit() {
  href = location.href;
  pending = "";
  for (const listener of listeners) listener();
}

// Tabs and filters within one page change in place, without a page transition.
function pageKey(url: string) {
  const hash = new URL(url).hash.slice(1) || "home";
  const [view, id] = new URL(hash, "https://polis.invalid/").pathname.slice(1).split("/");
  return view === "commons" ? view : view + "/" + (id ?? "");
}

function onLocation(event: Event) {
  const next = location.href;
  if (next === href || next === pending) return;
  // Programmatic updates (search refinements) and back swipes the browser has
  // already animated apply at once.
  const animated = (event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition;
  if (!event.isTrusted || animated || pageKey(next) === pageKey(href)) {
    const index = entryIndex();
    if (index === null) stampEntry();
    else position = index;
    commit();
    return;
  }
  const index = entryIndex();
  let back = false;
  if (index === null) stampEntry();
  else {
    back = index < position;
    position = index;
  }
  pending = next;
  transition(back ? "back" : "forward", () => flushSync(commit), back ? null : morphSource());
}

export function subscribeRoute(listener: () => void) {
  if (!listeners.size) {
    addEventListener("popstate", onLocation);
    addEventListener("hashchange", onLocation);
  }
  listeners.add(listener);
  href = location.href;
  const index = entryIndex();
  if (index === null) history.replaceState({ ...marked(history.state), polisIndex: position }, "");
  else {
    marked(history.state);
    position = index;
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      removeEventListener("popstate", onLocation);
      removeEventListener("hashchange", onLocation);
    }
  };
}

export const routeHref = () => href || location.href;

// Navigates to a hash route. A tapped card or chip marked [data-morph] grows
// into the new page; other navigations cross-fade forward. The URL changes at
// once, so a newer navigation always wins; the view commits inside the
// transition from whatever the URL is by then.
export function navigateTo(hash: string, onCommit?: () => void, options: { preserveScroll?: boolean } = {}) {
  const from = morphSource();
  const oldURL = location.href;
  history.pushState({ ...marked(history.state), polisIndex: ++position }, "", hash);
  const newURL = location.href;
  const apply = () => {
    if (!options.preserveScroll) scrollTo({ top: 0, behavior: "instant" });
    flushSync(() => {
      commit();
      onCommit?.();
    });
    // Other listeners (the signed-out home) still hear about the new hash.
    dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL }));
  };
  if (pageKey(newURL) === pageKey(href || oldURL)) apply();
  else transition(from ? "morph" : "forward", apply, from);
}
