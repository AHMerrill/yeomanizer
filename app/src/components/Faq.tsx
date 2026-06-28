// FAQ / Security & CUI tab. Honest, grounded answers — the tool makes no authorization claim; it
// explains how it's designed to stay out of the CUI-handling chain. Each answer carries clickable
// "read more" links to authoritative sources (DoD / eCFR / NARA for CUI; MDN / json.org / OWASP
// for the "is it code?" answers). Sourced from DoDI 5200.48, 32 CFR 2002, and DoD CUI guidance.
import type { ReactNode } from 'react';

interface Link {
  label: string;
  url: string;
}

// Authoritative references, defined once and reused.
const SRC = {
  dodi: { label: 'DoDI 5200.48', url: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/520048p.PDF' },
  cuiProgram: { label: 'DoD CUI Program', url: 'https://www.dodcui.mil/' },
  telework: { label: 'DoD CUI telework guidance', url: 'https://www.dodcui.mil/Frequently-Asked-Questions/Telework/' },
  cfr: { label: '32 CFR Part 2002', url: 'https://www.ecfr.gov/current/title-32/subtitle-B/chapter-XX/part-2002' },
  cfrSafeguard: { label: '32 CFR 2002.14 — Safeguarding', url: 'https://www.ecfr.gov/current/title-32/subtitle-B/chapter-XX/part-2002/subpart-B/section-2002.14' },
  nara: { label: 'NARA CUI Registry', url: 'https://www.archives.gov/cui' },
  nist: { label: 'NIST SP 800-171 (Rev 3)', url: 'https://csrc.nist.gov/pubs/sp/800/171/r3/final' },
  jsonParse: { label: 'MDN — JSON.parse', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse' },
  jsonOrg: { label: 'json.org', url: 'https://www.json.org/' },
  ecma404: { label: 'ECMA-404 (JSON standard)', url: 'https://ecma-international.org/publications-and-standards/standards/ecma-404/' },
  evalMdn: { label: 'MDN — why eval is different', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval' },
  owaspXss: { label: 'OWASP — XSS prevention', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' },
  adobeCac: { label: 'Adobe — certificate-based signatures', url: 'https://helpx.adobe.com/acrobat/using/certificate-based-signatures.html' },
  repo: { label: 'Source code (GitHub)', url: 'https://github.com/AHMerrill/yeomanizer' },
} satisfies Record<string, Link>;

function QA({ q, sources, children }: { q: string; sources?: Link[]; children: ReactNode }) {
  return (
    <section className="faq-item">
      <h3>{q}</h3>
      <div className="faq-a">{children}</div>
      {sources && sources.length > 0 && (
        <div className="faq-links">
          <span className="faq-links-label">Read more:</span>
          {sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export function Faq() {
  return (
    <div className="faq">
      <div className="faq-inner">
        <h1>Security &amp; CUI</h1>
        <p className="faq-lede">
          How the yeomanizer handles your information, and why it&rsquo;s built to stay out of the
          CUI-handling chain. This is an unofficial tool — it makes no authorization
          claim. Always follow your command&rsquo;s policy and your security manager&rsquo;s guidance.
          Each answer links to authoritative sources — and the tool&rsquo;s full source code is
          public — so you (or your security team) can verify every claim.
        </p>

        <QA q="Does anything I type get saved or sent anywhere?" sources={[SRC.repo]}>
          No. The tool sends and stores nothing. What you type lives only in this browser tab, in
          memory, and is erased when you close it. The only things that ever leave your browser are
          two anonymous, content-free counters — page loads and download-button clicks, each just an
          integer — never any of your content, no cookies, and never your IP address or region. You
          can confirm
          this yourself in your browser&rsquo;s developer tools (Network tab): no request carries your
          content. You download the files and handle them yourself.
        </QA>

        <QA q="What exactly do the page-load and download-click counters record?" sources={[SRC.repo]}>
          Two integers, and nothing else. One ticks up every time the page loads — a refresh counts
          again — and the other every time a download button is clicked, whether or not you actually
          save the file. They are deliberately <em>not</em> unique-visitor counts: recognizing you
          across visits would require a cookie, a stored ID, or your IP address, and the tool uses
          none of those. The server code takes only the storage handle, so it never sees your IP,
          region, browser, or any document content; there are no cookies and no per-visitor memory of
          any kind. (Like every website, the hosting network routes your connection and can show the
          owner only coarse, aggregate country totals at the transport layer — the yeomanizer&rsquo;s
          own counter never receives or keeps any of that.) They&rsquo;re just two raw, site-wide
          numbers shown in the footer.
        </QA>

        <QA q="Is this an official or DoD-approved tool?" sources={[SRC.cuiProgram, SRC.nara]}>
          No. It&rsquo;s an unofficial aid — not affiliated with or endorsed by the U.S. Navy or DoD,
          not an official system of record, and it claims no Authority to Operate (ATO) or other
          authorization. Use it as a formatting aid, per your command&rsquo;s policy.
        </QA>

        <QA q="Can I use it with CUI?" sources={[SRC.dodi, SRC.telework, SRC.cfrSafeguard]}>
          The rule is about the <em>computer</em>, not the tool. CUI is only authorized on systems
          approved for it — Government-Furnished Equipment (GFE) or a specifically-approved setup —
          never a personal device. (DoD telework guidance requires GFE for work involving CUI.) On
          such a system the tool runs in your browser like any local app and uploads nothing, so
          your CUI never leaves the machine. It cannot make an unauthorized device OK for CUI.
        </QA>

        <QA
          q="When I load a saved .json with CUI, is it processing CUI somewhere risky?"
          sources={[SRC.dodi, SRC.cfr]}
        >
          It processes it <em>locally</em>, in your browser, on your machine — exactly the same as
          when you type it in. The tool&rsquo;s server never receives, processes, stores, or
          transmits your content; there is no cloud step. Note that a .json (or .docx/.pdf) that
          contains CUI is itself CUI — store it and send it only on, and through,
          authorized systems and channels, like any other CUI file.
        </QA>

        <QA
          q="Is it NIST SP 800-171 compliant? Can I use it on a government network?"
          sources={[SRC.nist]}
        >
          NIST SP 800-171 sets the controls for protecting CUI on non-federal (and many DoD) systems.
          This tool is designed to stay on the right side of those controls rather than
          to claim a formal accreditation or ATO: every bit of processing happens in your browser (no
          server ever receives or transmits your content), nothing is stored or persisted (your draft
          lives only in the tab and is erased when you close it), there are no accounts, cookies,
          telemetry, or analytics, and it runs fully offline / air-gapped once loaded.
          The only thing that ever leaves the browser is two content-free integer counters (page loads
          and download-button clicks). It makes no authorization claim and certifies nothing — you and
          your command remain responsible for handling CUI per policy on authorized equipment. Run it on
          an approved system and follow your command&rsquo;s guidance.
        </QA>

        <QA q="Are the downloads safe, regular file types?" sources={[SRC.jsonOrg, SRC.ecma404]}>
          Yes. .docx (Office Open XML, ISO/IEC 29500), .pdf (ISO 32000), and .json (ECMA-404) are
          open, standard, non-executable file types — no macros, no scripts. And by design there is
           no hidden or embedded data inside the documents: what you see is what the
          file contains. The editable .json is a separate, plain-text file you can open and read in
          any text editor.
        </QA>

        <QA
          q="Could the .json — or a document — contain or run code?"
          sources={[SRC.jsonParse, SRC.evalMdn, SRC.owaspXss, SRC.repo]}
        >
          No. The app never executes file content. It reads the .json with <code>JSON.parse</code>,
          which only produces data — unlike <code>eval</code>, it does not run code. All text is
          rendered escaped, so a script-looking string is shown as plain text and never runs, and
          only image/PDF data is accepted for enclosures. There is no code-execution path anywhere
          in the app.
        </QA>

        <QA q="Will the download button work on a DoD computer?" sources={[SRC.telework]}>
          Standard browser downloads of regular files work in Edge and Chrome — the .docx, .json,
          and the signable PDF all download the same ordinary way. If your enclave restricts
          downloads, you can also use your browser&rsquo;s Print → Save as PDF. (Whether you can
          reach the site at all is governed by your network&rsquo;s web policy.)
        </QA>

        <QA q="What is the CAC-signable field in the PDF?" sources={[SRC.adobeCac]}>
          The exported PDF carries a real digital-signature field. Open it in Adobe and sign with
          your CAC (Certificates → Digitally Sign) — no &ldquo;Prepare a Form&rdquo; step needed. The
          field is invisible on a printed copy.
        </QA>

        <QA
          q="Who is responsible for handling the CUI?"
          sources={[SRC.dodi, SRC.cfrSafeguard, SRC.nara]}
        >
          You are. The tool helps you mark it correctly (banners and the designation block) and
          never persists it, but the CUI determination, marking accuracy, storage, transmission over
          encrypted/approved channels, and destruction are your responsibility under DoDI 5200.48 /
          32 CFR 2002 and your command&rsquo;s policy.
        </QA>

        <QA q="Bottom line — is this above board?" sources={[SRC.cuiProgram, SRC.nara, SRC.repo]}>
          The tool is built to stay out of the CUI-handling chain: it doesn&rsquo;t store or transmit
          your content, embeds nothing hidden, uses ordinary file types, runs entirely in your
          browser, and makes no authorization claim. Used on an authorized system, per your
          command&rsquo;s policy, with the output handled per the rules, it&rsquo;s designed not to be
          the weak link — but it cannot and does not authorize anything itself. When in doubt, ask
          your ISSM or security manager.
        </QA>

        <p className="faq-sources">
          This page is informational, not legal or security advice. Links open official sources in a
          new tab.
        </p>

        <div className="about-suggest">
          A security question we haven&rsquo;t answered?{' '}
          <a href="mailto:info@yeomanizer.com?subject=Security%20question">Email info@yeomanizer.com</a>.
        </div>
      </div>
    </div>
  );
}
