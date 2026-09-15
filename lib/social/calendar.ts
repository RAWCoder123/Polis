import type { CivicItem } from "../polis-data.ts";
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
