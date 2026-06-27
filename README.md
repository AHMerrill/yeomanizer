# the yeomanizer

A free, **unofficial** web app for drafting U.S. Navy correspondence — standard naval letters,
memoranda, endorsements, and NATO travel orders — to the format prescribed by **SECNAV M-5216.5**,
with a live, pixel-accurate preview and `.docx` / `.pdf` / `.json` export. It runs entirely in your
browser; nothing you type ever leaves the page.

Live: **https://yeomanizer.com**

> **Not affiliated with or endorsed by the U.S. Navy or the Department of Defense**, and not an
> official system of record — a drafting aid only.

## What it does

- **Document types** — standard naval letter, memorandum (From-To), endorsements (Ch 9, appended
  automatically when you add a Via addressee), and the bilingual two-page NATO travel order.
- **Pixel-faithful preview** — letterhead with the authentic DoD seal, the SSIC/identification
  block, the From/To/Via/Subj/Ref/Encl heading, automatic paragraph numbering & indentation, the
  signature block, and multi-page continuation (numbered from page 2) — all to the manual.
- **Section titles** — an optional underlined lead-in per paragraph ("1. <u>Purpose</u>. …"), per
  OPNAVINST 5400.45A.
- **Inline emphasis** — type `**bold**`, `*italic*`, or `__underline__` for occasional emphasis; it
  renders identically in the preview, the `.docx`, and the PDF.
- **CUI marking** — a banner top & bottom of every page (enclosures included), the designation
  block, and optional per-paragraph (CUI)/(U) marks, per DoDI 5200.48 + DON guidance.
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
  site-wide tallies — a visit count (on page load) and a download count — each just an integer. They
  never carry any document content, IP address, or region.
- Exported documents are **regular, non-executable file types** with nothing hidden inside; imported
  `.json` is parsed with `JSON.parse` (never `eval`) behind a prototype-pollution guard.

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

See [`app/README.md`](app/README.md) for the architecture and the visual-verification workflow, and
[`SPEC.md`](SPEC.md) for the format rules (derived from SECNAV M-5216.5 and DON CUI marking
guidance).

## Build & deploy (Cloudflare Pages)

- Build command: `npm run build` · Output directory: `dist` · Root directory: `app`
- `app/public/_headers` sets the production security headers (CSP, X-Frame-Options, HSTS, …).
- `app/functions/api/count.js` (downloads) and `app/functions/api/visit.js` (page views) are the
  anonymous counters; both store a single integer each in a Cloudflare KV namespace bound as
  `COUNTER`. Their handlers take only the KV binding — they never read the request, so no IP or
  region is ever seen.
