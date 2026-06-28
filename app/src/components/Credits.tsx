// Credits / attribution — its own top-level tab. Everything the tool is built on, with links and
// licenses, plus an explicit statement that no competitor code was copied (clean-room). Static.
import { Timeline } from './Timeline';

const REPO = 'https://github.com/AHMerrill/yeomanizer';

// name, url, purpose, license — libraries whose CODE we use directly (as dependencies).
const LIBS: [string, string, string, string][] = [
  ['React', 'https://react.dev', 'User interface', 'MIT'],
  ['pdf-lib', 'https://github.com/Hopding/pdf-lib', 'Vector / searchable PDF generation', 'MIT'],
  ['docx', 'https://github.com/dolanmiu/docx', 'Microsoft Word (.docx) generation', 'MIT'],
  ['pdf.js', 'https://github.com/mozilla/pdf.js', 'Rasterizing PDF enclosure pages into the .docx', 'Apache-2.0'],
  ['JSZip', 'https://github.com/Stuk/jszip', 'Re-packing the .docx to strip metadata', 'MIT'],
  ['nspell', 'https://github.com/wooorm/nspell', 'Offline spell-check engine (runs in the browser)', 'MIT'],
  ['en_US Hunspell dictionary (SCOWL)', 'https://github.com/wooorm/dictionaries', 'Bundled offline spelling dictionary', 'MIT AND BSD'],
  ['Vite', 'https://vite.dev', 'Build tooling', 'MIT'],
  ['TypeScript', 'https://www.typescriptlang.org', 'Language & types', 'Apache-2.0'],
];

// Projects whose IDEAS we learned from. "Code used directly?" is No for every one — clean-room.
const IDEAS: { name: string; url: string; license: string; learned: string }[] = [
  {
    name: 'dondocs',
    url: 'https://github.com/marinecoders/dondocs',
    license: 'MIT (app) — its bundled LaTeX engine is AGPL-3.0, which we do not use',
    learned: 'Examples, in-context learning, richer menus.',
  },
  {
    name: 'SemperScribe',
    url: 'https://github.com/SemperAdmin/SemperScribe',
    license: 'MIT',
    learned: 'A proofread checklist tied to the manual; a published threat model.',
  },
  {
    name: 'navalletterformat',
    url: 'https://github.com/jeranaias/navalletterformat',
    license: 'MIT',
    learned:
      'Editor UX — paragraph reordering, starter templates, session-only PII handling. We also adapted their compiled SSIC catalog (2,240 codes from the public-domain SECNAV M-5210.2) as our full code lookup — data, with attribution; no code copied.',
  },
  {
    name: 'mildoc-lint',
    url: 'https://github.com/cjchanh/mildoc-lint',
    license: 'Apache-2.0',
    learned: 'The model for deterministic pre-export checks and a published threat model.',
  },
];

const AUTHORITIES: [string, string][] = [
  ['SECNAV M-5216.5', 'Department of the Navy Correspondence Manual — the core format rules.'],
  ['OPNAVINST 5400.45A', 'Underlined section-title lead-ins.'],
  ['SECNAV M-5210.2', 'Standard Subject Identification Codes (SSIC).'],
  ['DoDI 5200.48 · ISOO CUI Marking Handbook · 32 CFR 2002', 'Controlled Unclassified Information marking.'],
];

function ext(href: string, label: string) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

export function Credits() {
  return (
    <div className="credits">
      <div className="credits-inner">
        <h1>Credits</h1>
        <p className="credits-lede">
          The yeomanizer is open source under the <b>Apache License 2.0</b> (see the{' '}
          {ext(`${REPO}/blob/main/LICENSE`, 'LICENSE')} and {ext(`${REPO}/blob/main/NOTICE`, 'NOTICE')}).
          Everything it relies on is public, open material — listed here in full.
        </p>

        <section className="credits-sec">
          <h2>Standards &amp; data</h2>
          <p className="credits-note">U.S. Government publications in the public domain.</p>
          <ul className="credits-list">
            {AUTHORITIES.map(([n, d]) => (
              <li key={n}>
                <b>{n}</b> — {d}
              </li>
            ))}
            <li>
              <b>DoD &amp; Department of War seals</b> — U.S. Government works in the public domain, used
              only at their prescribed size and ink for official letterhead.
            </li>
          </ul>
        </section>

        <section className="credits-sec">
          <h2>Built on (open-source libraries)</h2>
          <p className="credits-note">
            Code we use <b>directly</b>, each under a permissive license; the full license text ships
            inside every package.
          </p>
          <table className="credits-table">
            <thead>
              <tr>
                <th>Library</th>
                <th>Purpose</th>
                <th>License</th>
              </tr>
            </thead>
            <tbody>
              {LIBS.map(([n, u, p, l]) => (
                <tr key={n}>
                  <td>{ext(u, n)}</td>
                  <td>{p}</td>
                  <td>{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="credits-sec">
          <h2>Ideas we learned from</h2>
          <p className="credits-note">
            Open-source naval-correspondence projects whose <b>feature ideas</b> informed ours. Every
            feature here was written from scratch — <b>no source code was copied</b> from any of them.
            One <i>data</i> file is reused with attribution: jeranaias&rsquo;s compiled SSIC catalog
            (itself drawn from the public-domain {ext('https://www.secnav.navy.mil/doni/manuals-secnav.aspx', 'SECNAV M-5210.2')}),
            which backs our full SSIC search.
          </p>
          <table className="credits-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>License</th>
                <th>Code used directly?</th>
                <th>What we learned</th>
              </tr>
            </thead>
            <tbody>
              {IDEAS.map((p) => (
                <tr key={p.name}>
                  <td>{ext(p.url, p.name)}</td>
                  <td>{p.license}</td>
                  <td className="credits-no">No</td>
                  <td>{p.learned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="credits-note">
          If a credit is missing or wrong, {ext(`${REPO}/issues`, 'open an issue')} and we&rsquo;ll
          correct it.
        </p>

        <Timeline />
      </div>
    </div>
  );
}
