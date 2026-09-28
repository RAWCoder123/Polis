import type { CivicItem } from "../polis-data.ts";
import type { CommunityEvent } from "./types.ts";
import { eventStart, eventEnd } from "./catalog.ts";

// RFC 5545 sections 3.1 and 3.3.11: fold by UTF-8 octets and escape TEXT.
// https://www.rfc-editor.org/rfc/rfc5545
const escapeText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = "",
    width = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (width + bytes > 75) {
      result += "\r\n ";
      width = 1;
    }
    result += char;
    width += bytes;
  }
  return result;
}
export function communityEventCalendar(
  event: CommunityEvent,
  generatedAt = new Date(),
) {
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Polis//Community Events//EN",
    "BEGIN:VEVENT",
    "UID:" + event.id + "@polis.community",
    "DTSTAMP:" + stamp(generatedAt.toISOString()),
    "DTSTART:" + stamp(event.startsAt),
    ...(event.endsAt ? ["DTEND:" + stamp(event.endsAt)] : []),
    "SUMMARY:" + escapeText((event.sample ? "SAMPLE — " : "") + event.title),
    "LOCATION:" +
      escapeText([event.venue, event.address].filter(Boolean).join(", ")),
    "DESCRIPTION:" +
      escapeText(
        event.description +
          "\nOriginal timezone: " +
          event.timezone +
          "\n" +
          (event.registration ||
            "Check the organizer for registration requirements.") +
          "\nSaving this calendar entry does not register you.",
      ),
    // URI properties are not TEXT: percent-encode controls defensively, even
    // for older stored records that predate input validation.
    "URL:" +
      [...event.sourceUrl]
        .map((c) =>
          c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127
            ? encodeURIComponent(c)
            : c,
        )
        .join(""),
    "STATUS:" + (event.status === "canceled" ? "CANCELLED" : "CONFIRMED"),
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
export function sampleEventCalendar(item: CivicItem, generatedAt = new Date()) {
  const start = eventStart(item.id);
  const end = eventEnd(item.id);
  if (!item.event || !start)
    throw new Error("This event has no calendar date.");
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Polis//Sample Civic Events//EN",
    "BEGIN:VEVENT",
    "UID:sample-" + item.id + "@polis.invalid",
    "DTSTAMP:" + stamp(generatedAt),
    "DTSTART:" + stamp(new Date(start)),
    ...(end ? ["DTEND:" + stamp(new Date(end))] : []),
    "SUMMARY:" + escapeText("SAMPLE — " + item.title),
    "LOCATION:" + escapeText(item.event.place + " (illustrative location)"),
    "DESCRIPTION:" +
      escapeText(
        "Fictional Polis sample. This is not a real event or registration. Cost is unknown. Original time zone: America/New_York.\n\n" +
          item.summary,
      ),
    "STATUS:TENTATIVE",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
