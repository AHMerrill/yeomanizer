# the yeomanizer — app

Vite + React 19 + TypeScript. The client-only naval-correspondence formatter. See the
[root README](../README.md) for the product overview and [`../SPEC.md`](../SPEC.md) for the format
rules derived from SECNAV M-5216.5.

## Scripts

    npm run dev      # Vite dev server
    npm test         # vitest — format engine, exports, counter, editor↔preview wiring, layout contract
    npm run lint     # oxlint
    npm run build    # production build → dist/

## Tabs

The app has six tabs (`App.tsx`): **Editor** (drop a saved `.json` to keep working — its own state,
so importing never clobbers the Builder draft), **Builder** (the card-based form, with a starter-template
bar), **Proofread** (the pre-send review + sensitive-data scan; carries a non-blocking "to review"
count badge), **Guide**, **Features**, and **FAQ** (security & CUI, with authoritative references).

The Editor and Builder are the two *editing contexts*: cards, preview, exports, **undo/redo**, and the
Proofread review all follow whichever was last active (`editingState` / `reviewSubject` in `App.tsx`).

## Architecture

- `src/types.ts` — `LetterState`, the single source of truth for a document. Notable: `EnclosureEntry.cuiBanner`
  (a per-enclosure CUI banner — see below), `Paragraph.title` (underlined lead-in) / `.cui` (portion mark).
- `src/format/` — the pure format engine:
  - `paragraphs.ts` — the paragraph ladder, markers & numbering, depth indents.
  - `tree.ts` — the paragraph tree ops: `updateText`/`updateTitle`/`setCui`, `addChild`/`addSiblingAfter`/`remove`,
    `move` (↑/↓), and **`reorder(list, dragId, targetId, 'before'|'after')`** — the drag-to-reorder mutation;
    it is **sibling-only** and a no-op across levels, so a stray cross-level drop changes nothing. Numbering is
    render-driven, so a reorder renumbers automatically.
  - `identification.ts` — ident / reference / date formatting, `remainingVias`, endorsement helpers.
  - `inline.ts` — inline emphasis markup (`**bold**`, `*italic*`, `__underline__`, non-nested, parsed
    identically by every renderer).
  - `proofread.ts` — `proofread(state)` returns data-driven `pass`/`warn` checks on the draft (subject filled
    + ALL CAPS + no trailing period, From/To present, body has content, no lone subparagraph, signature/date set,
    enclosure titles, business-letter inside-address/salutation). Advisory only; grounded in **SECNAV M-5216.5
    Ch 2 ¶19**. The ¶19.b *format* framework is already guaranteed by the engine, so these checks cover what the
    writer supplies.
  - `pii.ts` — `detectPii(state)`: a **local-only** heuristic scan that flags SSN (`nnn-nn-nnnn`), bare 9-digit
    (possible SSN), 10-digit (possible DoD ID / EDIPI — or a phone number), and date-of-birth patterns, tallied
    by where they appear (body, signature, …). Nothing is logged, stored, or transmitted.
