# SVB templates — v280 (2026-11-24)

SVB is the new four-drawer right wall. SVB 4x4 retains the previous catalog and photograph. Both types are selectable for units, audits and administration reference. No stock, device permission or historical record migration is performed.

## Existing work

A template pin is persisted per lot/unit/guard/vehicle. Any existing zone draft or submitted marker pins that checklist to the legacy 4x4 right wall. Old keys and answer values remain untouched, including empty or malformed stored drafts. A corrupt template pin fails closed. The next guard has a distinct pin. Existing audit catalog snapshots, answers and notes are not regenerated on resume. Old audit type `SVB` is displayed with the legacy photo when its catalog lacks normal drawer 7.

Known Lot 5 vehicle IDs select normal (5439, 5517, 5413) or 4x4 (5538, 5440, 5441, 5527) for NEW unit checklists. In Olot G451/G452/G453 default to 4x4 unless a known normal replacement vehicle is selected. Other lots retain the explicit selection. Begun reviews take precedence over these defaults.

## Validation

- 327 Node regression tests passed.
- Production Vite build passed (existing large-chunk warning).
- Isolated Edge mobile browser tests: normal and legacy unit photographs/markers, answer persistence after reload, full review with an incidence, simulated 503, identical retry payload and confirmed receipt.
- Isolated audit browser tests: both type selectors, correct photographs/markers, marking an incidence and observation, close/resume and reload/resume with byte-identical stored draft.
- No test submission was sent to production; server responses in browser submission tests were mocked.
- User confirmed both readiness flags true after running sql/svb-variants-v1.sql in production.

## Deployment

Users must receive v280 (online reload) before the new template can be used; an offline phone with an older cached version cannot be guaranteed to update by a particular time. Do not clear application data or reauthorize a device to update it.
