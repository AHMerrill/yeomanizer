# the yeomanizer

A free, **unofficial** web app for drafting U.S. Navy correspondence — standard naval letters,
memoranda (including the MFR), business letters, endorsements, and NATO travel orders — to the
format prescribed by **SECNAV M-5216.5**,
with a live, pixel-accurate preview and `.docx` / `.pdf` / `.json` export. It runs entirely in your
browser; nothing you type ever leaves the page.

Live: **https://yeomanizer.com**

> **Not affiliated with or endorsed by the U.S. Navy or the Department of Defense**, and not an
> official system of record — a drafting aid only.

## What it does

- **Document types** — standard naval letter, memorandum (From-To), memorandum for the record
  (MFR), business letter (Ch 11 — inside address, salutation, civilian date, unnumbered paragraphs,
  centered "Sincerely,"), multiple-address letters (Ch 8 — `To:` / `Distribution:`), endorsements
  (Ch 9, appended automatically when you add a Via addressee), the **Memorandum of Agreement /
  Understanding** (Ch 10 — dual per-party identification blocks + dual signatures), the **joint
  letter / memorandum** (Ch 7 — co-signed by two or more commands), and the bilingual two-page NATO
  travel order.
- **Pixel-faithful preview** — letterhead with the authentic DoD/DoW seal, the SSIC/identification
  block, the From/To/Via/Subj/Ref/Encl heading, automatic paragraph numbering & indentation (the
  full 8-level Fig 7-8 ladder), the signature block, and multi-page continuation (the Subj — or the
  identification symbols for a business letter — repeated at the top of each page, numbered from
  page 2) — all to the manual, and **identical in the preview, PDF, and `.docx`**.
- **Section titles** — an optional underlined lead-in per paragraph ("1. <u>Purpose</u>. …"), per
  OPNAVINST 5400.45A.
- **Inline emphasis** — type `**bold**`, `*italic*`, or `__underline__` for occasional emphasis; it
  renders identically in the preview, the `.docx`, and the PDF.
- **Reorder & auto-number** — drag a paragraph by its grip (or use ↑/↓) to reorder it; the numbering
  (1, 2…, then a, b…) and indentation update themselves.
- **Undo / redo** — ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z (or toolbar buttons); each draft keeps its own
  in-memory history (nothing persisted).
- **Proofread tab** — a pre-send review built on SECNAV M-5216.5 Ch 2 ¶19: live checks on your draft,
  the format items the engine guarantees, and the substance items you confirm. Advisory only — it never
  blocks an export, and a non-blocking badge shows how many items are worth a look.
- **Local sensitive-data scan** — a quick, **in-browser** pass over your draft flags possible SSNs,
  9-/10-digit IDs (a DoD ID / EDIPI is 10), and dates of birth in the Proofread tab. It runs entirely
  on your machine — nothing is logged or transmitted — and it's a reminder, not a verdict: what is
  PII/CUI, and how it's marked, stays your call.
- **Starter templates** — one click drops a correctly-structured example (letter of appreciation,
  request, memorandum for the record, or business letter) into the editor, with the parts to replace
  shown in `[BRACKETS]`. Undoable, and the content is bundled — nothing is fetched.
- **SSIC lookup** — don't have a subject code memorized? Search a built-in list by number or keyword
  and click to fill it in (all 13 major groups plus the common second-level codes). It's a curated
  set, not the full SECNAV M-5210.2 catalog, so codes are never made up.
- **CUI marking** — a banner top & bottom of every page (enclosures included), the designation
  block, optional per-paragraph (CUI)/(U) marks, and **per-enclosure banners** — give any
  in-document enclosure its own banner so a mixed-category package is marked correctly, each on its
  own pages (preview, PDF, and `.docx`). Per DoDI 5200.48 + DON guidance.
- **Enclosures** — mark one "in the document" and drop in an image or PDF; images embed and PDFs
  come in as real, searchable pages. Or merge an already-saved letter PDF with enclosure files into
  one packet — all in the browser.
