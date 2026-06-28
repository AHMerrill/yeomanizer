# the yeomanizer — Naval Correspondence Format Spec

Derived from **SECNAV M-5216.5 (June 2015) w/ CH-1 (16 May 2018)**, Chapter 7
(Correspondence Format) and Chapter 2, plus the *Navy Writing Guide*. This is the
source of truth for the deterministic formatter. Page refs are to the manual.

> **Design principle (per the user, and the manual itself):** *the look is the result.*
> Para 7-2.2: "Spacing and alignment of headings following the 'From:' line will vary
> based upon the font utilized." The manual's literal space counts (From: +2, To: +6,
> Via: +5, Subj: +3, Ref: +4, Encl: +3) are calibrated for one font and **do not align**
> in Times New Roman. We therefore render to the *visual* result — a label column +
> aligned content column — not by counting spaces. Fig 7-8 even admits two-digit
> paragraph numbers "will not line up." We match the intended appearance.

## Page setup (7-2.1, 2-12, 2-20)
- Paper: 8.5 × 11 in. Margins: **1 in** top/bottom/left/right.
- Font: **Times New Roman 12 pt** (preferred). Courier New allowed for informal.
- **Left-justified, ragged right.** Never center/right/full-justify. No proportional-spacing tricks.
- Single-spaced text.

## Letterhead (2-12, fig 7-1)
- DoD seal, **1 in dia, upper-left**. (DON commands display the DoD seal per 2-12b(1).)
- `DEPARTMENT OF THE NAVY` **centered on the 4th line from the top**, larger; then activity
  name / address / city-state-zip+4 centered on succeeding lines, smaller.
- **No abbreviations or punctuation** in the address. Header rendered in Navy blue.

## Sender's symbol / identification block (7-2.3)
- If "in reply refer to" is printed on letterhead → SSIC on the next line.
- Else → place block on the **2nd line below the letterhead, starting ≥2 in from the right
  edge**; longest line ends near the right margin. Block is **left-aligned within itself**.
- Three parts, stacked:
  1. **SSIC** — 4–5 digit subject code (SECNAV M-5210.2).
  2. **Originator's code**, alone or in a serial: `Code 13` or `Ser Code 13/271`.
     Classified/serialized: `Ser Code 13/271`, `Ser N00J/S20`.
  3. **Date** — abbreviated format, same day as signed; may be blank if signed later.

## Heading lines (7-2.6 … 7-2.11)
All headings start at the **left margin**. Content is rendered in an aligned column
(label column + content column). Multi-line entries hang-indent under the first word
after the heading. Literal space counts (for reference / .txt export only):

| Line  | Spaces after colon | Notes |
|-------|--------------------|-------|
| From: | 2 | activity head + activity name; no individual's name on letterhead |
| To:   | 6 | action addressee (the activity head); office code in parens |
| Via:  | 5 | omit if none; **number (1),(2)… if 2+**, in chain-of-command order |
| Subj: | 3 | **ALL CAPS**, normal word order, **no punctuation**, no acronyms |
| Ref:  | 4 | lowercase letters `(a) (b) … (aa) (ab)`; cite in text; no subject needed |
| Encl: | 3 | numbers `(1) (2)…`; **one space after the `)`**; mark "(sep cover)" if separate |

- Blank line **above** Subj, Ref, Encl, and text ("second line below" = one blank line).
- From→To→Via are consecutive (no blank line between).

## Text & paragraphs (7-2.12, 7-2.13, fig 7-8)
- Text starts on the 2nd line below the last heading. Left-justified.
- **One blank line between paragraphs** ("second line below").
- **First line of a subparagraph is indented; ALL continuation lines return to the LEFT
  MARGIN** (do not indent wraps). → CSS `text-indent` on a full-width block.
- Indent each new subdivision to align with the first letter of the paragraph above.
- Pairing rule: a `1a` requires a `1b`; a `1a(1)` requires a `1a(2)`.
- Marker ladder (reset per parent; **never go beyond level 8**):

| Depth | Marker | Underline |
|-------|--------|-----------|
| 1 | `1.` | no |
| 2 | `a.` | no |
| 3 | `(1)` | no |
| 4 | `(a)` | no |
| 5 | `1.` | underline digit |
| 6 | `a.` | underline letter |
| 7 | `(1)` | underline digit |
| 8 | `(a)` | underline letter |

