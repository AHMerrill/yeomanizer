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

The app has four tabs (`App.tsx`): **Editor** (drop a saved `.json` to keep working — its own state,
so importing never clobbers the Builder draft), **Builder** (the card-based form), **Features**, and
**FAQ** (security & CUI, with authoritative references).

## Architecture

- `src/types.ts` — `LetterState`, the single source of truth for a document.
- `src/format/` — the pure format engine: the paragraph ladder & numbering (`paragraphs.ts`),
  identification/reference/date formatting, the paragraph tree (`tree.ts`), and inline emphasis
  markup (`inline.ts` — `**bold**`, `*italic*`, `__underline__`, non-nested, parsed identically by
  every renderer).
- `src/components/` — `Editor.tsx` (the card form, shared by the Builder and Editor tabs),
  `LetterPreview.tsx` (the live HTML sheet, the pagination measurer, and the fit-to-width scaler),
  `About.tsx` (Features), `Faq.tsx`, `ImportDropZone.tsx`.
- `src/export/` — `signablePdf.ts` (the canonical **vector** PDF via pdf-lib, one AcroForm with a
  `/Sig` CAC field, enclosures copied as real pages), `docx.ts` (Word), `roundtrip.ts` (the separate
  `.json` project file).
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
  content-free integer counters — visits and downloads — neither carrying content, IP, or region).
  Never loosen the CSP or add persistence.
- **Exported documents stay clean** — no hidden or embedded data. The round-trip copy is a
  *separate* `.json` file, parsed with a prototype-pollution-guarded `JSON.parse`, never `eval`.
- **Faithfulness** — the export must match the preview and the manual; the PDF is vector, never
  rasterized; seals are authentic downloaded assets, never hand-drawn.
- **Pagination is not scale-invariant** (it compares DOM `offsetHeight` against pixel constants), so
  the preview's fit-to-width scaler uses CSS `transform`, which leaves `offsetHeight` true — never
  `zoom`.
