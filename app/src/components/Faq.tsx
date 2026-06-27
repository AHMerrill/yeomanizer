// FAQ / Security & CUI tab. Honest, grounded answers — the tool makes no authorization claim;
// it explains how it's designed to stay out of the CUI-handling chain. Sourced from DoDI 5200.48,
// 32 CFR 2002, and DoD CUI Program telework guidance.
import type { ReactNode } from 'react';

function QA({ q, children }: { q: string; children: ReactNode }) {
  return (
    <section className="faq-item">
      <h3>{q}</h3>
      <div className="faq-a">{children}</div>
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
          CUI-handling chain. This is an <strong>unofficial</strong> tool — it makes no authorization
          claim. Always follow your command&rsquo;s policy and your security manager&rsquo;s guidance.
        </p>

        <QA q="Does anything I type get saved or sent anywhere?">
          No. The tool sends and stores nothing. What you type lives only in this browser tab, in
          memory, and is erased when you close it. The single thing that ever leaves your browser is
          an anonymous, content-free download counter (an integer) — never any of your content. You
          download the files and handle them yourself.
        </QA>

        <QA q="Is this an official or DoD-approved tool?">
          No. It&rsquo;s an unofficial aid — not affiliated with or endorsed by the U.S. Navy or DoD,
          not an official system of record, and it claims no Authority to Operate (ATO) or other
          authorization. Use it as a formatting aid, per your command&rsquo;s policy.
        </QA>

        <QA q="Can I use it with CUI?">
          The rule is about the <em>computer</em>, not the tool. CUI is only authorized on systems
          approved for it — Government-Furnished Equipment (GFE) or a specifically-approved setup —
          never a personal device. (DoD telework guidance requires GFE for work involving CUI.) On
          such a system the tool runs in your browser like any local app and uploads nothing, so
          your CUI never leaves the machine. It cannot make an unauthorized device OK for CUI.
        </QA>

        <QA q="When I load a saved .json with CUI, is it processing CUI somewhere risky?">
          It processes it <em>locally</em>, in your browser, on your machine — exactly the same as
          when you type it in. The tool&rsquo;s server never receives, processes, stores, or
          transmits your content; there is no cloud step. Note that a .json (or .docx/.pdf) that
          contains CUI is <strong>itself CUI</strong> — store it and send it only on, and through,
          authorized systems and channels, like any other CUI file.
        </QA>

        <QA q="Are the downloads safe, regular file types?">
          Yes. .docx, .pdf, and .json are standard, non-executable file types — no macros, no
          scripts. And by design there is <strong>no hidden or embedded data</strong> inside the
          documents: what you see is what the file contains. (The editable .json is a separate,
          plain-text file you can open and read in any text editor.)
        </QA>

        <QA q="Could the .json — or a document — contain or run code?">
          No. The app never executes file content. It reads the .json with <code>JSON.parse</code>,
          which only produces data (unlike <code>eval</code>, it does not run code); it renders all
          text escaped, so a script-looking string is shown as plain text and never runs; and it
          accepts only image/PDF data for enclosures. There is no code-execution path anywhere in
          the app.
        </QA>

        <QA q="Will the download button work on a DoD computer?">
          Standard browser downloads of regular files work in Edge and Chrome — the .docx, .json,
          and the signable PDF all download the same ordinary way. If your enclave restricts
          downloads, you can also use your browser&rsquo;s Print → Save as PDF. (Whether you can
          reach the site at all is governed by your network&rsquo;s web policy.)
        </QA>

        <QA q="What is the CAC-signable field in the PDF?">
          The exported PDF carries a real digital-signature field. Open it in Adobe and sign with
          your CAC (Certificates → Digitally Sign) — no &ldquo;Prepare a Form&rdquo; step needed. The
          field is invisible on a printed copy.
        </QA>

        <QA q="Who is responsible for handling the CUI?">
          You are. The tool helps you mark it correctly (banners and the designation block) and
          never persists it, but the CUI determination, marking accuracy, storage, transmission over
          encrypted/approved channels, and destruction are your responsibility under DoDI 5200.48 /
          32 CFR 2002 and your command&rsquo;s policy.
        </QA>

        <QA q="Bottom line — is this above board?">
          The tool is built to stay out of the CUI-handling chain: it doesn&rsquo;t store or transmit
          your content, embeds nothing hidden, uses ordinary file types, runs entirely in your
          browser, and makes no authorization claim. Used on an authorized system, per your
          command&rsquo;s policy, with the output handled per the rules, it&rsquo;s designed not to be
          the weak link — but it cannot and does not authorize anything itself. When in doubt, ask
          your ISSM or security manager.
        </QA>

        <p className="faq-sources">
          References: DoDI 5200.48 (Controlled Unclassified Information); 32 CFR Part 2002; DoD CUI
          Program telework guidance (dodcui.mil). This page is informational, not legal or security
          advice.
        </p>

        <div className="about-suggest">
          A security question we haven&rsquo;t answered?{' '}
          <a href="mailto:info@yeomanizer.com?subject=Security%20question">Email info@yeomanizer.com</a>.
        </div>
      </div>
    </div>
  );
}
