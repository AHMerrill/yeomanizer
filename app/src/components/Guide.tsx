// Plain-language guide to U.S. Navy correspondence, written for NON-yeomen — as if an experienced
// yeoman were teaching a layman who has never written one of these. It deliberately focuses on the
// CHOICES the writer makes (letterhead, section titles, CUI, emphasis, routing) and skips the
// mechanical formatting the tool does automatically (paragraph numbering, margins, font, date).
// Grounded in SECNAV M-5216.5 (June 2015). Pure static reference: it never reads what the user types
// and makes no authorization claim. The "Browse the full manual" section (ManualBrowser) lazy-loads
// the complete manual text and offers in-browser search + chapter/section reading.

import { ManualBrowser } from './ManualBrowser';

const PUB_TITLE = 'SECNAV M-5216.5';
const PUB_DATE = 'June 2015';
// Canonical source — the DON Issuances "SECNAV Manuals" index (the page bots can't fetch but humans can).
const PUB_URL = 'https://www.secnav.navy.mil/doni/manuals-secnav.aspx';

interface TypeInfo {
  name: string;
  blurb: React.ReactNode;
  inApp?: boolean;
}

const TYPES: TypeInfo[] = [
  {
    name: 'Standard Naval Letter',
    inApp: true,
    blurb: 'The formal default. Official business that goes up your chain of command or outside your command — requests, reports, recommendations. Printed on letterhead, with the From / To / Via block and numbered paragraphs.',
  },
  {
    name: 'Memorandum',
    inApp: true,
    blurb: 'Informal, for routine business within your own command. Plain bond paper, less ceremony. Same From / To idea, headed “MEMORANDUM.”',
  },
  {
    name: 'Memorandum for the Record (MFR)',
    inApp: true,
    blurb: 'Documents something for the file — the result of a meeting, an important phone call, an oral agreement. It isn’t addressed or sent to anyone; you write it, sign it, and file it.',
  },
  {
    name: 'Endorsement',
    inApp: true,
    blurb: 'A short forwarding note someone adds when a letter routes “Via” them — usually passing it up the chain with a recommendation (“Forwarded, recommending approval”). The tool adds one automatically for each Via addressee.',
  },
  {
    name: 'Business Letter',
    inApp: true,
    blurb: 'For writing to civilians, firms, or agencies outside the DoD who wouldn’t recognize the standard naval format (Ch 11). Uses an inside address and a salutation (“Dear Ms. Smith:”), a civilian-style date, and a centered “Sincerely,” over the signature — main paragraphs are not numbered.',
  },
  {
    name: 'Multiple-Address Letter',
    blurb: 'One letter sent to several action addressees at once (rather than the same letter retyped for each).',
  },
  {
    name: 'NATO Travel Order',
    inApp: true,
    blurb: 'The bilingual travel-order form used for official travel in NATO / SOFA countries. A form, not a letter — different rules entirely.',
  },
];

interface QA {
  q: string;
  a: React.ReactNode;
}

