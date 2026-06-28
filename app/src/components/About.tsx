// Features / About page — reached from the top tab. Two columns: what works now and
// what's planned, plus a prompt to email suggestions. Static content; no state.

const AVAILABLE: [string, string][] = [
  ['Standard naval letter', 'Exact SECNAV M-5216.5 layout, formatted live as you type.'],
  ['Memorandum (From-To)', 'The MEMORANDUM heading and From/To/Subj block, same engine.'],
  ['Memorandum for the Record (MFR)', 'Plain bond, date-only identification, “MEMORANDUM FOR THE RECORD” — to capture a meeting, call, or oral agreement (Ch 10).'],
  ['Business letter', 'For firms, agencies, or people outside the DoD (Ch 11): an inside address and salutation, a civilian-style date, unnumbered paragraphs, and a centered “Sincerely,” over the signature.'],
  ['Endorsements', 'Add a Via and the endorsement appends as its own page — with its own signature block, and its own CAC-signable field in the PDF.'],
  ['NATO travel order', 'The bilingual two-page form, with U.S. → NATO rank codes filled in.'],
  ['Live preview', 'Overleaf-style: the formatted page updates with every keystroke.'],
  ['CAC-signable PDF', 'One pixel-accurate PDF of the whole package — letter, endorsements, enclosures, CUI — with selectable, searchable text and a built-in CAC signature field. Open it to print, save, or sign (no Prepare-a-Form step).'],
  ['Word (.docx) export', 'An editable Word version of the full document — endorsements, enclosures, and CUI included.'],
  ['Editable .json copy', 'Export a small plain-text .json of your draft and drop it back into the Editor tab later to keep working — the .docx and PDF stay clean, with nothing hidden inside them.'],
  ['Enclosures in the document', "Mark an enclosure “in the document” and drop in an image or PDF — it's appended and marked “Enclosure (n)”. Images embed; PDFs come in as real, searchable pages in the PDF."],
  ['Combine into one PDF', 'Or merge an already-saved letter PDF with separate enclosure files into one packet — entirely in your browser.'],
  ['Letterhead control', 'Printed, plain paper, or pre-printed stock; the authentic DoD seal.'],
  ['Identification block', "SSIC, originator's code, serial, and date — each optional."],
  ['References, enclosures, copy-to', 'Auto-lettered (a), (b)… and numbered (1), (2)…'],
  ['Automatic paragraph numbering', 'Nested subparagraphs indent and renumber themselves.'],
  ['Section titles', 'An optional underlined lead-in per paragraph — “1. Purpose. …” — per OPNAVINST 5400.45A.'],
  ['Inline emphasis', 'Type **bold**, *italic*, or __underline__ anywhere; it renders the same in the preview, the .docx, and the PDF.'],
  ['Rank auto-translation', 'Pick a U.S. grade (E-1…O-10); the NATO OF/OR code is filled in.'],
  ['Multi-page handling', 'Continuation pages start at the 1-inch margin and number from page 2 (§7-2.17).'],
  ['CUI marking', 'Banner top & bottom of every page — enclosures included — plus the designation block and optional per-paragraph (CUI)/(U) marks. Per DoDI 5200.48 and DON PII guidance.'],
  ['Phone, tablet, desktop', 'The two-pane layout stacks and the sheet scales to fit — usable from a phone up to a wide monitor.'],
  ['Private by design', 'The tool stores and transmits nothing — your draft lives only in this tab and is erased when you close it. You download and handle the files yourself.'],
  ['NIST 800-171 minded', 'Designed to support the controls for protecting CUI on non-federal systems — local-only processing, nothing transmitted, nothing stored, air-gap capable. Not a formal accreditation; see the FAQ.'],
];

const PLANNED: [string, string][] = [
  ['Per-enclosure CUI', 'Mark individual enclosures as CUI or not — each enclosure is its own document under the marking rules.'],
  ['PDF pages inside Word', 'Render attached PDF pages into the .docx as images (today they embed as real pages in the PDF and are referenced by name in Word).'],
  ['More letter types', 'Multiple-address and multiple-reply letters.'],
  ['Expanded SSIC lookup', 'Search the full Standard Subject Identification Code list.'],
];

function Column({ title, items, planned }: { title: string; items: [string, string][]; planned?: boolean }) {
  return (
    <section className="about-col">
      <h2>{title}</h2>
      <ul className={planned ? 'feat planned' : 'feat'}>
        {items.map(([t, d]) => (
          <li key={t}>
            <strong>{t}</strong>
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function About() {
  return (
    <div className="about">
      <div className="about-inner">
        <h1>the yeomanizer</h1>
        <p className="about-lede">
          A free, unofficial tool that formats U.S. Navy correspondence to SECNAV M-5216.5 —
          entirely inside your browser. The tool never sends or stores what you type; you download
          the files and handle them yourself.
        </p>
        <div className="about-cols">
          <Column title="Available now" items={AVAILABLE} />
          <Column title="In progress &amp; planned" items={PLANNED} planned />
        </div>
        <div className="about-suggest">
          Have an idea?{' '}
          <a href="mailto:info@yeomanizer.com?subject=Feature%20suggestion">
            Email info@yeomanizer.com
          </a>{' '}
          to suggest functionality.
        </div>
      </div>
    </div>
  );
}
