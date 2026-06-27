# CLAUDE.md — working in the yeomanizer

Product + architecture: [README.md](README.md) and [app/README.md](app/README.md). Format rules:
[SPEC.md](SPEC.md). This file is the working guide for Claude sessions in this repo.

## The two non-negotiables

1. **Privacy / CUI.** Nothing persists or is transmitted — in-memory only; the sole network calls are
   two content-free counters (a visit tally and a download tally, each an integer; their handlers
   take only the KV binding and never read the request, so no IP or region is seen). Exported
   documents stay clean — no hidden or
   embedded data. Regular, non-executable file types. No code-execution path anywhere
   (`JSON.parse`, never `eval`; escape all text). The CSP is locked to `'self'`. The tool makes **no
   authorization claim** — CUI belongs only on authorized Government-Furnished Equipment.
2. **Faithfulness.** export == preview == the manual == real examples, with no loss of formatting.
   Vector (never rasterized) PDFs. Authentic downloaded seals, never hand-drawn. If the right way is
   harder, do the right way.

## Verify output changes — never claim you "can't see" a PDF

- Generate samples: `GEN_PDF=1 npx vitest run src/export/_render_samples.test.ts` → `/tmp/ynpdf/`.
- Read PDFs directly (the Read tool rasterizes pages). For a `.docx` (zipped XML the reader can't
  rasterize), convert first:
  `soffice --headless --convert-to pdf --outdir /tmp/ynpdf/docxpdf /tmp/ynpdf/*.docx`, then read it.
- Drive the live UI via the preview server (name **yn-ai**, port **5180**); `preview_eval` params
  are **serverId** + **expression**. Reload before evaluating — HMR can be stale.
- Compare to canonical sources: `research/manual_raw.txt` and OPNAVINST 5400.45A
  (`~/Desktop/5400.45A.pdf`). Fix every discrepancy you can see.

## Gotchas

- `research/` and `*.pdf` are **gitignored** — never commit them (real PII lives there). Never
  fabricate UICs, addresses, or facts.
- Pagination compares DOM `offsetHeight` against pixel constants, so it is **not** scale-invariant —
  the preview fit-to-width scaler uses CSS `transform` (leaves `offsetHeight` true), never `zoom`.
- `Editor.tsx` is shared by the Builder tab (`state`) and the Editor/import tab (`importedState`);
  importing a `.json` must never clobber the Builder draft.
- The `.json` round-trip is a **separate** file — do **not** re-embed draft data inside the `.docx`
  or `.pdf` (it was built and deliberately backed out; embedded data is a government sanitization/DLP
  problem).

## Before every commit

    npm run build && npm run lint && npx vitest run        # all green
    cd app && npx --yes wrangler pages deploy --commit-dirty=true   # deploy (Cloudflare Pages)

Keep small, reviewable commits. Surface anything that needs the user's Cloudflare/GitHub dashboard
(e.g. the blocked custom domain or email routing) rather than guessing.
