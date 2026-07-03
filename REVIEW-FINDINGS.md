# Full tenet review — 2026-07-02 (Fable 5)

Nine parallel audits (security, round-trip/renderer parity, editor UX, and six figure-by-figure
comparisons against every SECNAV M-5216.5 figure), each finding re-verified against the figure or
code before being accepted. Status: ☑ fixed · ☐ open (this pass) · ⏭ deferred (documented).

## Batch 1 — docx export geometry ☑
- ☑ **A4 page size** on every `.docx` (library default; no `w:pgSz` was set) → all sections now US Letter.
- ☑ **Ident blocks right-justified per line** (ragged left edge) vs the figures' left-aligned stack →
  `identColumn()` right-aligned fixed-width table (Times-metrics width estimate, zero cell margins).
  Applies to letter/business/endorsement idents, business p2 continuation, CUI designation blocks.
- ☑ **MOA party-B ident** per-line right tab → left-aligned column at ~5.6in (fig 10-5).
- ☑ **Top margins**: 1in for plain bond (was 0.5 everywhere); 0.5 only under a printed letterhead;
  letterhead reserves a 3-subline floor so a short heading clears the seal (memo seal collision).
- ☑ **Continuation header**: Subj padded down to ~1in (7-2.16) + blank line after (fig 7-2); banner at 0.25in.
- ☑ **Signature depth** 828 twips → name on the 4th line below text (7-2.14), all five sig sites.
- ☑ **Enclosure sections inherit page-number footer when CUI off** → explicit empty footer (PDF excludes them).
- ☑ Endorsement orphan `From:/To:/Subj:` labels for empty fields → gated like the PDF.
- ☑ Coordination docx column widths fixed (POC names no longer wrap); joint letterhead uppercased.

## Batch 2 — PDF export ☑ (business-notation + heading-gap fixes applied to all three renderers)
- ☑ Signature depth: name lands ~5.4 lines below text; rule is 4th line (all closes; move the CAC
  field rect over the whitespace instead of consuming layout height).
- ☑ Date→From gap on p1 reads ~2 blank lines (should be 1); same for MFR/MOA title→Subj gap.
- ☑ Paragraph-start orphan: a paragraph may not START at page bottom with <2 lines remaining (7-2.13 ¶3a).
- ☑ Render-harness samples pass no seal bytes → samples show no seal (app is fine — browser fetches
  the bundled asset; harness must read the PNG from disk like signablePdf.test.ts does).
