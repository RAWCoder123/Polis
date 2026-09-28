import { useLayoutEffect, useRef, type RefObject } from "react";
import { expandIn, rise } from "../motion";

// Animates items marked [data-arrive-id] inside a container when they first
// appear. A list that loads after its page is shown rises in; items that join
// a list already on screen (new replies, new posts, a next page) expand into
// place. Lists shown at once, such as a view you return to, do not animate.
export function useArrivals(container: RefObject<HTMLElement | null>, scope: string) {
  const state = useRef<{ scope: string; seen: Set<string> | null; empty: boolean; since: number }>({
    scope: "",
    seen: null,
    empty: false,
    since: 0,
  });
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const s = state.current;
    if (s.scope !== scope) Object.assign(s, { scope, seen: null, empty: false, since: performance.now() });
    const items = [...root.querySelectorAll<HTMLElement>("[data-arrive-id]")];
    if (!items.length) {
      s.empty = true;
      return;
    }
    if (!s.seen) {
      s.seen = new Set(items.map((el) => el.dataset.arriveId!));
      if (s.empty) items.slice(0, 10).forEach((el, i) => rise(el, i));
      return;
    }
    const fresh = items.filter((el) => !s.seen!.has(el.dataset.arriveId!));
    if (!fresh.length) return;
    fresh.forEach((el) => s.seen!.add(el.dataset.arriveId!));
    const live = fresh.length <= 2 && performance.now() - s.since > 1500;
    fresh.slice(0, 10).forEach((el, i) => expandIn(el, i, live));
  });
}
