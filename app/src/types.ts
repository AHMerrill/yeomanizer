// Data model for a piece of Navy correspondence.
// Mirrors SECNAV M-5216.5; see /SPEC.md.

export type CorrespondenceType =
  | 'standard-letter'
  | 'memo-from-to'
  | 'business-letter'
  | 'endorsement'
  | 'nato';

// NATO travel order (a bilingual form, not a naval letter). DoD/FCG template.
export interface NatoOrder {
  orderNumber: string;
  rankGrade: string; // US grade, e.g. 'O-4'; NATO code derived from NAVY_RANKS
  name: string;
  dodId: string;
  from: string;
  to: string;
  via: string;
  departureDate: string;
  returnDate: string;
  armsGranted: boolean; // para 3: "is" vs "is not" granted to carry arms
  dispatchQty: string; // para 4: "no/none" or a count
  dispatchNumbers: string; // para 4: "N/A" or the dispatch numbers
  includeSofa: boolean; // para 5: NATO SOFA certification (deletable)
  authorizingOfficer: string;
  dateOfIssue: string;
}

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

// An endorsement appended to a basic letter/memo (Ch 9). Rendered as extra page(s) after it.
export interface EndorsementEntry {
  id: string;
  viaId?: string; // if set, this endorsement is auto-created for a Via addressee (From = the via)
  endorser: string; // the "From:" of the endorsement (the endorsing command)
  serial: string; // the endorser's serial (optional)
  body: Paragraph[];
  sigName: string;
  sigTitle: string;
  authority?: SignatureAuthority; // endorsements are often signed "By direction" / "Acting"
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

  // Standalone endorsement type fields ("FIRST ENDORSEMENT on <basic letter>")
  endorsementNumber: string;
  endorsementOf: string;
  // Endorsements APPENDED to a letter/memo (each becomes extra page(s) after the basic doc)
  endorsements: EndorsementEntry[];

  // Controlled Unclassified Information markings
  cui: CuiMarking;

  // NATO travel order (used when type === 'nato')
  nato: NatoOrder;
}
