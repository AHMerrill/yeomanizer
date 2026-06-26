// Data model for a piece of Navy correspondence.
// Mirrors SECNAV M-5216.5; see /SPEC.md.

export type CorrespondenceType =
  | 'standard-letter'
  | 'memo-from-to'
  | 'business-letter'
  | 'endorsement';

export interface Letterhead {
  line1: string; // "DEPARTMENT OF THE NAVY" (fixed by default)
  activityName: string; // e.g. "CHIEF OF NAVAL OPERATIONS"
  addressLine: string; // e.g. "2000 NAVY PENTAGON"
  cityStateZip: string; // e.g. "WASHINGTON DC 20350-2000"
  seal: 'dod' | 'don' | 'none';
  replyRefPrinted: boolean; // "in reply refer to" printed on the letterhead?
  // on = render letterhead; off = plain paper (content to top margin);
  // preprinted = don't print it but RESERVE its space (for pre-printed letterhead stock).
  mode: 'on' | 'off' | 'preprinted';
}

export interface ListEntry {
  id: string;
  text: string;
}

export interface Paragraph {
  id: string;
  text: string;
  children: Paragraph[];
}

export type SignatureAuthority = 'none' | 'by-direction' | 'acting';

export interface SignatureBlock {
  name: string; // "J. K. JANICKI" — last name in caps
  title: string; // optional second line, e.g. "Deputy"
  authority: SignatureAuthority;
}

// CUI marking — sourced from DoDI 5200.48, the ISOO CUI Marking Handbook, and the
// DON "Marking Documents Containing PII" guidance. Banner is top+bottom of every page;
// the designation indicator block is first-page lower-right. See /SPEC.md.
export interface CuiMarking {
  enabled: boolean;
  banner: string; // top/bottom banner text — DON PII uses plain "CUI" (no modifiers)
  controlledBy1: string; // "Department of the Navy"
  controlledBy2: string; // originating office, e.g. "OJAG Code 13"
  category: string; // CUI category acronym, e.g. "PRVCY"
  dissemination: string; // distribution / limited-dissemination control, e.g. "FEDCON"
  poc: string; // name + email/phone (or originating office)
  portionMarkings: boolean; // optional (U)/(CUI) portion marks — DON discourages for PII
}

export interface LetterState {
  type: CorrespondenceType;
  letterhead: Letterhead;

  // Identification / sender's symbol
  ssic: string;
  originatorCode: string;
  serial: string;
  includeSsic: boolean; // optional line; off = removed entirely, on+blank = placeholder
  includeCode: boolean;
  dateMode: 'auto' | 'manual' | 'none';
  dateManual: string;

  // Heading block
  from: string;
  to: string;
  via: ListEntry[];
  subj: string;
  refs: ListEntry[];
  encls: ListEntry[];

  // Body
  body: Paragraph[];

  // Closing
  signature: SignatureBlock;
  copyTo: string[];

  // Controlled Unclassified Information markings
  cui: CuiMarking;
}
