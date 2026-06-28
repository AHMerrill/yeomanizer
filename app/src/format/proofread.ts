import type { LetterState, Paragraph } from '../types';

// Pre-flight proofreading checks — grounded in SECNAV M-5216.5, Ch 2, ¶19 ("Proofreading"). All
// advisory: warnings, never blocks; the tool flags and formats, it certifies nothing. The format
// FRAMEWORK from ¶19.b (1-inch margins, sequential numbering, centered page numbers, …) is already
// guaranteed by the render engine, so these data-driven checks focus on what the writer supplies.

export type CheckStatus = 'pass' | 'warn';
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  hint: string; // shown when status is 'warn'
}

const anyText = (list: Paragraph[]): boolean =>
  list.some((p) => p.text.trim().length > 0 || anyText(p.children));
const hasLoneChild = (list: Paragraph[]): boolean =>
  list.some((p) => p.children.length === 1 || hasLoneChild(p.children));
const bodyText = (list: Paragraph[]): string =>
  list.map((p) => `${p.title ?? ''} ${p.text} ${bodyText(p.children)}`).join(' ');
// Highest index cited in the text for a "reference (x)" / "enclosure (n)" pattern (0 if none cited).
function maxCited(text: string, re: RegExp, toNum: (m: string) => number): number {
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) max = Math.max(max, toNum(m[1]));
  return max;
}

export function proofread(s: LetterState): Check[] {
  const out: Check[] = [];
  const add = (id: string, label: string, ok: boolean, hint: string) =>
    out.push({ id, label, status: ok ? 'pass' : 'warn', hint });
  const t = s.type;

  // Subject — every type except the NATO form and the business letter (which may use a salutation).
  if (t !== 'nato' && t !== 'business-letter') {
    const subj = s.subj.trim();
    add('subj', 'Subject line filled in', subj.length > 0, 'Add a Subj: line naming the topic.');
    if (subj) {
      add('subj-caps', 'Subject is in ALL CAPS', subj === subj.toUpperCase(), 'Type the subject in all capital letters.');
      add('subj-dot', 'Subject has no ending period', !/\.$/.test(subj), 'The subject is a phrase — drop the trailing period.');
    }
  }

  // From / To.
  if (t === 'standard-letter' || t === 'memo-from-to') {
    add('from', 'From line filled in', s.from.trim().length > 0, 'Name the originator (From:).');
    add('to', 'To line filled in', s.to.trim().length > 0, 'Name the action addressee (To:).');
    // Multiple-address letter (Ch 8-2): four or fewer addressees use the To: line; more than four
    // should move to a Distribution: line. Only flag when the To: block itself exceeds four.
    const toCount = (s.to.trim() ? 1 : 0) + s.toAddrs.filter((a) => a.text.trim()).length;
    if (toCount > 4)
      add('addr-dist', 'Four or fewer addressees on the To: line', s.distribution.some((d) => d.text.trim()),
        'More than four action addressees: list them in a Distribution: line instead (8-2).');
  }
  if (t === 'endorsement') {
    add('from', 'From line filled in', s.from.trim().length > 0, 'Name the endorsing command (From:).');
  }

  // Body (¶19.b(6): paragraphs sequentially numbered/lettered — never a single subdivision).
  if (t !== 'nato') {
    add('body', 'Body has content', anyText(s.body), 'Write at least one paragraph.');
    add('subdiv', 'No lone subparagraph', !hasLoneChild(s.body),
      'If you subdivide a paragraph, use at least two subparagraphs — never a single (a) or (1).');
    add('sig', 'Signature name present', s.signature.name.trim().length > 0,
      'Add the signer’s last name (in caps) to the signature block.');
    const hasDate = s.dateMode === 'auto' || (s.dateMode === 'manual' && s.dateManual.trim().length > 0);
    add('date', 'Date set', hasDate, 'Set the date — automatic, or type it.');
  }

  // A typed (manual) date should look like the naval DD MMM YY form.
  if (t !== 'nato' && s.dateMode === 'manual' && s.dateManual.trim()) {
    add('date-fmt', 'Date is in DD MMM YY form',
      /^\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4}\s*$/.test(s.dateManual.trim()),
      'Naval dates use day, abbreviated month, year — e.g., 7 Sep 26.');
  }

  // References / enclosures cited in the body must actually exist in the lists.
  if (t !== 'nato') {
    const body = bodyText(s.body);
    const refMax = maxCited(body, /\bref(?:erence)?s?\s*\(\s*([a-z])\s*\)/gi, (m) => m.toLowerCase().charCodeAt(0) - 96);
    if (refMax > 0) {
      add('ref-cite', 'Cited references are all listed', refMax <= s.refs.length,
        `The body cites reference (${String.fromCharCode(96 + refMax)}) but only ${s.refs.length} ${s.refs.length === 1 ? 'reference is' : 'references are'} listed.`);
    }
    const enclMax = maxCited(body, /\bencl(?:osure)?s?\s*\(\s*(\d+)\s*\)/gi, (m) => parseInt(m, 10));
    if (enclMax > 0) {
      add('encl-cite', 'Cited enclosures are all listed', enclMax <= s.encls.length,
        `The body cites enclosure (${enclMax}) but only ${s.encls.length} ${s.encls.length === 1 ? 'enclosure is' : 'enclosures are'} listed.`);
    }
    // Endorsements (auto-created from a Via) need a forwarding statement.
    if (s.endorsements.length) {
      const emptyEndo = s.endorsements.filter((e) => !anyText(e.body)).length;
      add('endo-body', 'Each endorsement has content', emptyEndo === 0,
        `${emptyEndo} endorsement${emptyEndo === 1 ? '' : 's'} ${emptyEndo === 1 ? 'has' : 'have'} no body text yet.`);
    }
  }

  // CUI designation indicator block must be complete when CUI is on (DoDI 5200.48).
  if (s.cui.enabled) {
    add('cui-block', 'CUI designation block is complete',
      s.cui.controlledBy1.trim().length > 0 && s.cui.category.trim().length > 0 && s.cui.poc.trim().length > 0,
      'With CUI on, fill in “Controlled by,” “CUI Category,” and the POC of the designation block.');
  }

  // Enclosures listed must each have a title (¶19.b(7): enclosure markings correct).
  if (t !== 'nato' && s.encls.length) {
    add('encl-titles', 'Every listed enclosure has a title', s.encls.every((e) => e.text.trim().length > 0),
      'Give each enclosure a title, or remove the empty one.');
  }

  // Business letter specifics (Ch 11).
  if (t === 'business-letter') {
    add('inside', 'Inside address present', s.business.insideAddress.trim().length > 0, 'Add the recipient’s inside address.');
    add('greeting', 'Salutation or subject present',
      s.business.salutation.trim().length > 0 || s.business.subjectReplacesSalutation || s.subj.trim().length > 0,
      'Add a salutation (e.g. “Dear Mr. Jones:”) or a subject line in its place.');
  }

  return out;
}
