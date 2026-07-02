# CLAUDE.md — working in the yeomanizer

Product + architecture: [README.md](README.md) and [app/README.md](app/README.md). Format rules:
[SPEC.md](SPEC.md). Security posture: [THREAT_MODEL.md](THREAT_MODEL.md). Attribution / open-source
credits (keep current when adding a dependency or a borrowed feature idea): [CREDITS.md](CREDITS.md).
This file is the working guide for Claude sessions in this repo.

> **Before building or changing ANY document type, read [CHECKLIST.md](CHECKLIST.md) top-to-bottom —
> then again before you commit.** It's the distilled memory of every bug Zan caught that "looked
> plausible" but was wrong, plus the exact create → export → view → import → view + browser-print +
> cross-browser + mobile pipeline. No shortcuts; emulation is not a real test; drive real browser engines.

## The two non-negotiables

1. **Privacy / CUI.** Nothing persists or is transmitted — in-memory only; the sole network calls are
   two content-free counters (a page-load tally and a download-click tally, each an integer; their handlers
   take only the KV binding and never read the request, so no IP or region is seen). This covers everything
   session-only too: the **undo/redo history**, the per-type drafts, **starter-template** loads, the **PII
   scan** (`format/pii.ts` runs locally on the in-memory draft — nothing logged or sent), and the **Proofread**
   checkboxes. Exported documents stay clean — no hidden or embedded data. Regular, non-executable file types.
   No code-execution path anywhere (`JSON.parse`, never `eval`; escape all text). The CSP is locked to `'self'`,
   and the **service worker caches app code only — never user content** (same-origin GET assets only; the
   `/api/` counter + POSTs + cross-origin pass straight through). The tool makes **no authorization claim** and
   **no classification determination** — it marks exactly what the user enters (including any **per-enclosure
   CUI banner**), and CUI belongs only on authorized Government-Furnished Equipment. The PII scan and proofread
   checks are **advisory** — they flag, they never block an export.
2. **Faithfulness.** export == preview == the manual == real examples, with no loss of formatting.
   Vector (never rasterized) PDFs. Authentic downloaded seals, never hand-drawn. If the right way is
   harder, do the right way. The **per-enclosure CUI banner** must agree across all three renderers — the
   preview's `EnclosurePage`, the PDF's `pageBannerOverride` map (`export/signablePdf.ts`), and the per-enclosure
   Word **section** header/footer (`export/docx.ts`, each in-document enclosure is its own `ISectionOptions`);
   a blank per-enclosure banner inherits the letter's banner everywhere.

## Verify output changes — never claim you "can't see" a PDF

- Generate samples: `GEN_PDF=1 npx vitest run src/export/_render_samples.test.ts` → `/tmp/ynpdf/`.
- Read PDFs directly (the Read tool rasterizes pages). For a `.docx` (zipped XML the reader can't
  rasterize), convert first:
  `soffice --headless --convert-to pdf --outdir /tmp/ynpdf/docxpdf /tmp/ynpdf/*.docx`, then read it.
- Drive the live UI via the preview server (name **yn-ai**, port **5180**); `preview_eval` params
  are **serverId** + **expression**. Reload before evaluating — HMR can be stale.
- Compare to canonical sources — the pub's **figures are the visual truth**. All 51 are extracted to
  `research/figures/*.png` (named by figure number, e.g. `fig-10-5_moa.png`); the **text dump
  (`research/manual_raw.txt`) loses figure layout**, so for "does it match the picture?" read the PNGs,
  not the text. Where prose and a figure conflict, **the figure wins**. (Figures are gitignored/local —
  if absent, re-extract: `pdftoppm -png -r 150 -f <pg> -l <pg> -singlefile "5216.5  CH-1.pdf" <out>`.)
  Also compare OPNAVINST 5400.45A (`~/Desktop/5400.45A.pdf`). Fix every discrepancy you can see.

