# Explainers

Polis explains laws, proposals, documents and local processes in plain language, because the originals are hard to read. Explainers appear at the top of an item's page and, one a day, on Home ("Explained today").

Each explainer answers the same questions, in this order:

| Section | Field | Guidance |
| --- | --- | --- |
| In short | `inShort` | One or two sentences a busy reader can repeat to a friend. No jargon. |
| What would change | `changes` (+ optional `changesLabel`) | Concrete effects, one per bullet. Numbers and dates from the source. |
| Who it affects | `affects` | The people and bodies touched by it. |
| Where it stands | `stage` | Where the decision is now, and what makes it final. |
| What happens next | `next` | The next step, when, and **how a reader can weigh in** (the logistics), with an official link. |
| Words to know | `terms` | Short definitions of the terms a reader will meet in the original. |
| Sources | `sources`, `checkedAt` | Every claim must come from a listed source. Date the check. |

## Rules

- Write only from sources you have read; link every one. If a fact is not in a source, leave it out.
- Say where a decision stands, and what still has to happen, without predicting outcomes or taking sides.
- Sample proposals get Sample explainers: start `inShort` with "Sample:" and say it is an illustration. Tests enforce this.
- Re-check real explainers when the decision moves, and update `checkedAt`.

## Where they live

- `lib/social/civic/explainers.ts`: the explainers, keyed by catalog entity id, and the "How a local decision gets made" guide every community gets (kind `guide`).
- `components/polis/explainer.tsx`: the page card and the Home card.
- `tests/explainers.test.ts`: attachment, sources, Sample labelling, the guide and the daily rotation.

Real explainers today: the Ratepayer Protection Act (H.R. 9340, Cornell and UF) and UF's fall 2026 bus changes. TCAT's fall 2026 notice could not be retrieved for checking, so it has no explainer yet.