- Citing a paragraph in text: no periods/spaces, e.g. `2b(4)(a)`.
- Paragraph headings: underline, Title Case, consistent across siblings.
- **Section titles (impl):** each paragraph has an optional underlined lead-in rendered inline after
  the marker — `1.  <u>Purpose</u>.  body…` — per the OPNAVINST 5400.45A example. Identical in the
  preview, `.docx`, and PDF.
- **Inline emphasis (impl):** bold / underline / italics are permitted for occasional emphasis. The
  editor accepts `**bold**`, `*italic*`, `__underline__` as plain-text markup, parsed identically by
  every renderer (`format/inline.ts`).

## Signature (7-2.14)
- Start all lines at the **horizontal center of the page**, on the **4th line below the text**.
- First initial, middle initial, last name. **Last name in ALL CAPS** (except name prefixes,
  e.g. `P. W. McNALLY`). No rank, no complimentary close.
- Optional 2nd line: title (e.g., `Deputy`). `By direction` / `Acting` per authority.

## Copy to (7-2.15)
- `Copy to:` at the left margin, 2nd line below the signature. Single column, single-spaced.

## Continuation pages (7-2.16, 7-2.17)
- Repeat **Subj** at top (6th line / 1-in margin); text resumes 2nd line below.
- **Do not number page 1.** Center page numbers **½ in from the bottom**, starting at **2**,
  no punctuation.

