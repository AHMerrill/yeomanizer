# the yeomanizer

A fast, **unofficial** web tool for drafting U.S. Navy correspondence — standard naval letters,
memoranda, endorsements, and NATO travel orders — to the format prescribed by **SECNAV
M-5216.5**, with a live preview, PDF / Word (`.docx`) export, and client-side merging of
enclosures into a single PDF packet.

> **Not affiliated with or endorsed by the U.S. Navy or the Department of Defense.** This is a
> drafting aid, not an official system of record.

## Privacy by design — nothing persists

This is a **static, client-only** app. There is no backend that receives what you type, no
database, no accounts, no per-user storage:

- Everything you enter lives only in your browser tab's memory and is **erased when you close
  it**. Nothing is written to disk unless *you* click Export.
- Browser autofill and spellcheck are turned off so entries aren't quietly stored or sent.
- The only network call beyond loading the page is an **anonymous, content-free** increment to
  a download counter — it never carries any document content.
- A strict Content-Security-Policy blocks the app from connecting to any external origin.

Because there is no central store, there is nothing to breach, scrape, or collect.

## Develop

    cd app
    npm install
    npm run dev       # local dev server (Vite)
    npm test          # run the test suite (vitest)
    npm run lint      # static analysis (oxlint)

The tests cover the format engine (the fig 7-8 paragraph ladder, reference
and date formatting, paragraph-tree edits, US→NATO rank mapping), the
PDF/Word export assembly, the content-free download counter (including a
guard that it never sends a payload), and the editor↔preview React wiring.

## Build & deploy (Cloudflare Pages)

- Build command: `npm run build` · Output directory: `dist` · Root directory: `app`
- `app/public/_headers` sets production security headers (CSP, X-Frame-Options, etc.).
- `app/functions/api/count.js` is the anonymous download counter; it needs a Cloudflare KV
  namespace bound as `COUNTER`.

Format rules are documented in [`SPEC.md`](SPEC.md), derived from SECNAV M-5216.5 and DON CUI
marking guidance.
