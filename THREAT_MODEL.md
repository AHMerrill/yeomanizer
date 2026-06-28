# Threat model — the yeomanizer

This document states, plainly, what the yeomanizer protects, what it does **not**, and the specific
measures behind each claim. It is written to be checked against the source — every mitigation below
points at real code or configuration. The tool is **unofficial** and makes **no authorization or
accreditation claim**; this is an engineering description of its security posture, not a certification.

Last reviewed against the codebase: 2026-06-28.

## 1. What we protect (assets)

- **Your correspondence content** — the letter you type and any files you attach. This may be
  Controlled Unclassified Information (CUI) or PII. The overriding goal: **content never leaves your
  browser tab except as a file you deliberately download.**
- **The integrity of what you download** — the `.pdf`, `.docx`, and `.json` must contain only what
  you see, with no hidden or identifying data embedded.

## 2. Architecture & trust boundary

The yeomanizer is a **static, client-only** web app. After the page loads, all work — formatting,
preview, and `.pdf` / `.docx` / `.json` generation — happens **in your browser**, on your machine.
There is no application server that receives your content, and there is no cloud processing step.

The **only** thing that ever leaves the browser is two **content-free integer counters** (a page-load
ping and a download-button ping). They carry no document content, no account, no cookie, and the
server stores only running totals.

Nothing of yours is **persisted**: no `localStorage`, no `sessionStorage`, no cookies, no IndexedDB.
Your draft lives in memory and is gone when the tab closes. An optional **service worker**
(`public/sw.js`) caches only the app's *own* static files (HTML/JS/CSS/icons) so the tool runs offline
and air-gapped after the first load — it never stores any document content, only ever sees same-origin
GET requests for app assets, and passes the content-free counter (a POST) and all cross-origin requests
straight through without caching.

## 3. Adversaries considered

1. A **malicious or corrupt input file** (a hand-edited `.json` project file, or a booby-trapped
   enclosure) opened by a trusting user.
2. A **network adversary** trying to exfiltrate content or MITM the page.
3. A **malicious embedder** trying to frame the app for clickjacking.
4. A **supply-chain** compromise attempting to add an exfiltration path.

## 4. Threats and mitigations

| Threat | Mitigation | Where |
|---|---|---|
| Content exfiltration to a third party | Content-Security-Policy restricts all connections to our own origin (`connect-src 'self'`), scripts to `'self'`, and forbids plugins/embeds (`object-src 'none'`). No external scripts, beacons, or analytics. | `app/public/_headers` |
| Code execution from an imported file | `.json` is read with `JSON.parse` (data only — never `eval`). All text is rendered **escaped** by React, so a script-looking string is shown as plain text and never runs. There is no `dangerouslySetInnerHTML` on user content. | `src/export/roundtrip.ts`, React render |
| Prototype pollution via a crafted `.json` | Dangerous keys (`__proto__`, `constructor`, `prototype`) are stripped on import before any merge. | `roundtrip.ts` (`DANGEROUS_KEYS`) |
| Denial of service (render hang / stack overflow) from a huge or deeply-nested file | The imported body tree is bounded: max 2000 nodes and max depth 12; exceeding the cap rejects the file cleanly. | `roundtrip.ts` (`MAX_BODY_NODES`, `MAX_BODY_DEPTH`) |
| Malicious data URL in an enclosure (e.g. `data:text/html`) | Only `image/*` and `application/pdf` data URLs are accepted back in for enclosures; anything else is dropped. | `roundtrip.ts` (`sanitizeEnclosures`) |
| Hidden / identifying data in exported files | The `.docx` core properties (author, title, company, timestamps) are blanked and the packed file is re-zipped to neutralize library-stamped timestamps; the `.pdf` has all metadata (Producer, dates, etc.) wiped as the last step before serialization. | `docx.ts` (`silenceDocx`), `signablePdf.ts` (`stripPdfMetadata`) |
| Clickjacking | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` — the app cannot be framed. | `_headers` |
| Network MITM / downgrade | HTTPS with HSTS; `base-uri 'none'` and `form-action 'none'` block base-tag and form-redirect tricks. | `_headers` |
| Browser-level data leakage | `autoComplete="off"` and `spellCheck={false}` on the editor so the browser never stores or transmits entries (autofill history, enhanced spellcheck). `Referrer-Policy: no-referrer`; `Permissions-Policy` disables geolocation/mic/camera and FLoC. | `App.tsx`, `_headers` |
| Compromise of the counter endpoint | It accepts only an integer increment and returns running totals — it never receives document content, IP-derived identity, or region, so a compromise leaks nothing about any document. | counter endpoint |

## 5. Out of scope / residual risk (your responsibility)

- **Device authorization.** The tool runs in your browser like any local app; it **cannot** make an
  unauthorized device acceptable for CUI. CUI belongs only on Government-Furnished Equipment or a
  specifically-approved system. The tool makes no authorization claim.
- **Handling the files you download.** A `.pdf`/`.docx`/`.json` that contains CUI is itself CUI —
  store and transmit it only on, and through, authorized systems and channels.
- **Your endpoint.** A compromised browser, OS, or extension is outside this model.
- **Classification decisions.** The tool marks exactly what you enter (including per-enclosure CUI
  banners). It makes **no** determination of whether content is CUI or what category applies — that
  judgment is yours.

## 6. Reporting

Found a gap? Open an issue at the repository. Please don't include real CUI or PII in a report.
