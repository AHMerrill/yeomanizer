// Data model for a piece of Navy correspondence.
// Mirrors SECNAV M-5216.5; see /SPEC.md.

export type CorrespondenceType =
  | 'standard-letter'
  | 'memo-from-to'
  | 'mfr'
  | 'business-letter'
  | 'endorsement'
  | 'nato';

// Business letter (Ch 11) — used to correspond with agencies/businesses/individuals outside DoD.
// Distinct shape vs the standard letter: an inside address + salutation instead of From/To/Via, a
// civilian date, unnumbered main paragraphs, and a centered "Sincerely," + signature block. These
// fields hold the parts unique to it; SSIC/serial/subj/body/encls/copyTo/signature are shared.
export interface BusinessLetter {
  insideAddress: string; // multi-line recipient address (blocked flush left), 2–8 lines below date
  attention: string; // optional "Attention:" line (11-2.3) — directs a letter to a person/department
  salutation: string; // "Dear Mr. Jones:" (ends with a colon). May be omitted if the subject replaces it
  subjectReplacesSalutation: boolean; // 11-2.5: an all-caps subject line may stand in for the salutation
  complimentaryClose: string; // "Sincerely," (11-2.8) — editable but defaults to the prescribed close
  separateMailing: string; // optional "Separate Mailing:" note (11-2.11) for separately-mailed enclosures
}

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
  activityName: string; // one or more lines (newline-separated): "COMMANDER\nNAVAL SURFACE FORCE"
  addressLine: string; // e.g. "2000 NAVY PENTAGON"
  cityStateZip: string; // e.g. "WASHINGTON DC 20350-2000"
  // dow = Department of War blue seal (current default); dod = legacy DoD letterhead blue; dod-color =
  // full-color DoD vector; don = Navy seal. Official seals — used unmodified for authentic letterhead.
  seal: 'dow' | 'dod' | 'dod-color' | 'don' | 'none';
  replyRefPrinted: boolean; // "in reply refer to" printed on the letterhead?
  // on = render letterhead; off = plain paper (content to top margin);
  // preprinted = don't print it but RESERVE its space (for pre-printed letterhead stock).
  mode: 'on' | 'off' | 'preprinted';
  // How many lines the pre-printed letterhead occupies (line 1 "Department of the Navy" through the
  // last address line) — used in 'preprinted' mode to reserve that much top space so the ident /
  // body start cleanly below it. A tall multi-line command name needs more.
  preprintedLines: number;
}

export interface ListEntry {
  id: string;
  text: string;
}

// An attached file held in memory only (data URL) — never persisted, gone when the tab closes.
export interface AttachedFile {
  name: string;
  type: string; // MIME type (image/* or application/pdf)
  dataUrl: string;
}

// An enclosure: its title (shown in the "Encl:" line) plus, optionally, an attached file that is
// either rendered INTO the document (appended pages) or kept separate (bundled at export time).
export interface EnclosureEntry {
  id: string;
  text: string; // the enclosure title
  inDocument?: boolean; // true = render the file into the document; false = attach separately
  file?: AttachedFile;
}

export interface Paragraph {
  id: string;
  text: string;
  children: Paragraph[];
  cui?: boolean; // per-paragraph CUI portion marking — (CUI) when true, (U) when marking is active
  title?: string; // optional underlined lead-in: "N.  <u>Title</u>.  body…" (per OPNAVINST 5400.45A)
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
  encls: EnclosureEntry[];

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

  // Business letter parts (used when type === 'business-letter')
  business: BusinessLetter;
}
