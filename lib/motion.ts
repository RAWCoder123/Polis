// Motion for the Polis app, taken from the launch film
// (marketing/launch-video/src/engine.js and timeline.js): the same curves,
// springs and durations, applied to real navigation and interactions.
// Everything is progressive: without the View Transitions API, or when the
// viewer prefers reduced motion, the app changes instantly as before.

export const ease = {
  smooth: "cubic-bezier(0.45, 0.05, 0.25, 1)", // general UI
  out: "cubic-bezier(0.16, 1, 0.3, 1)", // arrivals
  in: "cubic-bezier(0.55, 0, 0.85, 0.35)", // departures
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)", // camera, scroll, swipes
  container: "cubic-bezier(0.45, 0, 0.15, 1)", // container transforms
  // Under-damped springs sampled from the film's spring(freq, damping).
  spring:
    "linear(0, 0.05, 0.171, 0.328, 0.494, 0.65, 0.785, 0.894, 0.975, 1.031, 1.064, 1.08, 1.083, 1.078, 1.067, 1.053, 1.039, 1.027, 1.016, 1.007, 1.001, 0.997, 0.994, 0.993, 0.993, 0.994, 0.995, 0.996, 1)",
  springSnappy:
    "linear(0, 0.051, 0.176, 0.34, 0.516, 0.684, 0.829, 0.945, 1.031, 1.086, 1.117, 1.126, 1.121, 1.106, 1.085, 1.063, 1.042, 1.023, 1.008, 0.997, 0.99, 0.985, 0.984, 0.985, 0.986, 0.989, 0.992, 0.995, 1)",
};

export function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A toggle being switched on: the icon pops like the film's reaction and
// follow taps (scale up with a slight turn, then settle on a spring).
export function pop(target: Element | null | undefined) {
  if (!target || reducedMotion() || typeof (target as HTMLElement).animate !== "function") return;
  (target as HTMLElement).animate(
    [
      { transform: "scale(1) rotate(0deg)" },
      { transform: "scale(1.28) rotate(-8deg)", offset: 0.3 },
      { transform: "scale(1) rotate(0deg)" },
    ],
    { duration: 460, easing: ease.smooth },
  );
}
// A toggle being switched off settles back instead of popping.
export function settle(target: Element | null | undefined) {
  if (!target || reducedMotion() || typeof (target as HTMLElement).animate !== "function") return;
  (target as HTMLElement).animate([{ transform: "scale(0.86)" }, { transform: "scale(1)" }], { duration: 504, easing: ease.springSnappy });
}

// ---------------------------------------------------------------------------
// Page transitions

export type TransitionKind = "forward" | "back" | "morph";
type ViewTransitionLike = { finished: Promise<void>; updateCallbackDone: Promise<void>; skipTransition(): void };
type StartViewTransition = (update: () => void) => ViewTransitionLike;

let active: ViewTransitionLike | null = null;
let interruptBound = false;

const px = (n: number) => Math.round(n * 10) / 10 + "px";

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

// The film's container transform: the tapped card grows into the content area
// while the destination is revealed inside it and the old page recedes.
function morphStyles(from: HTMLElement) {
  const r = from.getBoundingClientRect();
  const cs = getComputedStyle(from);
  const radius = parseFloat(cs.borderTopLeftRadius) || 12;
  const bg = cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ? cs.backgroundColor : "#fff";
  const body = document.querySelector(".social-body")?.getBoundingClientRect();
  const topbar = document.querySelector<HTMLElement>(".social-topbar");
  const tabbar = document.querySelector<HTMLElement>(".social-mobile-nav");
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const left = Math.max(0, body?.left ?? 0);
  const top = topbar ? topbar.offsetHeight : 0;
  const bottom = tabbar && getComputedStyle(tabbar).display !== "none" ? tabbar.offsetHeight : 0;
  const to = { x: left, y: top, w: vw - left, h: vh - top - bottom };
  const inset = (x: number, y: number, w: number, h: number, round: number) =>
    `inset(${px(y)} ${px(vw - x - w)} ${px(vh - y - h)} ${px(x)} round ${px(round)})`;
  return `
::view-transition-group(polis-morph) {
  animation: polis-morph-box .74s ${ease.container} both;
  overflow: clip;
}
@keyframes polis-morph-box {
  from { transform: translate(${px(r.left)}, ${px(r.top)}); width: ${px(r.width)}; height: ${px(r.height)};
    border-radius: ${px(radius)}; background-color: ${bg}; box-shadow: 0 10px 30px rgba(23, 35, 59, .1); }
  38% { background-color: ${bg}; }
  to { transform: translate(${px(to.x)}, ${px(to.y)}); width: ${px(to.w)}; height: ${px(to.h)};
    border-radius: 0; background-color: rgba(255, 255, 255, 0); box-shadow: 0 0 0 rgba(23, 35, 59, 0); }
}
::view-transition-old(polis-morph) {
  inline-size: ${px(r.width)}; block-size: ${px(r.height)};
  animation: polis-morph-content .74s linear both;
}
html[data-vt="morph"]::view-transition-new(root) {
  animation: polis-morph-reveal .74s ${ease.container} both, polis-morph-fade .74s ${ease.smooth} both;
}
@keyframes polis-morph-reveal {
  from { clip-path: ${inset(r.left, r.top, r.width, r.height, radius)}; }
  to { clip-path: ${inset(to.x, to.y, to.w, to.h, 0)}; }
}`;
}

