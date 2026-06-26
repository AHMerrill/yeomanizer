// Features / About page — reached from the top tab. Two columns: what works now and
// what's planned, plus a prompt to email suggestions. Static content; no state.

const AVAILABLE: [string, string][] = [
  ['Standard naval letter', 'Exact SECNAV M-5216.5 layout, formatted live as you type.'],
  ['Memorandum (From-To)', 'The MEMORANDUM heading and From/To/Subj block, same engine.'],
  ['Endorsements', 'Add a Via addressee and the endorsement appends as its own page(s) — or build a standalone endorsement.'],
  ['NATO travel order', 'The bilingual two-page form, with U.S. → NATO rank codes filled in.'],
  ['Live preview', 'Overleaf-style: the formatted page updates with every keystroke.'],
  ['PDF export', 'Print or Save as PDF — then print and wet-sign, or CAC-sign in Adobe.'],
  ['Word (.docx) export', 'An editable Word version of the same document.'],
  ['Letterhead control', 'Printed, plain paper, or pre-printed stock; the authentic DoD seal.'],
  ['Identification block', "SSIC, originator's code, serial, and date — each optional."],
  ['References, enclosures, copy-to', 'Auto-lettered (a), (b)… and numbered (1), (2)…'],
  ['Automatic paragraph numbering', 'Nested subparagraphs indent and renumber themselves.'],
  ['Rank auto-translation', 'Pick a U.S. grade (E-1…O-10); the NATO OF/OR code is filled in.'],
  ['CUI marking', 'Banner top & bottom plus the designation block, per DoDI 5200.48 and DON PII guidance.'],
  ['Private by design', 'Nothing is stored or transmitted — your draft is erased when you close the tab.'],
];

const PLANNED: [string, string][] = [
  ['Click-to-sign CAC field', 'A digital-signature field placed in the exported PDF so you can CAC-sign in one click.'],
  ['Attach enclosures', 'Drop in a file and have it merged into the exported document.'],
  ['More letter types', 'Business letter, multiple-address, and multiple-reply letters.'],
  ['Save drafts locally', 'Optional, on your device only — never on a server.'],
  ['Expanded SSIC lookup', 'Search the full Standard Subject Identification Code list.'],
  ['Mobile polish', 'A layout tuned for phones and tablets.'],
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
          entirely inside your browser. Nothing you type is ever saved or sent.
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