- ☑ Appended endorsements not gated for `type==='endorsement'` (preview/docx skip them; PDF doesn't).
- ☑ Endorsement spill-over pages: re-arm the Subj continuation header (exports lack it; preview has it).
- ☑ Ref markers past 26 break (`({`) in the PDF while preview/docx print `(aa)`.

## Batch 3 — executive memo family ☑ (remaining: preview spill-page SUBJECT label uses Subj: style — minor)
- ☑ Head order inverted: figures 12-9/10/11 put the centered title ABOVE the date/control line.
- ☑ FOR:/FROM:/SUBJECT: are double-spaced in the figures (blank line between); render single-spaces.
- ☑ Memo-For: ½-inch paragraph indent (figure text explicit; render 0.25in); signature starts AT page
  center (render block-centers); `cc:` stacks label then names (render inlines); decision line follows
  RECOMMENDATION with no blank; Info-memo carries leftover recommendation spacing.
- ☑ Continuation pages must repeat (PDF+docx; preview label still Subj:-style) `SUBJECT:` (fig 12-15 footnote) — today PDF omits, docx prints
  `Subj:` uppercased, preview a third form.
- ☑ Exports print preview placeholder text as real content (empty FOR/recommendation/attachments
  export fabricated strings) — exports must render only user content.
- ☑ Coordination-page title is regular weight in fig 12-13 (render bolds it).
- ☑ Re-measure bullet left position (measured: FLUSH at margin, x identical to FOR: label; all three renderers now bullet-at-margin with 0.25in hang) vs fig 12-9 (agents split: flush-margin vs 0.25in).

## Batch 4 — joint letter ☑ (remaining → batch 6: preview From→To blank line, hide Identification card, blankFor 2 parties)
- ☑ Ident columns spread full width: junior at LEFT margin, senior at RIGHT (fig 7-4; render clusters
  both upper-right). 3-party: left / middle / right.
- ☑ No signature rules (typed names only); senior signature starts at page CENTER (2-party).
- ☑ Blank line between the From: block and To: (PDF+docx; preview pending in batch 6).
- ☑ Hide the dead Identification card for joint (per-party ident lives in Joint commands card).
- ☐ `blankFor('joint-letter')` leaves 0 parties (UI minimum is 2).

## Batch 5 — endorsements + import hardening ☐
- ☐ Fig 9-2: a new-page endorsement is prepared on the ENDORSING activity's letterhead — add optional
  per-endorsement letterhead fields (default off = current look), all three renderers.
- ☑ **Import sanitization gaps** (security): `endorsements` (incl. each `body` tree — bypasses the
  2000-node/12-deep caps → export-path DoS), `signature`, `nato`, `endorsementNumber/Of`, `encls`
  text/id/file.name/type pass through unsanitized. THREAT_MODEL claim currently falsified.
- ☑ Tighten enclosure data-URL whitelist to raster images + PDF (drop `image/svg+xml`, inert but a
  script carrier).
- ☑ Preview skips in-document enclosure pages for `type==='endorsement'` while both exports render them.
- ☑ Routing Via hint promises an Endorsements section that doesn't exist for `type==='endorsement'`.

## Batch 6 — editor / preview / proofread ☐
- ☐ `letterhead.titleOnly` honored only by the preview → exporters must skip activity/address too;
  add Letterhead-card controls for `line1` + title-only (flag template is locked to CNO today).
- ☑ Proofread is type-blind: demands Subj/Body/Signature/Date on coordination pages, ALL-CAPS subject
  + date + signature on exec memos (all wrong there); drop the subj-caps nag generally (renderers
  normalize).
- ☑ Dead controls: Signature card shown for joint + exec-Action/Info (never prints); SSIC/Code pills
  shown for exec (only date prints); Letterhead card shown for coordination page (ignored).
- ☑ Memo-from-to hides SSIC/Code pills though the renderer supports `Memo <code>/<serial>` (10-2
  "unless local practice calls for more") — show them (default off).
- ☑ Card Clear buttons miss fields (exec `cc`+FOR, CUI transmittalNote+controlledBy1, Enclosures'
  separateMailing, Identification date fields).
- ☑ NATO: CUI checkbox does nothing (NatoForm renders no banner/designation); preprinted letterhead
  mode prints the letterhead anyway.
- ☑ Business enclosures notation: fig 11-3 runs item 1 on the label line ("Enclosures: 1. X" with
  "2. Y" aligned under) — render puts the label alone.
- ☑ Preview-only divergences: CUI banner not uppercased (CSS); designation block repeats on each
  endorsement's first page; coordination page flows leftover body/distribution/copyTo the exports drop;
  Editor-tab type switch to MFR keeps appending via-endorsement pages.
- ☑ Templates: congressional/interim should default date-only ident (figs 12-2/12-4); "Request letter"
  template seeds a Via without running the endorsement sync.
- ☑ PDF signature-title should wrap (long titles like ASN(RD&A) overrun); MOA/joint PDF closes lack
  CAC signature fields (hint claims otherwise).

## Deferred (documented, deliberate) ⏭
- Fig 12-10 variants: control line inline on the FOR: line; three-option decision line (Approve/
  Disapprove/Other). Fig 12-7: centered date position. 5x7 / 7x9 flag stationery page sizes (tool
  prints letter-size).
- Endorsement ref/encl continuation numbering (start at (c)/(3) after the basic letter's).
- Preview cross-document page numbers (endorsement pages number in exports; preview numbers per-doc).
- Preview paginates a >1-page coordination table as one long sheet (exports paginate correctly).
- Import caps can silently clip legal oversized values on re-import (bounds are the hostile-input
  defense; documented).

## Verified-good highlights (no action)
- CSP locked (`connect-src 'self'`, `object-src/base-uri/form-action 'none'`, `frame-ancestors 'none'`);
  counter functions read only `{env}` — no IP/UA/body ever touched; no eval/innerHTML/storage of drafts
  anywhere; SW caches app shell only, never `/api/`; PDF+docx metadata fully neutralized (epoch dates,
  empty producer/creator, zip entry mod-times pinned); prototype-pollution reviver + spread semantics.
- Standard letter anatomy, para ladder (fig 7-8) to depth 6, multi-address (figs 8-1/2/3), MFR, memo,
  MOA dual idents/signatures, business anatomy, exec element order below the title, coordination table,
  CUI banner/designation placement + multipage — all match their figures aside from the items above.