## Gotchas

- `research/` and `*.pdf` are **gitignored** — never commit them (real PII lives there). Never
  fabricate UICs, addresses, or facts. **`data/ssic.ts` is curated, not the full SECNAV M-5210.2 catalog** —
  add only real codes/titles, never invented ones; `data/templates.ts` uses `[BRACKETS]` for anything the
  writer must supply.
- Pagination compares DOM `offsetHeight` against pixel constants, so it is **not** scale-invariant —
  the preview fit-to-width scaler uses CSS `transform` (leaves `offsetHeight` true), never `zoom`.
- `Editor.tsx` is shared by the Builder tab (`state`) and the Editor/import tab (`importedState`);
  importing a `.json` must never clobber the Builder draft.
- **Undo/redo** (`App.tsx`) is keyed **per editing context** — `editor` and `builder:<type>` each have
  their own `{past, future}`. Rapid edits coalesce within ~700ms (one typing burst = one step); the keydown
  handler **defers to native undo inside a focused INPUT/TEXTAREA/contentEditable**, so per-character text undo
  still works. Loading a template and importing a file both snapshot into the right context's history. Keep all
  of it in-memory — never persist history.
- **Drag-to-reorder** uses `tree.reorder` and is **sibling-only** (matches ↑/↓); cross-level drops are a no-op
  by design (use "Add subparagraph" to change depth). Numbering is render-driven, so a reorder renumbers itself.
- The **Proofread** tab analyzes `reviewSubject` (the *last* edited context — Builder draft or Editor import),
  not always the Builder draft; its tab badge = warn-count + PII-hit count. The manual checkboxes are session-only
  and reset on leaving the tab (a feature: re-verify after any change).
- The `.json` round-trip is a **separate** file — do **not** re-embed draft data inside the `.docx`
  or `.pdf` (it was built and deliberately backed out; embedded data is a government sanitization/DLP
  problem).
- **A standalone type that early-returns in an exporter must still run the shared finalization.** The
  coordination page returns early in `signablePdf.ts`/`docx.ts` (it's a table, not a letter). That path
  originally skipped the CUI banner (`applyCui`) **and** `stripPdfMetadata`, so enabling CUI silently did
  nothing *and* the PDF shipped a pdf-lib `Producer` + a real creation-timestamp (a privacy-tenet leak the
  preview didn't reveal, since the preview marks every type via its page wrapper). Any new early-return type
  must call `applyCui()` + `stripPdfMetadata(doc)` (PDF) and set a CUI header/footer + empty doc metadata
  (docx) before returning. Verify with `pdfinfo` (dates must read 1969/epoch-0, `Producer` empty) and by
  grepping the exported text for the banner — not just the preview.

## Before every commit

    npm run build && npm run lint && npx vitest run        # all green
    cd app && npx --yes wrangler pages deploy --commit-dirty=true   # deploy (Cloudflare Pages)

**Always deploy from `app/` — never `wrangler pages deploy app/dist` from the repo root.** The
anonymous counter lives in `app/functions/api/{count,visit}.js` (Cloudflare Pages Functions) and its
KV binding is in `app/wrangler.toml`. wrangler only picks up `functions/` and the `[[kv_namespaces]]`
binding relative to its CWD, so deploying the `dist` folder from the repo root silently ships the
static site **without** the Functions — `/api/count` then falls through to the SPA (returns HTML, not
JSON) and the "Page Loads · Download Clicks" footer shows `—`. A correct deploy logs
"Compiled Worker successfully" + "Uploading Functions bundle"; if you don't see those, the counter
API didn't ship. Verify after deploying: `curl -s https://yeomanizer.pages.dev/api/count` must return
`{"downloads":N,"visits":N}`, not HTML.

Keep small, reviewable commits. Surface anything that needs the user's Cloudflare/GitHub dashboard
(e.g. the blocked custom domain or email routing) rather than guessing.