// Runs a DOM update (which must apply synchronously) inside a view transition.
export function transition(kind: TransitionKind, update: () => void, from?: HTMLElement | null) {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  if (!start || reducedMotion() || document.visibilityState !== "visible") {
    update();
    return;
  }
  active?.skipTransition();
  const root = document.documentElement;
  const named: HTMLElement[] = [];
  const name = (el: HTMLElement, n: string) => {
    el.style.setProperty("view-transition-name", n);
    named.push(el);
  };
  // Persistent chrome stays put and only cross-fades its active states.
  document.querySelectorAll<HTMLElement>("[data-vt-name]").forEach((el) => {
    if (visible(el)) name(el, el.dataset.vtName!);
  });
  let dynamic: HTMLStyleElement | null = null;
  const source = kind === "morph" && from && visible(from) && from.getBoundingClientRect().height < innerHeight * 1.5 ? from : null;
  if (source) {
    dynamic = document.createElement("style");
    dynamic.textContent = morphStyles(source);
    document.head.appendChild(dynamic);
    name(source, "polis-morph");
  }
  root.dataset.vt = source ? "morph" : kind === "morph" ? "forward" : kind;
  const cleanup = () => {
    named.forEach((el) => el.style.removeProperty("view-transition-name"));
    dynamic?.remove();
    if (active === vt) {
      delete root.dataset.vt;
      active = null;
    }
  };
  const vt = start.call(document, () => {
    // The old state is captured; the source must not be matched in the new one.
    source?.style.removeProperty("view-transition-name");
    update();
  });
  active = vt;
  vt.finished.then(cleanup, cleanup);
  // A tap or key press during a transition finishes it at once, so the page is
  // never unresponsive while it animates.
  if (!interruptBound) {
    interruptBound = true;
    const interrupt = () => active?.skipTransition();
    addEventListener("pointerdown", interrupt, true);
    addEventListener("keydown", interrupt, true);
  }
}

// The element a navigation should grow from: the nearest [data-morph]
// container of the control that was just activated, unless it opts out.
let lastActivation: { el: Element; at: number } | null = null;
if (typeof window !== "undefined")
  addEventListener(
    "click",
    (e) => {
      if (e.target instanceof Element) lastActivation = { el: e.target, at: performance.now() };
    },
    true,
  );
export function morphSource(): HTMLElement | null {
  if (!lastActivation || performance.now() - lastActivation.at > 400) return null;
  const el = lastActivation.el.closest<HTMLElement>("[data-morph]");
  lastActivation = null;
  return el && el.dataset.morph !== "none" ? el : null;
}

// ---------------------------------------------------------------------------
// Arrivals

// Content that loads after its page is on screen rises into place with a
// short stagger, like the film's feed and replies.
export function rise(el: HTMLElement, index = 0) {
  if (reducedMotion() || typeof el.animate !== "function") return;
  el.animate(
    [
      { opacity: 0, transform: "translateY(14px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 520, delay: Math.min(index, 8) * 40, easing: ease.out, fill: "backwards" },
  );
}

// An item joining a list that is already on screen opens its own space, so
// nothing below it jumps; a single live arrival is briefly highlighted.
export function expandIn(el: HTMLElement, index = 0, highlight = false) {
  if (reducedMotion() || typeof el.animate !== "function") return;
  const cs = getComputedStyle(el);
  const delay = Math.min(index, 8) * 60;
  el.animate(
    [
      { height: "0px", paddingTop: "0px", paddingBottom: "0px", marginTop: "0px", marginBottom: "0px", overflow: "hidden" },
      { height: el.offsetHeight + "px", paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom, overflow: "hidden" },
    ],
    { duration: 550, delay, easing: ease.out, fill: "backwards" },
  );
  el.animate(
    [
      { opacity: 0, transform: "translateY(14px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 440, delay: delay + 60, easing: ease.smooth, fill: "backwards" },
  );
  if (highlight)
    el.animate(
      [{ boxShadow: "inset 0 0 0 999px rgba(238, 242, 255, 1)" }, { boxShadow: "inset 0 0 0 999px rgba(238, 242, 255, 1)", offset: 0.4 }, { boxShadow: "inset 0 0 0 999px rgba(238, 242, 255, 0)" }],
      { duration: 2400, delay, easing: ease.smooth },
    );
}

// Toggles marked [data-pop] (follow, save, going) pop when switched on.
if (typeof window !== "undefined")
  addEventListener("click", (e) => {
    const button = e.target instanceof Element ? e.target.closest<HTMLElement>("button[data-pop]") : null;
    if (!button || (button as HTMLButtonElement).disabled) return;
    const icon = button.querySelector("svg");
    if (button.getAttribute("aria-pressed") === "true") settle(icon);
    else pop(icon);
  });
