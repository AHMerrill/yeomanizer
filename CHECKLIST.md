# CHECKLIST — Lessons Learned + Per-Document-Type Build Checklist

**Read this top-to-bottom before building or changing ANY document type, and again before you commit.**
This is the distilled memory of every bug Zan caught that my verification missed, every standard we've
set, and the exact pipeline that got the standard letter to "works pretty well." No shortcuts. Emulation
is NOT a real test — drive real browser engines.

The four output surfaces must ALL agree and ALL be verified for every type:
**preview == PDF == .docx == browser-print**, and the **.json round-trip** must reproduce the input losslessly.

---

## PART A — The non-negotiables (never violate)

1. **Privacy / CUI.** Nothing persists or is transmitted. In-memory only — no storage, no cookies, no
   IndexedDB, no fingerprinting. The ONLY thing that leaves the browser is two content-free integer
   counters (page loads + download clicks); no IP, no region, no cookies, no per-visitor memory. CSP is
   locked to `connect-src 'self'`. The tool makes **no authorization claim**; CUI belongs only on
   authorized GFE.
2. **No code-execution path.** `JSON.parse` never `eval`/`Function`; no `innerHTML`/`dangerouslySetInnerHTML`;
   escape ALL text. Imported `.json` is validated + sanitized (node/depth caps).
3. **Exports are SILENT — zero identifying metadata.** No tool/library name, author, title, subject,
   keywords, or real timestamps in the PDF or .docx. (A CAC signature the user adds later is separate +
   intended.) See bug #13.
4. **Faithfulness.** preview == .docx == PDF == browser-print == the SECNAV M-5216.5 figure == real
   examples, with NO loss of formatting. PDFs are **vector/searchable, never rasterized**. Seals are
   **authentic downloaded assets, never hand-drawn/recolored**.
5. **Cross-browser + responsive.** Must work AND be readable in real **Chrome (Blink), Firefox (Gecko),
   Safari/iOS (WebKit), Edge (=Blink)**, at **desktop, tablet, and mobile** widths.
6. **Documents stay CLEAN.** No hidden/embedded data inside the .docx/.pdf. The `.json` is a SEPARATE
   plain-text project file — never embedded in a document.
7. **No fabrication.** Never invent UICs, addresses, names, or facts. No real PII in any default/placeholder.
   If blocked (CAC-gated data, a dashboard-only setting, a decision only Zan should make), say so honestly.

---

## PART B — Every bug we've hit (so we never repeat it)

Each is a real thing Zan found that "looked plausible" but was wrong. Check your new type against ALL of them.

1. **Heading continuation lines went to the LEFT margin** instead of hang-indenting under the entry's first
   word. From/To/Via/Subj hang under the content column; numbered Via/Ref/Encl hang under the text past the
   (a)/(1) marker. → **Test every heading with VERY long content; confirm the wrap hang-indents per part.**