const SECTIONS: { id: string; heading: string; intro?: React.ReactNode; items: QA[] }[] = [
  {
    id: 'choices',
    heading: 'The choices you make',
    intro: (
      <>
        The tool handles the mechanics — paragraph numbering, indentation, margins, the 12-point Times
        font, the date, capitalizing the subject. What it <em>can’t</em> decide for you is below. This is
        where a yeoman’s judgment actually lives.
      </>
    ),
    items: [
      {
        q: 'When do I use letterhead?',
        a: (
          <>
            Letterhead is your command’s printed header (DEPARTMENT OF THE NAVY plus your activity’s name
            and address). The rule of thumb: letters get letterhead, memos stay plain. A{' '}
            standard naval letter — anything formal going outside your command or up the
            chain — uses letterhead. A memorandum is internal and informal, so it’s on
            plain bond. The one exception is the “letterhead memorandum,” used only for routine matters
            with people <em>outside</em> your activity when direct liaison is authorized. (“Pre-printed”
            is for paper that already has the letterhead printed on it — the tool just reserves the space
            so your text lines up.)
          </>
        ),
      },
      {
        q: 'When do I need section titles?',
        a: (
          <>
            Section titles are short underlined labels at the start of a paragraph — <u>Purpose</u>.,{' '}
            <u>Background</u>., <u>Recommendation</u>. — that tell the reader what the paragraph covers.
            Use them when a document is long or structured enough that labeled sections
            help the reader (a multi-page letter, an instruction, a point paper). For a{' '}
            short, routine letter you usually don’t need them — plain numbered paragraphs
            are cleaner. On a one-pager, when in doubt, skip them.
          </>
        ),
      },
      {
        q: 'How should I think about breaking up paragraphs?',
        a: (
          <>
            One idea per paragraph, and lead with your bottom line — naval writing puts
            the main point first (the ask, the decision, the recommendation), then the supporting detail.
            Reach for sub-paragraphs (a, b, c) when a single paragraph carries several
            related sub-points — a list of conditions, steps, or reasons. Keep it tight; brevity is a
            virtue here. You just decide where one idea ends and the next begins, and when a point is
            really a sub-point — the tool numbers and indents the rest.
          </>
        ),
      },
      {
        q: 'Do I ever use bold, italics, or underline in the body — and when?',
        a: (
          <>
            Rarely. Traditional naval correspondence is plain — the format carries the
            emphasis, not the typography. Underline has one real job: section titles
            (above). Beyond that, use emphasis only for a genuinely critical word — a “NOT,” a hard
            deadline — and even then, sparingly. Bold and italics are uncommon in a
            standard letter; they show up more in instructions and briefs. The tool supports all three
            (type <code>**bold**</code>, <code>*italic*</code>, <code>__underline__</code>) for when you
            need them — but the default, and usually the right call, is to leave the body plain.
          </>
        ),
      },
      {
        q: 'When do I add an SSIC or a serial number?',
        a: (
          <>
            The SSIC (Standard Subject Identification Code) is a filing number that
            classifies the letter’s subject; the serial is a sequential control number.
            On a formal letter your command’s files office — the yeoman — normally assigns these. If
            you’re drafting and don’t have them, leave them off (toggle them out); the
            yeoman adds them before it goes out. Memos and MFRs usually just carry the date.
          </>
        ),
      },
      {
        q: 'When do I add a “Via” addressee (and get an endorsement)?',
        a: (
          <>
            Add a Via when your letter must <em>pass through</em> someone on its way to
            the action addressee — almost always your chain of command. Each Via addressee reviews it and
            forwards it with an endorsement (their recommendation). Example: a request
            from you to higher headquarters routes “Via” your Commanding Officer. The tool builds the
            endorsement page automatically for every Via you add.
          </>
        ),
      },
      {
        q: 'When do I sign “By direction” or “Acting”?',
        a: (
          <>
            These appear under the signature. “By direction” means you’re signing{' '}
            <em>for</em> the commanding officer under standing authority to sign certain correspondence on
            their behalf. “Acting” means you’re temporarily filling the billet (e.g., the
            XO acting as CO). If you <em>are</em> the official named in the “From” line, you use neither.
            If you’re not sure you have “by direction” authority, you probably don’t — ask.
          </>
        ),
      },
      {
        q: 'When do I mark something CUI?',
        a: (
          <>
            Controlled Unclassified Information is sensitive-but-unclassified material the
            government requires you to safeguard — most often privacy data / PII (SSNs,
            medical, personnel records). If your document contains it, check the CUI box: the tool adds the
            required banner at the top and bottom of every page plus the designation block. And remember —
            CUI may only be handled on authorized government equipment, never a personal
            device.
          </>
        ),
      },
      {
        q: 'When do I attach an enclosure versus just cite a reference?',
        a: (
          <>
            A reference points to an existing document the reader can look up on their own
            — an instruction, a prior letter — listed as (a), (b). An enclosure is
            something you’re <em>physically attaching</em> because the reader needs it in hand — a form, a
            chart, supporting paperwork — listed as (1), (2). The rule of thumb: if they can find it
            themselves, it’s a reference; if you have to hand it to them, it’s an enclosure.
          </>
        ),
      },
      {
        q: 'When do I use “Copy to”?',
        a: (
          <>
            Add a Copy to for commands or offices that <em>need to know</em> about the
            letter but aren’t the action addressee and aren’t in the routing chain — for awareness or
            coordination. It’s the naval-letter version of a CC.
          </>
        ),
      },
    ],
  },
  {
    id: 'basics',
    heading: 'First-timer basics',
    items: [
      {
        q: 'I’ve never written one. Where do I start?',
        a: (
          <>
            In the Builder tab, pick a type below, fill in the From / To / Subject, and
            type your paragraphs on the left — the formatted letter appears on the right. You only supply
            the words and the choices above; the tool does the rest.
          </>
        ),
      },
      {
        q: 'What goes in the “From” and “To” lines?',
        a: (
          <>
            From is the official <em>title</em> of the originator — “Commanding Officer,
            USS Example (DDG&nbsp;100)” — not a personal name. To is the action
            addressee: the command or office that has to act on the letter.
          </>
        ),
      },
      {
        q: 'What does the tool handle for me automatically?',
        a: (
          <>
            All the mechanical formatting you’d otherwise look up: paragraph and sub-paragraph numbering
            and indentation, one-inch margins, 12-point Times New Roman, the date (Day&nbsp;Mon&nbsp;Year),
            capitalizing the subject line, page numbering, and the signature block placement. You focus on
            content and the choices above.
          </>
        ),
      },
      {
        q: 'Is this official? Can I use it for real correspondence?',
        a: (
          <>
            It’s an unofficial formatting aid — not affiliated with or endorsed by the
            Navy or DoD, and it makes no authorization claim. Use it on authorized
            government equipment, follow your command’s policy, and treat your yeoman / admin office as the
            final word on format.
          </>
        ),
      },
    ],
  },
];

