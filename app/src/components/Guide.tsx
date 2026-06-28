// Plain-language guide to U.S. Navy correspondence, written for NON-yeomen — people who have never
// written a naval letter and don't yet know which questions to ask. Every answer is grounded in
// SECNAV M-5216.5 (the Department of the Navy Correspondence Manual). This is reference content only;
// it never touches what the user types and makes no authorization claim. The full searchable manual
// + keyword search land in a later pass.

interface QA {
  q: string;
  a: React.ReactNode;
}

const SECTIONS: { heading: string; items: QA[] }[] = [
  {
    heading: 'Start here',
    items: [
      {
        q: 'I’ve never written a Navy letter. Where do I begin?',
        a: (
          <>
            In the <strong>Builder</strong> tab, pick a correspondence type, fill in the From / To /
            Subject, and type your paragraphs on the left — the formatted document appears on the
            right. The tool handles every mechanical rule (margins, font, spacing, paragraph
            numbering) for you. The questions below explain what each piece is and when to use it.
          </>
        ),
      },
      {
        q: 'There are several types. Which one do I pick?',
        a: (
          <>
            <strong>Standard Naval Letter</strong> — the formal default for official business,
            especially going <em>up</em> your chain of command or <em>outside</em> your command.
            <br />
            <strong>Memorandum</strong> — informal, for routine business <em>within</em> your own
            command.
            <br />
            <strong>Memorandum for the Record (MFR)</strong> — documents something for the file (a
            phone call, a meeting, an oral agreement); it isn’t addressed or sent to anyone.
            <br />
            <strong>Endorsement</strong> — a short forwarding note added when a letter passes “Via”
            someone (see below).
            <br />
            When in doubt, a Standard Naval Letter is the safe choice.
          </>
        ),
      },
      {
        q: 'Is this official? Can I use it for real correspondence?',
        a: (
          <>
            It’s an <strong>unofficial</strong> formatting aid — not affiliated with or endorsed by
            the Navy or DoD, and it makes <strong>no authorization claim</strong>. Use it on
            authorized government equipment, follow your command’s policy, and treat your command’s
            yeoman / admin office as the final word on format. Controlled Unclassified Information
            (CUI) belongs only on authorized equipment.
          </>
        ),
      },
    ],
  },
  {
    heading: 'The pieces of a letter',
    items: [
      {
        q: 'What goes in the “From” and “To” lines?',
        a: (
          <>
            <strong>From</strong> is the official <em>title</em> of the originator — e.g.,
            “Commanding Officer, USS Example (DDG&nbsp;100)” — not a person’s name. <strong>To</strong>{' '}
            is the action addressee: the command or office that has to act on the letter.
          </>
        ),
      },
      {
        q: 'What is the “Via” line, and how does routing work?',
        a: (
          <>
            “Via” addressees are the people your letter passes <em>through</em> on the way to the
            action addressee — usually your chain of command. Each Via addressee forwards the letter
            with an <strong>endorsement</strong> (a short note, often recommending approval or
            disapproval). In the Builder, adding a Via automatically creates its endorsement page.
          </>
        ),
      },
      {
        q: 'What exactly is an endorsement?',
        a: (
          <>
            When a letter routes “Via” someone, that person forwards it with an endorsement — labeled
            “FIRST ENDORSEMENT,” “SECOND ENDORSEMENT,” and so on — typically passing it up the chain
            with a recommendation. The tool builds one automatically for each Via addressee.
          </>
        ),
      },
      {
        q: 'How is the subject line supposed to look?',
        a: (
          <>
            <strong>ALL CAPS, no punctuation</strong>, stated concisely — e.g., “REQUEST FOR ANNUAL
            LEAVE.” The tool capitalizes it for you; you just type the words.
          </>
        ),
      },
      {
        q: 'How do I number paragraphs and sub-paragraphs?',
        a: (
          <>
            Main paragraphs are <strong>1, 2, 3</strong>; sub-paragraphs are <strong>a, b, c</strong>;
            then <strong>(1), (2)</strong>; then <strong>(a), (b)</strong>. You don’t type the
            numbers — the tool adds them automatically as you indent a paragraph.
          </>
        ),
      },
      {
        q: 'How do I cite references and enclosures?',
        a: (
          <>
            <strong>References</strong> are lettered (a), (b), (c) and listed in the “Ref:” line.
            <strong> Enclosures</strong> are numbered (1), (2) in the “Encl:” line. Mention each one in
            your text — e.g., “as required by reference (a)” or “(see enclosure (1)).”
          </>
        ),
      },
      {
        q: 'Where does the signature go, and what’s in it?',
        a: (
          <>
            Last name in CAPS, with <strong>no rank and no “Sincerely”</strong> — it sits on the right
            half of the page. A standard letter is signed by the official named in the “From” line. On
            an MFR, it’s just the signer’s name and organizational code (e.g., “N11”).
          </>
        ),
      },
    ],
  },
  {
    heading: 'Common questions',
    items: [
      {
        q: 'When do I put letterhead on a memo — or do I ever?',
        a: (
          <>
            Almost never. A memorandum is internal and informal, so <strong>plain bond paper</strong>{' '}
            is the default. The “letterhead memorandum” is reserved for routine matters with people{' '}
            <em>outside</em> your activity when direct liaison is authorized. Within your own command:
            plain paper.
          </>
        ),
      },
      {
        q: 'What’s the SSIC, and do I need one?',
        a: (
          <>
            The <strong>SSIC</strong> (Standard Subject Identification Code) is a numeric filing code.
            A yeoman normally assigns it. If you don’t know it, leave it blank — you can toggle it off
            in the Builder. Memos and MFRs often just use the date.
          </>
        ),
      },
      {
        q: 'What’s the date format?',
        a: (
          <>
            Day&nbsp;Month&nbsp;Year, abbreviated, no punctuation — e.g., <strong>“7 Sep 06.”</strong>{' '}
            The tool fills in today’s date automatically (you can override it).
          </>
        ),
      },
      {
        q: 'What is CUI, and how do I mark it?',
        a: (
          <>
            <strong>Controlled Unclassified Information</strong> — sensitive but unclassified material
            (for example, privacy / PII). If your document contains it, check the CUI box in the
            Builder and the tool adds the required banners (top and bottom of every page) and the
            designation block. CUI may only be handled on authorized government equipment.
          </>
        ),
      },
      {
        q: 'What’s a “business letter”?',
        a: (
          <>
            The format you use to write to <strong>civilians or organizations outside the DoD</strong>{' '}
            who wouldn’t recognize the standard naval letter. It uses a normal salutation (“Dear
            Ms.&nbsp;Smith:”) and closing (“Sincerely,”).
          </>
        ),
      },
      {
        q: 'What paper, font, and margins does the Navy use?',
        a: (
          <>
            8½ × 11 paper, <strong>Times New Roman 12-point</strong>, one-inch margins. The tool sets
            all of this for you — you never have to think about it.
          </>
        ),
      },
    ],
  },
];

export default function Guide() {
  return (
    <div className="faq">
      <div className="faq-inner">
        <h1>Guide to naval correspondence</h1>
        <p className="faq-lede">
          A plain-language guide for anyone who hasn’t written Navy correspondence before — no yeoman
          experience assumed. Every answer follows <strong>SECNAV M-5216.5</strong>, the Department of
          the Navy Correspondence Manual. (A searchable copy of the full manual is on the way.) This is
          reference only: it never reads what you type, and the tool makes no authorization claim.
        </p>
        {SECTIONS.map((sec) => (
          <section key={sec.heading} className="guide-section">
            <h2>{sec.heading}</h2>
            {sec.items.map((it) => (
              <details key={it.q} className="guide-qa">
                <summary>{it.q}</summary>
                <div className="guide-a">{it.a}</div>
              </details>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