- **NATO rank auto-translation** — pick a U.S. grade (E-1…O-10) and the NATO OF/OR code fills in.
- **Works everywhere** — phone, tablet, and desktop; the two-pane layout stacks and the sheet
  scales to fit narrow screens.

## Export & round-trip

Three exports, all generated **in your browser**:

- **`.docx`** — an editable Microsoft Word version of the full document (endorsements, enclosures,
  and CUI included).
- **`.pdf`** — a pixel-accurate, **vector / searchable** PDF of the whole package, with a built-in
  **CAC-signable** signature field. Open it to print, save, or CAC-sign — no Prepare-a-Form step.
- **`.json`** — a small, plain-text editable copy of your draft. Drop it into the **Editor** tab
  later to keep working. The `.docx` and `.pdf` stay **clean** — there is no hidden or embedded data
  inside them.

## Privacy & CUI

A **static, client-only** app: no backend receives what you type, no database, no accounts, no
per-user storage.

- Everything you enter lives only in your browser tab's memory and is **erased when you close it**.
  Nothing is written to disk unless *you* click an export.
- Browser autofill and spellcheck are off, and a strict **Content-Security-Policy**
  (`connect-src 'self'`) blocks the app from connecting to any external origin.
- The only network calls beyond loading the page are **anonymous, content-free** increments to two
  site-wide tallies — a page-load count and a download-click count — each just an integer. They
  never carry any document content, cookie, IP address, or region.
- Exported documents are **regular, non-executable file types** with nothing hidden inside; imported
  `.json` is parsed with `JSON.parse` (never `eval`) behind a prototype-pollution guard.
- After the first load it works **offline / air-gapped** and is **installable** — a service worker
  caches only the app's own files (never your content), so you can run it with no network.

The full security write-up — assets, trust boundary, and a threat-by-threat table that points at the
code behind each claim — is published in [`THREAT_MODEL.md`](THREAT_MODEL.md).

**CUI:** the tool makes **no authorization claim**. Controlled Unclassified Information belongs only
on authorized Government-Furnished Equipment — or a system specifically approved for it — never a
personal device, and you handle the files you download under the applicable CUI and
information-handling rules. The in-app **FAQ** tab covers this with authoritative references.

Because there is no central store, there is nothing to breach, scrape, or collect.

## Develop

    cd app
    npm install
    npm run dev       # local dev server (Vite)
    npm test          # run the test suite (vitest)
    npm run lint      # static analysis (oxlint)
    npm run build     # production build → dist/

## Documentation

- [`SPEC.md`](SPEC.md) — the format/spec reference: the rules the deterministic formatter follows,
  derived from SECNAV M-5216.5 and DON CUI marking guidance.
- [`app/README.md`](app/README.md) — the developer architecture / module map and the
  visual-verification workflow.
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — the security write-up: assets, trust boundary, and a
  threat-by-threat table that points at the code behind each claim.
- [`CREDITS.md`](CREDITS.md) — attribution: the public U.S. Government authorities, the open-source
  libraries, and the projects whose *ideas* (no code) informed features here.

## Build & deploy (Cloudflare Pages)

- Build command: `npm run build` · Output directory: `dist` · Root directory: `app`
- `app/public/_headers` sets the production security headers (CSP, X-Frame-Options, HSTS, …).
- `app/functions/api/count.js` (downloads) and `app/functions/api/visit.js` (page views) are the
  anonymous counters; both store a single integer each in a Cloudflare KV namespace bound as
  `COUNTER`. Their handlers take only the KV binding — they never read the request, so no IP or
  region is ever seen.

## License

Licensed under the **Apache License, Version 2.0** — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
You may use, modify, and redistribute this software, including commercially, provided you retain the
copyright/attribution notice and the license (Apache-2.0 §4). © 2026 AHMerrill.

Exports themselves carry **no** tool attribution or identifying metadata — the Apache notice applies
to the source code, not to the letters you generate.
