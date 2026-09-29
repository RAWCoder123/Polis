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

## Campus civic extension (September 26, 2026)

Extends, not replaces, the system above. Styles live in `components/polis/civic.css`.

- **Entity visuals.** Offices and bodies use navy seal monograms (no synthetic headshots); proposals and briefs use paper tiles with a folded corner; buildings, places, organizations and meetings use soft tinted icon tiles (slate, green, violet, amber). Licensed photos replace tiles when an `imageUrl` is supplied.
- **Map pins.** White discs with a colored ring by layer: navy people & offices (filled), slate government & voting, cobalt campus, amber issues & projects, green community, warm orange events. Sample entries carry a small dashed dot. Pins sharing a spot fan out. The basemap is desaturated so civic markers lead.
- **Perspectives.** Teal, sage, ochre, slate and pale gray — never red versus blue. Party affiliation appears only when supplied from a checked source.
- **Commons cards.** Georgia titles, an "About" row of rounded entity chips, four compact reactions (icon-only below 520 px), participant counts. Starter questions use a pale-cobalt card with a perspective bar.
- **Layout.** Home and Map use a 1240 px wide layout; Home has a 330 px side column that stacks under 1100 px. Mobile navigation: Home, Commons, Map, Friends, Profile (Rankings is on the profile and desktop sidebar).

## Motion (September 27, 2026)

Motion follows the launch film and extends, not replaces, the system above. See [docs/motion.md](docs/motion.md).

- **Curves.** smooth `cubic-bezier(.45,.05,.25,1)` for general UI; out `(.16,1,.3,1)` for arrivals; in `(.55,0,.85,.35)` for departures; in-out `(.65,0,.35,1)` for swipes; container `(.45,0,.15,1)` for card-to-page transforms. Springs are sampled into CSS `linear()`.
- **Durations.** 0.18 s for touch feedback, 0.34–0.56 s for page changes, 0.74 s for container transforms, 0.6 s for phone back swipes.
- **Rules.** The rail, header and tab bar never move during page changes. Only transform, opacity, clip-path and arrival height animate. A tap finishes a running transition. Reduced motion removes all of it.

## Reviewed social milestone (September 27, 2026)

Preserve the existing white/cobalt/navy system. Commons uses title-first rows, Local/National scopes, explicit Following and recency controls, and compact contribution buttons. Topics and introductory guidance sit below conversations on mobile. Existing tab routes remain compatible.

Maps use bundled OSM-derived outlines, with ODbL attribution, original geographic venue coordinates, anchored previews and an independent list. Initials indicate permitted friends’ shared plans at event venues, never present location. Several occurrences at one venue remain individually selectable. Photos identify sourced events and verified officials; source credits are visible and missing images fall back to icons or initials.

## Map (September 28, 2026)

Supersedes the desaturated raster basemap above; pin colors by layer are unchanged. See [docs/map.md](docs/map.md).

- **Basemap.** Bright and simplified, in the spirit of Snap Map: warm paper land `#f6f3ec`, pastel parks `#c6ecb0`, water `#8ecff5`, white streets with butter-yellow main roads, soft lavender 3D buildings (`#efeaf5`–`#c8d2f5` by height), hill shading. Labels in navy and slate with white halos; neighbourhoods in spaced capitals; civic buildings in muted violet. No POI icons or shields.
- **Camera.** Opens tilted (about 60° on the Map tab, 52° in previews) and turned slightly; street level for *Use my location* is zoom 16.4.
- **Markers.** White discs with the layer ring and a small pointer; count bubbles are white pills with layer dots; friends' initials are cobalt discs. Markers drop in on the film's bouncy spring, lift on hover, and shrink slightly toward the horizon. The location dot is cobalt with a soft pulse.
- **Phones.** The Map tab drops its description and gives the map most of the screen; Home's glance cards become one swipeable row. Credits fold into the ⓘ button after a few seconds.

## Color (September 29, 2026)

Extends the system above; cobalt stays the color of actions. See `lib/colors.ts`.

- **News by kind.** Safety red `#e03131`, housing orange `#f76707`, money and jobs green `#2b8a3e`, rights and speech violet `#7048e8`, health pink `#d6336c`, campus cobalt `#3659e3`, getting around teal `#0ca678`, government indigo `#364fc7`, weather blue `#1c7ed6`, culture and sports amber `#f59f00`, opinion and other slate `#5c6b82`. News cards carry a colored band; story pages a colored banner.
- **Places and offices by type.** Buildings indigo-violet, places green, organizations purple, institutions slate-blue, meetings orange, proposals orange, projects amber, guides teal, issues and questions cobalt. Item pages open with a banner in their color; tiles, chips and rows are tinted to match.
- **Party.** An official's banner, ring, map pin and badge use Republican red `#d9363e` or Democrat blue `#2563eb` (independents purple) only when a checked source supplies the party. This refines the rule above: members' perspectives still never use red versus blue, and Polis never assigns anyone a political identity.
- **Map.** Brighter than September 28: stronger water `#62c3f5` and greens, lavender campus land, peach commercial blocks, and buildings shading from pink through lilac to sky blue as they rise.

