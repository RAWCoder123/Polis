"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MapPin,
  Plus,
  Minus,
  RotateCcw,
  Maximize,
  Check,
  Hand,
} from "lucide-react";
import { items, type CivicItem } from "@/lib/polis-data";
import { Avatar } from "./common";
import {
  initialCamera,
  constrainCamera,
  fitCamera,
  panCamera,
  zoomCamera,
  worldSize,
  type Camera,
  type MapSize,
} from "@/lib/map-camera";

function MapBase() {
  const blocks = Array.from({ length: 108 }, (_, i) => ({
    x: 208 + (i % 9) * 49,
    y: 26 + Math.floor(i / 9) * 55,
    w: 34 + (i % 3) * 3,
    h: 38 + (i % 2) * 3,
  }));
  return (
    <svg
      className="map-base"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="800" height="800" fill="#e9eee9" />
      <path
        d="M0 0H248L215 98 167 167 178 246 137 288 96 341 0 321Z"
        fill="#b7dbef"
      />
      <path
        d="M63 298C160 328 122 422 163 512S262 651 346 661 448 608 528 663 645 706 708 682 769 713 827 756"
        fill="none"
        stroke="#b7dbef"
        strokeWidth="21"
      />
      <path
        d="M84 284C169 342 153 416 183 484S289 626 351 637 439 590 534 644 651 684 712 659 781 693 827 733"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
      />
      <path d="M10 345 70 318 105 388 112 480 61 541 8 480Z" fill="#c9e1c8" />
      <path d="M593 0H800V278L740 305 666 259 617 158Z" fill="#d2e5cd" />
      <path
        d="M494 697 542 678 619 733 709 710 797 754V800H511Z"
        fill="#c9e1c8"
      />
      {blocks.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="2"
          fill={i % 13 === 0 ? "#d0e3cf" : "#e2e5e2"}
          stroke="#fafcfb"
          strokeWidth="3"
        />
      ))}
      <g fill="none" stroke="#fff" strokeWidth="9">
        <path d="M194 0 187 147 202 320 196 480 201 650" />
        <path d="M383 0V613" />
        <path d="M538 0V631" />
        <path d="M192 289H800" />
        <path d="M176 450H788" />
        <path d="M228 569 403 569 558 532 800 493" />
        <path d="M9 666 209 650 355 670 457 623 687 406 800 357" />
        <path d="M655 0 649 249 734 416 800 525" />
        <path d="M800 106 695 207 637 297 715 458 786 579" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="4">
        <path d="M300 0V630" />
        <path d="M438 0V625" />
        <path d="M586 0V560" />
        <path d="M196 125H659" />
        <path d="M193 344H746" />
        <path d="M199 396H726" />
        <path d="M15 606H478" />
        <path d="M268 660V800" />
        <path d="M375 661 420 800" />
        <path d="M481 648 572 800" />
      </g>
      <g fontFamily="Arial,sans-serif" textAnchor="middle">
        <text x="88" y="92" fontSize="23" fill="#478aab" fontStyle="italic">
          Cayuga Lake
        </text>
        <text x="77" y="427" fontSize="21" fill="#598569">
          Stewart Park
        </text>
        <text x="700" y="188" fontSize="21" fill="#7b8c79">
          Cornell
        </text>
        <text x="700" y="218" fontSize="21" fill="#7b8c79">
          University
        </text>
        <text
          x="442"
          y="405"
          fontSize="37"
          fontWeight="600"
          letterSpacing="1"
          fill="#798381"
        >
          Ithaca
        </text>
        <text x="703" y="558" fontSize="18" fill="#89938b">
          COLLEGETOWN
        </text>
        <text x="364" y="233" fontSize="17" fill="#90998f">
          FALL CREEK
        </text>
        <text x="428" y="520" fontSize="17" fill="#89938b">
          DOWNTOWN
        </text>
        <text x="611" y="756" fontSize="21" fill="#598569" fontStyle="italic">
          Six Mile Creek
        </text>
      </g>
    </svg>
  );
}
export default function CommunityMap({
  compact = false,
  visibleItems = items.filter((i) => i.event),
  selected,
  onSelect,
  showFriends = true,
  following = [],
  participants,
  plannedIds = [],
  focusRequest = 0,
}: {
  compact?: boolean;
  visibleItems?: CivicItem[];
  selected?: string;
  onSelect: (item: CivicItem) => void;
  showFriends?: boolean;
  following?: string[];
  participants?: Record<string, { name: string; initials: string }[]>;
  plannedIds?: string[];
  focusRequest?: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const [size, setSize] = useState<MapSize>({ width: 400, height: 400 });
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const points = visibleItems
    .filter((i) => i.event)
    .map((i) => ({ x: i.event!.x / 100, y: i.event!.y / 100 }));
  const pointKey = points.map((p) => p.x + "," + p.y).join("|");
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const coordinates = pointKey
      .split("|")
      .filter(Boolean)
      .map((p) => {
        const [x, y] = p.split(",").map(Number);
        return { x, y };
      });
    // Refitting responds to external viewport and result changes, keeping every marker reachable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCamera(fitCamera(coordinates, size));
  }, [pointKey, size]);
  const focusedItem = visibleItems.find((i) => i.id === selected);
  useEffect(() => {
    if (!focusedItem?.event || compact) return;
    const { x, y } = focusedItem.event;
    // List selection recenters the selected map location without changing scale.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCamera((c) => constrainCamera({ ...c, x: x / 100, y: y / 100 }, size));
  }, [focusedItem, size, compact, focusRequest]);
  const safeCamera = constrainCamera(camera, size),
    side = worldSize(size);
  const localPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      compact ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    viewport.current?.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, localPoint(event));
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const before = [...pointers.current.values()];
    const next = localPoint(event);
    pointers.current.set(event.pointerId, next);
    const after = [...pointers.current.values()];
    if (before.length === 2 && after.length === 2) {
      const distance = (p: { x: number; y: number }[]) =>
        Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      const mid = (p: { x: number; y: number }[]) => ({
        x: (p[0].x + p[1].x) / 2,
        y: (p[0].y + p[1].y) / 2,
      });
      const a = mid(before),
        b = mid(after),
        ratio = distance(after) / Math.max(1, distance(before));
      setCamera((c) =>
        panCamera(
          zoomCamera(c, size, c.zoom * ratio, a),
          size,
          b.x - a.x,
          b.y - a.y,
        ),
      );
    } else
      setCamera((c) =>
        panCamera(c, size, next.x - previous.x, next.y - previous.y),
      );
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(pointers.current.size > 0);
  }
  const fit = () => setCamera(fitCamera(points, size));
  return (
    <div
      className={
        "community-map interactive-map " +
        (compact ? "compact-map" : "full-map") +
        (dragging ? " is-dragging" : "")
      }
    >
      <div
        ref={viewport}
        className="map-viewport"
        role="region"
        aria-label={
          compact
            ? "Sample community event map"
            : "Interactive sample event map"
        }
        aria-describedby={compact ? undefined : helpId}
        tabIndex={compact ? undefined : 0}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onLostPointerCapture={pointerUp}
        onDoubleClick={(event) => {
          if (compact || (event.target as HTMLElement).closest("button"))
            return;
          const r = event.currentTarget.getBoundingClientRect();
          setCamera((c) =>
            zoomCamera(c, size, c.zoom + 0.4, {
              x: event.clientX - r.left,
              y: event.clientY - r.top,
            }),
          );
        }}
        onKeyDown={(event) => {
          if (
            compact ||
            event.target !== event.currentTarget ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
          ) return;
          const delta: Record<string, [number, number]> = {
            ArrowLeft: [70, 0],
            ArrowRight: [-70, 0],
            ArrowUp: [0, 70],
            ArrowDown: [0, -70],
          };
          if (delta[event.key]) {
            event.preventDefault();
            const [x, y] = delta[event.key];
            setCamera((c) => panCamera(c, size, x, y));
          } else if (["+", "=", "-", "Home", "Escape"].includes(event.key)) {
            event.preventDefault();
            if (event.key === "Home" || event.key === "Escape") fit();
            else
              setCamera((c) =>
                zoomCamera(
                  c,
                  size,
                  c.zoom + (event.key === "-" ? -0.25 : 0.25),
                ),
              );
          }
        }}
      >
        <div
          className="map-world"
          style={{
            width: side,
            height: side,
            transform: `translate(${size.width / 2 - safeCamera.x * side * safeCamera.zoom}px,${size.height / 2 - safeCamera.y * side * safeCamera.zoom}px) scale(${safeCamera.zoom})`,
          }}
        >
          <MapBase />
          {visibleItems.map(
            (item) =>
              item.event && (
                <button
                  key={item.id}
                  className={
                    "map-pin " +
                    (item.event.type === "Volunteering"
                      ? "orange "
                      : item.event.type === "Meetups"
                        ? "teal "
                        : "") +
                    (selected === item.id ? "selected" : "")
                  }
                  style={{
                    left: item.event.x + "%",
                    top: item.event.y + "%",
                    transform: `translate(-50%,-80%) scale(${1 / safeCamera.zoom})`,
                  }}
                  onClick={() => onSelect(item)}
                  onFocus={() => {
                    const x = item.event!.x / 100,
                      y = item.event!.y / 100;
                    const screenX = size.width / 2 + (x - safeCamera.x) * side * safeCamera.zoom,
                      screenY = size.height / 2 + (y - safeCamera.y) * side * safeCamera.zoom;
                    if (screenX < 50 || screenX > size.width - 50 || screenY < 80 || screenY > size.height - 50)
                      setCamera((c) => constrainCamera({ ...c, x, y }, size));
                  }}
                  aria-label={
                    (compact ? "View " : "Preview ") +
                    item.title +
                    (plannedIds.includes(item.id) ? ", in your plans" : "")
                  }
                  aria-pressed={selected === item.id}
                >
                  <MapPin
                    size={compact ? 36 : 44}
                    fill="currentColor"
                    stroke="white"
                    strokeWidth={1.5}
                  />
                  <span className="pin-dot" />
                  {plannedIds.includes(item.id) ? (
                    <span className="pin-plan">
                      <Check size={11} />
                    </span>
                  ) : (
                    showFriends &&
                    (participants
                      ? !!participants[item.id]?.length
                      : item.event.friends.some((id) =>
                          following.includes(id),
                        )) && (
                      <span className="pin-friend">
                        <Avatar
                          id={
                            participants
                              ? undefined
                              : item.event.friends.find((id) =>
                                  following.includes(id),
                                )
                          }
                          initials={participants?.[item.id]?.[0]?.initials}
                          size="tiny"
                        />
                      </span>
                    )
                  )}
                  {!compact && <span className="pin-label">{item.title}</span>}
                </button>
              ),
          )}
        </div>
      </div>
      {!compact && (
        <>
          <div className="map-key">
            <span>
              <span className="key-dot" />
              Town hall
            </span>
            <span>
              <span className="key-dot orange" />
              Volunteer
            </span>
            <span>
              <span className="key-dot teal" />
              Meetup
            </span>
          </div>
          <div className="map-controls" aria-label="Map controls">
            <button
              className="icon-btn"
              aria-label="Zoom in"
              onClick={() =>
                setCamera((c) => zoomCamera(c, size, c.zoom + 0.25))
              }
              disabled={camera.zoom >= 3}
            >
              <Plus size={19} />
            </button>
            <span className="map-zoom-label" aria-live="polite">
              {Math.round(safeCamera.zoom * 100)}%
            </span>
            <button
              className="icon-btn"
              aria-label="Zoom out"
              onClick={() =>
                setCamera((c) => zoomCamera(c, size, c.zoom - 0.25))
              }
              disabled={camera.zoom <= 1}
            >
              <Minus size={19} />
            </button>
            <button
              className="icon-btn"
              aria-label="Fit all matching events"
              onClick={fit}
            >
              <Maximize size={17} />
            </button>
            <button
              className="icon-btn"
              aria-label="Reset map view"
              onClick={() => setCamera(initialCamera)}
            >
              <RotateCcw size={16} />
            </button>
          </div>
          <span id={helpId} className="map-gesture-help">
            <Hand size={12} /> Drag or pinch · arrows to move · + / − to zoom
          </span>
          {!visibleItems.length && (
            <div className="map-no-results">No events match these filters.</div>
          )}
        </>
      )}
      <span className="map-attribution">
        Illustrative map · Sample locations
      </span>
    </div>
  );
}