2. **Copy-to / addressee lines didn't wrap** → ran off the page. → **Every field must wrap; long values too.**
3. **CUI portion markings were MISSING from the signable PDF** (preview + docx had them; the PDF renderer
   never emitted them, didn't even import `anyCui`). → **When you write/rewrite a renderer, re-check it emits
   EVERY mark/element the other two do. Diff the three outputs.**
4. **Browser-print captured app chrome** (the `.export-help` strip printed as extra pages). → `@media print`
   hides `.export-help/.about/.faq/.import-wrap`. **Print only the document.**
5. **Browser-print added a BLANK page after every sheet** — `break-after: page` on a full-page-height `.page`
   inserts a blank. → Removed `break-after`; use `break-inside: avoid`; `@page { margin: 0 }`; zero body/#root
   print margin.
6. **Print margin-spill (STILL OPEN):** `.page` is exactly 11in, so any printer margin shrinks the area below
   11in → content spills to a blank page. The doc carries its own naval margins → designed for **"Margins:
   None."** Headless `page.pdf({margin:0})` = clean 3 pages; the interactive dialog blank can't be reproduced
   headlessly → needs Zan's File→Print re-test. Remedy = prominent Margins:None guidance and/or steer to
   Export-PDF. **Verify with REAL headless Chrome (puppeteer-core + system Chrome), never @media-print emulation.**
7. **Safari/WebKit form-control bug:** a generic `.editor input { width: 100% }` ALSO matched checkboxes —
   Chrome/FF clamp to intrinsic, but **WebKit honors width:100% on a checkbox** → it ate the flex row and
   shoved the label off-screen. → Scope input rules with `:not([type=checkbox]):not([type=radio])`.
8. **Mobile/tablet collapse:** the `@media (max-width:880px)` block reset `.app`/`.editor-pane`/`.paper-backdrop`
   but NOT `.panes` itself, so `.panes` kept its desktop `flex:1; overflow-y:auto`, collapsed to the ~219px of
   leftover viewport, and turned editor+preview into a tiny inner scroll box with the footer painted over the
   cards. → On ≤880px, `.panes { flex:none; min-height:0; overflow:visible }` so the PAGE scrolls.
9. **Fit-to-width scaler staleness on rotate:** the ResizeObserver caught an intermediate width when crossing
   the breakpoint → the sheet overflowed its pane. → Debounce the RO to a `requestAnimationFrame` (measure the
   SETTLED layout).
10. **iOS footer "ghost":** the scaled-preview `transform` is a compositor layer; during momentum scroll iOS
    left a stale paint of the static footer over a card. → Promote the footer to its own layer
    (`transform: translateZ(0); position:relative; z-index:1`).
11. **Link/text contrast on the dark theme:** the SNDL link used default blue + visited-purple (unreadable);
    muted grays (#6b7180/#6f757f/#7d8290) were < 4.5:1. → Links `#6aa0ff`; muted text `#9aa1b0`. **Run the
    in-browser WCAG audit (linearize sRGB → luminance → ratio vs. first opaque bg); everything ≥ 4.5:1.**
12. **Export metadata leak:** pdf-lib stamps a default `Producer: "pdf-lib..."` + ModDate at CREATE
    (`updateInfoDict`, re-applied no matter what), and the docx library stamps real `created/modified`. →
    `stripPdfMetadata(doc)` as the LAST step before `doc.save()` (save never re-stamps); `silenceDocx()` rewrites
    the docx core.xml dates to epoch via jszip. **VERIFICATION GOTCHA: `PDFDocument.load(bytes)` RE-STAMPS the
    Producer/ModDate by default — a plain load to "check" the file LIES. Verify with
    `load(bytes,{updateMetadata:false})` or an external reader (macOS `mdls`).**
13. **Endorsement REPLACED the document** instead of appending. → Endorsements are additive, appended page(s)
    after the basic letter; a Via addressee AUTO-creates its endorsement.
14. **docx-embedding of the .json was BACKED OUT** (hidden/compressed data inside a document is a DLP/sanitization
    problem for gov/CUI). → The .json round-trip is a SEPARATE file. Documents stay clean.
15. **Asset 404s + wrong placeholders:** NATO used `/dod-seal-blue.png` (404 → use `/dod-seal.png`); a NATO field
    held real PII ("Alexander H. Merrill"); NATO paragraphs left a gap when SOFA was excluded. → Verify asset
    paths; dynamic numbering renumbers; no real PII.
16. **Preview pagination ≠ exports (PRE-EXISTING, surfaced as a fork):** the preview groups whole ITEMS; the PDF
    (`room()` line-flow) + Word split a paragraph mid-paragraph across a page break. Exports are authoritative;
    the preview is the approximation. True parity = a risky preview line-level rewrite → Zan's call, not unilateral.

**Process lessons (Zan's repeated frustrations):**
- **Emulation is NOT a real test.** `@media print` injected as screen styles ≠ a real print; Chromium ≠ all
  engines. Drive REAL Chrome (puppeteer-core), REAL WebKit + Firefox (Playwright).
- **`preview_eval` that clicks a tab AND audits in the SAME call races React's re-render.** Click in one eval,
  read in the next.
- **Don't claim "I'm blind" — Read the PDF (the Read tool rasterizes), LibreOffice-convert the .docx then Read it.**
- **Verify the LIVE deployed site**, not just localhost, for anything user-visible.

---

## PART C — The verification pipeline (run for EVERY output change, "until you're blue in the face")

- **Generate samples:** `GEN_PDF=1 npx vitest run src/export/_render_samples.test.ts` → `/tmp/ynpdf/`.
- **Inspect the PDF:** Read it (the Read tool rasterizes pages — `pages` param). Compare to the manual figure.
- **Inspect the .docx:** `/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf
  --outdir /tmp/ynpdf/docxpdf /tmp/ynpdf/*.docx` → Read the resulting PDF.
- **Diff the three:** preview vs PDF vs docx — every field, marking, hang-indent, wrap. Fix EVERY discrepancy.
- **.json round-trip:** export the `.json` → re-import via the Editor tab (synth a file-input change /
  `importLetterFile`) → confirm EVERY field repopulates losslessly AND the Builder draft is NOT clobbered →
  re-render → the round-trip PDF should be byte-identical to the direct render.
- **Browser print:** REAL headless Chrome — `npm install --no-save puppeteer-core`, system Chrome at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `/tmp/print_test.js` loads the dev server,
  imports a rich `.json`, `page.pdf(...)`, count `/Type /Page`. Confirm only the document, full-size, correct
  page count, CUI/endorsement/enclosure carried through. Flag interactive-dialog-only issues for a human re-test.
- **Cross-browser:** REAL WebKit + Firefox via Playwright (`/tmp/wk_mobile.js`, `/tmp/ff_mobile.js` patterns —
  both installed). Render the new type at **375 (mobile), 768 (tablet), 1024, 1280 (desktop)**; screenshot +
  measure (no horizontal overflow, no overlap, no clipping; preview fits the pane; footer below content).
- **Metadata silent:** load the generated PDF with `{updateMetadata:false}` (Producer/Creator/Title/Author/
  dates empty/epoch) AND `mdls` (Creator/EncodingApplications = null); unzip the .docx `docProps/core.xml`
  (no creator, epoch dates) + `app.xml` (empty).
- **Contrast:** the in-browser WCAG audit over the new editor cards — everything ≥ 4.5:1.
- **Drive the real UI:** `preview_start` (server name `yn-ai`, port 5180) / `preview_eval` (params are
  **serverId** + **expression**) / `preview_screenshot`.

---

## PART D — Per-new-document-type build checklist (run for EACH type, in order)

- [ ] **0. RESEARCH the manual** — read the chapter + figure(s) for the type in `research/manual_raw.txt`
      (no fabrication). List every part, marking, indent, and spacing rule. If unsure, render a sample and
      compare to the figure BEFORE wiring it up.
- [ ] **1. TYPE SYSTEM** — add to the `CorrespondenceType` union, `defaultState` (sensible self-explaining
      placeholders, **no real PII**), and the "Correspondence Type" picker.
- [ ] **2. EDITOR** — add/adjust the cards for the type's fields (labels, a11y `aria-label`s, placeholders).
      Scope any `input` CSS away from checkboxes/radios (bug #7).
- [ ] **3. PREVIEW** — render in `LetterPreview` + `preview.css`, pixel-faithful to the figure.
- [ ] **4. PDF** — render in `export/signablePdf.ts`, matching the preview exactly (fields, markings,
      hang-indents, wrapping). Vector. CAC `/Sig` field if it's signed. `stripPdfMetadata` stays the last step
      before save.
- [ ] **5. DOCX** — render in `export/docx.ts`, matching the preview. `silenceDocx` applies. Image enclosures
      embed; PDF enclosures rasterize.
- [ ] **6. PARITY** — generate samples; Read the PDF; LibreOffice-convert + Read the docx; diff all three vs.
      the figure. Fix every discrepancy (bug #3 — emit EVERY element in all three).
- [ ] **7. CUI** — if applicable, banners (top+bottom every page) + portion marks carry through ALL THREE.
- [ ] **8. EDGE CASES** — every field VERY long (wrap + hang-indent); multi-page continuation; empty/optional
      fields; long signature name/title.
- [ ] **9. JSON ROUND-TRIP** — export `.json` → re-import via Editor → lossless, Builder draft not clobbered →
      re-render → byte-compare to the direct render.
- [ ] **10. BROWSER PRINT** — real headless Chrome: correct page count, only the document, Margins:None caveat.
- [ ] **11. CROSS-BROWSER** — real WebKit + Firefox at 375/768/1024/1280: screenshot + measure, no overflow/
      overlap/clipping.
- [ ] **12. MOBILE/TABLET** — editor + preview stack and the PAGE scrolls; preview fits-to-width; footer ok.
- [ ] **13. CONTRAST** — WCAG audit on the new cards; ≥ 4.5:1.
- [ ] **14. SECURITY** — no new execution path; text escaped; `.json` import validates/sanitizes the new fields;
      CSP intact.
- [ ] **15. TESTS** — a `_render_samples` fixture for the type + integration/regression guards (renders; key
      markings present; round-trip lossless).
- [ ] **16. GREEN** — `npm run lint` + `npm run build` + `npx vitest run` all clean.
- [ ] **17. SHIP** — small reviewable commit → deploy (`cd app && npx --yes wrangler pages deploy
      --commit-dirty=true`) → push. Update the project memory AND this checklist if a new lesson emerged.

---

## Build order (by real-world frequency — see the research)

The app already covers the three most common formats: **standard letter, endorsement, from-to memorandum**.
New types, highest value first: **1) Memorandum For The Record (MFR)** → **2) Plain-Paper Memorandum** →
**3) Business Letter** → then Multiple-Address, "MEMORANDUM FOR", Decision Memo. Skip MOA/MOU + Congressional
(rare for individuals) unless asked.