const TOC = [
  { id: 'types', label: 'Which document do I write?' },
  ...SECTIONS.map((s) => ({ id: s.id, label: s.heading })),
  { id: 'manual', label: 'Browse the full manual' },
];

export default function Guide() {
  // Floating "Back to top" — scrolls the Guide's scroll container (.faq) back to the top.
  const backToTop = () => document.querySelector('.faq')?.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <div className="faq">
      <div className="faq-inner">
        <h1 id="guide-top">Guide to naval correspondence</h1>
        <p className="faq-lede">
          A plain-language guide for anyone who hasn’t written Navy correspondence before — no yeoman
          experience assumed. It follows the Department of the Navy Correspondence Manual (
          
            {PUB_TITLE}, {PUB_DATE}
          
          ); you can{' '}
          <a href={PUB_URL} target="_blank" rel="noopener noreferrer">
            read the official manual
          </a>{' '}
          at the DON Issuances site. This guide focuses on the <em>choices you make</em> — the tool
          handles the mechanical formatting. Reference only: it never reads what you type, and the tool
          makes no authorization claim.
        </p>

        <nav className="guide-toc" aria-label="Jump to a section">
          <span className="guide-toc-label">Jump to</span>
          {TOC.map((t) => (
            <a key={t.id} href={`#${t.id}`}>
              {t.label}
            </a>
          ))}
        </nav>

        <section id="types" className="guide-section">
          <h2>Which document do I write?</h2>
          <p className="guide-section-intro">
            The yeomanizer builds these. Pick the one that fits — when in doubt, a Standard Naval Letter is
            the safe choice.
          </p>
          <dl className="guide-types">
            {TYPES.map((t) => (
              <div key={t.name} className="guide-type">
                <dt>
                  {t.name}
                  {t.inApp ? <span className="guide-type-tag">in the tool</span> : null}
                </dt>
                <dd>{t.blurb}</dd>
              </div>
            ))}
          </dl>
        </section>

        {SECTIONS.map((sec) => (
          <section key={sec.id} id={sec.id} className="guide-section">
            <h2>{sec.heading}</h2>
            {sec.intro ? <p className="guide-section-intro">{sec.intro}</p> : null}
            {sec.items.map((it) => (
              <details key={it.q} className="guide-qa">
                <summary>{it.q}</summary>
                <div className="guide-a">{it.a}</div>
              </details>
            ))}
          </section>
        ))}

        <section id="manual" className="guide-section">
          <h2>Browse the full manual</h2>
          <p className="guide-section-intro">
            The complete text of {PUB_TITLE} ({PUB_DATE}) — search it or read any chapter and section.
            It’s bundled with the app and read entirely in your browser; nothing you search is sent
            anywhere. For the authoritative, signed copy, always use the{' '}
            <a href={PUB_URL} target="_blank" rel="noopener noreferrer">
              DON Issuances site
            </a>
            .
          </p>
          <ManualBrowser />
        </section>
      </div>
      <button type="button" className="guide-totop" onClick={backToTop} aria-label="Back to top">
        ↑ Top
      </button>
    </div>
  );
}
