# Polis MVP visual specification

Primary reference: 1476×1066 concept generated for this task, exec-c387e5e3-ad99-4605-b15e-4683f0a0cb86.png.

- White canvas, cool gray inputs, cobalt #3659e3, navy #17233b, fine #e5eaf2 dividers.
- Desktop: 232px left rail, 80px header, 32px gutters, open editorial center, 386px event content rail at the concept viewport.
- Editorial serif headings; sans serif controls. Main copy 16px, labels 14px, metadata 12–13px.
- Primary copy: polis; Discover; Explore map; My rankings; Friends; My profile; Search your community; Ithaca, NY; Add a ranking; Your community, in focus.; A little more informed. A lot more connected.; For you; Policies; News; Politicians; Events; More homes. More possibilities.; Rank this policy; Around the corner; Explore the map; This week; Your civic passport; The conversation around you.
- One standalone generated college-town street photograph, no overlay. Explicitly illustrative.
- Lucide outline icons; initials replace synthetic headshots for sample people.
- Code-native schematic map with interactive pins; explicitly illustrative, no location tracking.
- Installed primitives: sidebar, tabs, dialog, sheet, slider, select, switch, sonner. Reusable rows, scores, avatars and date tiles.
- Views: discovery; map and list filters; rankings with scores and pairwise ordering; sample friends; personal profile, saved items and plans.
- Device-local demo state. No real publication, bookings, location sharing, external messages, or inferred political preferences.
- Required extensions: detail sheet, rating flow, comparisons, edit profile, filtering, audience preview, mobile navigation.
- Concept corrections: September 2026 dates; fictional source attribution; viewer rankings start empty; explicit sample content. News scores measure usefulness, never truth.


## Verification record

The concept and final browser screenshot were directly inspected with view_image.
Desktop: native 1476×1066 iframe viewport (1461px usable content with the browser scrollbar).
Mobile: 390×844 iframe viewport (375px usable content). The browser surface has no viewport-resizing API, so temporary same-origin iframe routes supplied the exact CSS viewport dimensions. Those routes were removed before publication. The ordinary browser viewport was also checked at 1348×936.

Comparison points:
1. Layout: restored 232px navigation rail and enlarged event rail to match the primary reference's three-column proportions.
2. Typography: enlarged editorial headings and recurring secondary labels; retained serif headlines and sans-serif controls.
3. Palette: white background, cobalt actions, navy text, pale blue selection and fine dividers were checked.
4. Media: original standalone generated street photograph retains the concept's unoverlaid horizontal editorial role. Its actual scene differs intentionally.
5. Containers: the feature and friend feed remain open rows; map and passport use the reference's restrained framing.
6. Icons: native outlined icons and simple wordmark mark; sample avatars intentionally use initials.
7. Responsive behavior: bottom navigation, wrapping headings, readable dialogs and a stacked map list were checked with no horizontal document overflow.
8. Copy: the required primary labels are present. Intentional corrections are fictional bylines, correct September 2026 weekdays, sample-content notices, and an accurate count of three pictured sample friends. Extra lower items expose the requested policy and politician workflows.

Functional checks passed: first rating and note; disabled save before choosing a score; a second rating and pairwise priority comparison; order and notes after refresh; search results and empty search; text copying; linked news-to-event details; adding a demo plan; map category filtering; mobile navigation; profile plans; following a sample friend; saved news appearing in the profile. The final browser console check showed no application errors. A transient pre-fix module-load error was resolved before these checks.

Known scope: fictional sample data, schematic geographic placements, local browser storage, audience previews, and demo friends. No live data ingestion or multi-user backend is claimed.