## Dates (2-16) & time (2-15)
- **Abbreviated** (sender's symbol): `7 Sep 06` — 1–2 digit day (no leading zero), 3-ltr month, 2-digit year.
- **Standard** (in text): `5 May 2015` — day, spelled month, 4-digit year.
- **Civilian** (to Congress/businesses): `January 14, 2014`.
- Military time: 4 digits, 24-hr, no colon: `0630`, `1545`.

## Variants (later chapters)
- Ch 8 multiple-address (To/Distribution), Ch 9 endorsements, Ch 10 memoranda
  (From-To, plain-paper, letterhead, MFR), Ch 11 business letters. Each is a variation
  on the standard-letter skeleton above.

## CUI marking (sourced — NOT from the 2015 manual, which predates CUI)
FOUO was retired by **DoDI 5200.48 (2020)** and replaced by CUI. Rules below are pulled
from the ISOO **CUI Marking Handbook** (v1.1) and the DON **"Marking Documents Containing
PII"** guidance (doncio.navy.mil) — both saved to `research/`.

- **Banner:** the word **`CUI`** at the **top and bottom of every page**, centered, bold,
  capitalized, black, ≥12pt. For DON **PII** the banner is **plain `CUI`** — DON guidance
  explicitly forbids modifiers like "CUI-Privacy"/"CUI-PII". (CUI Specified uses the ISOO
  construction `CUI//CATEGORY//DISSEM`, e.g. `CUI//SP-PRVCY/FED ONLY` — supported via the
  editable banner field.)
- **Designation Indicator Block:** first page only, **lower-right**, between banner and
  footer. Required lines: `Controlled by:` (Department of the Navy), `Controlled by:`
  (office, e.g. `OJAG Code 13`), `CUI Category:` (PRVCY/HLTH/MIL/PERS/… ; PRVCY = General
  Privacy), `Distribution/Dissemination Control:` (e.g. `FEDCON`), `POC:`.
- **Portion markings:** `(U)`/`(CUI)` optional for DoD; DON recommends **against** for PII.
  Default off; if on, used throughout.
- **Per-enclosure banners (impl):** each in-document enclosure (`EnclosureEntry.cuiBanner`) may carry
  its **own** CUI banner. When CUI is on and the enclosure is rendered into the document, its appended
  page(s) use *that* banner top & bottom instead of the letter's — so a package can assemble enclosures
  of differing CUI categories, each marked correctly on its own pages. **Blank = inherit** the letter's
  banner. The tool marks exactly what the user enters; it makes **no classification determination** of
  its own. Rendered identically across the preview (`EnclosurePage`), the PDF (a `pageBannerOverride`
  page→banner map), and the `.docx` (each in-document enclosure is its **own Word section** with its own
  header/footer; the letter section keeps the designation block in its first-page footer).
- **Implementation:** print/preview uses `position: fixed` banners (repeat every page); `.docx`
  uses Word's native first-page/default headers & footers (designation block in the first-page footer),
  one section per in-document enclosure. True multi-page *content* pagination still pending (see below).

## Pagination (done)
Measurement-based: the preview measures rendered block heights and splits content into
discrete 8.5×11 sheets. Page 1 carries the letterhead/SSIC head; continuation pages repeat
only the Subj line (7-2.16) and are numbered (centered, ½-in from the bottom, starting at 2
— 7-2.17). CUI banners render on every page; the designation block is page 1 only. Breaks
at paragraph boundaries (atomic blocks) — mid-paragraph line-splitting (the "≥2 lines each
side" rule, 7-2.13) is a future refinement.

## Memorandum (Ch 10) — done (From-To / plain-paper / letterhead)
Plain bond (letterhead off) or letterhead. The only ID symbol is the **date**, flush right
on the ~6th line — no SSIC (10-2). "MEMORANDUM" at the left margin, then
From/To/Via/Subj/Ref/Encl and numbered paragraphs exactly as a letter; signature centered.
The MFR is done; decision memos and MOA/MOU remain as future sub-variants.

## Business letter (Ch 11) — done
For correspondents outside the DoD. Letterhead required; identification symbols (SSIC / Ser /
**civilian** date, "January 5, 2015") at the upper **LEFT**, not right. An **inside address** and a
**salutation** ("Dear Mr. Jones:") replace From/To/Via; an optional all-caps **subject** may stand
in for the salutation. Main paragraphs are **not numbered** (the subparagraph ladder shifts one level
deeper); a centered **"Sincerely,"** + signature; **Enclosures:** / **Separate Mailing:** notations at
the left margin. Same engine + exports (PDF / .docx / print / .json round-trip) as the standard letter.

## Multiple-address letter (Ch 8) — done
"The same as the standard letter, except in handling addresses" (8-1). A standard letter or memo
gains two optional list fields (`toAddrs`, `distribution`), so the three listing methods of 8-2 all work:
- **To: line only** (≤4 addressees, Fig 8-1): the primary `to` plus any **additional addressees**
  (`toAddrs`) stack one beneath the other, aligned under the To: content column.
- **Distribution: line only** (>4 addressees, or to vary copy counts, Fig 8-2): leave `to` empty —
  the To: line is **omitted entirely** (PDF and `.docx`) — and list action addressees in the
  **`Distribution:`** block, printed after the signature and **above** `Copy to:`. Copy counts are
  free text, e.g. `COMSUBFOR NORFOLK (4 copies)`.
- **Both** (group title in To:, members in Distribution:, Fig 8-3): put the collective title in `to`
  and the members in `distribution`.
A Proofread check (`addr-dist`) nudges past four To:-line addressees. Same engine + all exports;
endorsement pages do not inherit the extra addressees. Verified vs Figs 8-1/8-2 in PDF + `.docx`.

## Endorsement (Ch 9) — done (auto-on-Via or standalone)
Adding a Via addressee **automatically creates its endorsement** (one per non-empty Via, via
`syncViaEndorsements`), appended as extra page(s) after the basic letter/memo — never replacing
it. From ← the Via addressee (the endorser tracks the Via text), To/Subj carry forward, and the
"FIRST ENDORSEMENT on <basic letter>" line is derived from the basic document. A "+ Add a
standalone endorsement" button adds endorsers not in the Via list, and the standalone
`endorsement` type still exists for endorsing an external letter. Endorsements appear in both
the PDF (print) and the `.docx` export, and each can be signed normally or "By direction" /
"Acting" (same authority options as the basic signature). Per **9-2.2**, each endorsement's
"Via:" line carries the Via addressees that remain after that endorser (unnumbered if one,
numbered if more); the "To:" stays the action addressee — `remainingVias` in
format/identification.ts, used by both the preview and the .docx export.

## NATO travel order — done
The bilingual two-page form (order + reverse instructions), with U.S.-grade → NATO (OF/OR)
rank-code translation and the arms / dispatch / SOFA options.

## Proofread checklist (Ch 2, ¶19) — done
A pre-send review modeled on the manual's proofreading method (§2 ¶19), surfaced as the **Proofread**
tab (`components/Checklist.tsx`). **Advisory only — it flags and formats; it never blocks an export and
certifies nothing.** Three groups:
1. **Draft checks** (data-driven, `format/proofread.ts`) — pass/warn on what the writer supplies:
   subject present + ALL CAPS + no trailing period; From/To present; body has content; **no lone
   subparagraph** (¶19.b(6): a `1a` requires a `1b`); signature name and date set; every listed
   enclosure has a title (¶19.b(7)); business-letter inside-address + salutation. The ¶19.b *format*
   framework (1-inch margins, sequential numbering, centered page numbers, letterhead/ident placement,
   enclosure markings, CUI banners) is already guaranteed by the render engine, so it is listed as
   "handled automatically," not re-checked.
2. **Sensitive-data scan** (`format/pii.ts`) — a **local-only** heuristic that flags SSN
   (`nnn-nn-nnnn`), a bare 9-digit run (possible SSN), a 10-digit run (possible DoD ID / EDIPI — or a
   phone number), and date-of-birth markers, located by area (body, signature, …). Nothing is logged,
   stored, or transmitted; deciding what is PII/CUI, and marking it, remains the writer's call.
3. **Substance checkboxes** (¶19.c typos/spelling/grammar, ¶19.d read-for-content, plus the
   judgment items only a person can confirm — addressee currency, references available, enclosures
   attached, marking matches content, signing authority). Session-only; they reset on leaving the tab,
   by design — re-verify after any change.
A non-blocking "to review" count (warnings + sensitive-data hits) shows as a badge on the tab.

## Exports — done
- **PDF** (`export/signablePdf.ts`): pixel-accurate, vector/searchable; embeds a real AcroForm
  digital-signature field (`/FT /Sig`) over each signature space (basic letter + every endorsement),
  all collected into one AcroForm; renders endorsements, in-document enclosures (images embedded,
  PDFs copied as real pages), and CUI banners top/bottom of every page — with a per-page override so
  an enclosure can carry its **own** banner (see *Per-enclosure banners* above). Page numbers skip the
  enclosure pages (they carry the "Enclosure (n)" mark instead).
- **.docx** (`export/docx.ts`): editable Word mirror — embeds the seal as an image, CUI via Word
  headers/footers, section titles + inline emphasis as styled runs. Each in-document enclosure is its
  **own Word section** so it can carry its own CUI header/footer banner; PDF enclosures are rasterized
  to page images (`export/rasterizePdf.ts`, pdf.js) since a `.docx` can't hold vector PDF pages.
- **.json** (`export/roundtrip.ts`): a separate plain-text project file for lossless re-import via
  the Editor tab — never embedded in the `.docx`/PDF (clean documents).
- **SSIC lookup (impl):** the editor offers a searchable combobox over a curated common-code list
  (`data/ssic.ts`, all 13 major groups + common second-level codes) — filter by number *or* keyword,
  click to fill. It is **not** the full ~2,200-code catalog (SECNAV M-5210.2); unknown codes are typed
  directly and never fabricated.
- **Starter templates (impl):** one-click examples (appreciation / request / MFR / business,
  `data/templates.ts`) load a correctly-structured draft into the editor with `[BRACKETS]` for the
  parts to replace; loading one is undoable. Static bundled content — nothing fetched.

## Known gaps / TODO
- In-document enclosures are tied to a specific enclosure entry and auto-marked "Enclosure (n)" on
  their appended pages (PDF + `.docx`), and each can carry its own CUI banner. The separate
  client-side "combine into one PDF" **packet** tool (pdf-lib merge of an already-saved letter PDF +
  loose enclosure files) does **not** yet re-mark "Enclosure (n)" on the merged pages — that's still TODO.
- Mid-paragraph page splitting (currently breaks only at paragraph boundaries; the "≥2 lines each side"
  rule, 7-2.13).
- Other types: decision memos and MOA/MOU sub-variants; naval messages (GENADMIN/MARADMIN/ALMAR).
- A deeper advisor / style-suggestion layer beyond the Ch 2 ¶19 proofread checklist (done).