- `src/data/` — bundled static reference data:
  - `templates.ts` — `TEMPLATES`: one-click starter examples (appreciation / request / MFR / business) loaded
    into the editor. Placeholders are shown in `[BRACKETS]`; loading one is undoable.
  - `ssic.ts` — `COMMON_SSIC`: a curated, searchable SSIC list (all 13 major groups + common second-level codes).
    **Not** the full ~2,200-code catalog (that's SECNAV M-5210.2); codes are not fabricated.
- `src/components/` — `Editor.tsx` (the card form, shared by the Builder and Editor tabs; hosts the `SsicLookup`
  combobox that filters `COMMON_SSIC` by number *or* keyword and the drag-grip paragraph rows),
  `Checklist.tsx` (the **Proofread** tab — three groups: data-driven draft checks via `proofread`, the
  `detectPii` sensitive-data section, the engine-guaranteed format framework, and the manual `MANUAL` substance
  checkboxes (¶19.c/.d); manual checks are session-only and reset on leaving the tab, by design),
  `LetterPreview.tsx` (the live HTML sheet, the pagination measurer, the fit-to-width scaler, and the per-page
  `EnclosurePage` banner), `About.tsx` (Features), `Guide.tsx`, `Faq.tsx`, `ImportDropZone.tsx`.
- `src/export/` — `signablePdf.ts` (the canonical **vector** PDF via pdf-lib, one AcroForm with a
  `/Sig` CAC field, enclosures copied as real pages, and a per-page CUI banner with a `pageBannerOverride`
  map so enclosure pages can carry their own banner), `docx.ts` (Word — each in-document enclosure is its
  **own Word section** (`ISectionOptions`) with its own header/footer banner), `roundtrip.ts` (the separate
  `.json` project file), `rasterizePdf.ts` (pdf.js → page images for PDF enclosures in the `.docx`).
- `public/sw.js` — a minimal offline service worker (registered in production only, `main.tsx`). Caches **only**
  same-origin GET app assets (cache-first for hashed assets, network-first for HTML so a deploy lands at once);
  POSTs, the `/api/` counter, and any cross-origin request pass straight through and are never cached. It never
  caches user content. `public/site.webmanifest` + `icon-192.png`/`icon-512.png` make it installable.
- `functions/api/count.js` (downloads) + `functions/api/visit.js` (page views) — the content-free
  counters; each stores one integer in Cloudflare KV `COUNTER`, and neither reads the request (no
  IP/region).
- `public/_headers` — the strict CSP and security headers.

## Visual verification (no human in the loop)

Whenever the rendered output changes, verify it by rendering real samples and reading them back —
don't trust "looks plausible":

    GEN_PDF=1 npx vitest run src/export/_render_samples.test.ts   # → /tmp/ynpdf/*.pdf + *.docx

PDFs can be read directly (the reader rasterizes pages). A `.docx` must be converted first
(it's zipped XML):

    soffice --headless --convert-to pdf --outdir /tmp/ynpdf/docxpdf /tmp/ynpdf/*.docx

Then drive the live UI through the preview server for the human loop (reload before evaluating —
HMR can be stale).

## Invariants — do not break

- **Nothing persists or is transmitted** (no storage, no cookies, no external calls; only the two
  content-free integer counters — page loads and download clicks — neither carrying content, cookies, IP, or region).
  Never loosen the CSP or add persistence. The undo/redo history, the per-type drafts, the template loads, the
  PII scan, and the Proofread checkboxes are **all in-memory / session-only** — none of them write to disk.
- **The PII scan and proofread checks are local and advisory.** `detectPii` runs in the browser on the in-memory
  draft — nothing is logged or sent. Neither the scan nor any check ever **blocks** an export; they flag, they
  never gate.
- **The tool makes no classification determination.** It marks exactly what the user enters, including any
  per-enclosure CUI banner. It never decides whether content is CUI or what category applies.
- **Exported documents stay clean** — no hidden or embedded data. The round-trip copy is a
  *separate* `.json` file, parsed with a prototype-pollution-guarded `JSON.parse`, never `eval`.
- **The service worker caches app code only**, never user content. Keep it same-origin-GET-only and keep the
  `/api/` counter + POSTs + cross-origin passing straight through (`public/sw.js`).
- **Faithfulness** — the export must match the preview and the manual; the PDF is vector, never
  rasterized; seals are authentic downloaded assets, never hand-drawn. **Per-enclosure CUI banners must agree
  across the three renderers**: the preview's `EnclosurePage`, the PDF's `pageBannerOverride`, and the `.docx`
  per-enclosure section header/footer. A blank per-enclosure banner inherits the letter's banner everywhere.
- **Pagination is not scale-invariant** (it compares DOM `offsetHeight` against pixel constants), so
  the preview's fit-to-width scaler uses CSS `transform`, which leaves `offsetHeight` true — never
  `zoom`.
