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
