// Data model for a piece of Navy correspondence.
// Mirrors SECNAV M-5216.5; see /SPEC.md.

export type CorrespondenceType =
  | 'standard-letter'
  | 'memo-from-to'
  | 'mfr'
  | 'business-letter'
  | 'endorsement'
  | 'moa'
  | 'joint-letter'
  | 'exec-memo'
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

// Memorandum of Agreement / Understanding (Ch 10, fig 10-5). Plain bond; a centered title
// ("MEMORANDUM OF AGREEMENT" / "…UNDERSTANDING"), then "BETWEEN" the two activities (senior first),
// numbered paragraphs like a standard letter, and DUAL signatures arranged so the senior official is
// at the RIGHT (10-2). `state.signature` is party A (senior, signs right); `signerB` is party B (left).
export interface Moa {
  kind: 'AGREEMENT' | 'UNDERSTANDING';
  partyA: string; // senior activity — listed first under BETWEEN, signs at the right
  partyB: string; // second activity — signs at the left
  signerB: SignatureBlock; // party B's signer (party A uses the shared state.signature)
  // Dual identification blocks (fig 10-5): each party keeps its own short title + SSIC + serial + date.
  // Party A's block sits left and reuses the shared identification (state.ssic/originatorCode/serial/
  // date) plus shortTitleA; party B's block sits right and is fully captured here.
  shortTitleA: string; // party A short title above its ident block (e.g., NAVAIRSYSCOM)
  shortTitleB: string; // party B short title (e.g., NAVINTCOM)
  ssicB: string; // party B SSIC
  serialB: string; // party B serial, rendered "Ser <serialB>"
  dateB: string; // party B date
}

// Joint letter / joint memorandum (Ch 7, fig 7-4): one letter co-signed by two or more commands.
// Each party keeps its OWN identification (short title + SSIC + serial + date) and its own signer.
// Parties are listed senior-first; the senior command sits at the TOP of the letterhead/From and signs
// at the RIGHT (10-2 / 7-4). `shared` letterhead line1 + city/state + the To/Subj/body are common.
export interface JointParty {
  command: string; // letterhead command title (may include the SNDL address code), senior first
  from: string; // the "From:" title, e.g. "Commander, Naval Sea Systems Command"
  shortTitle: string; // identification-column header, e.g. "NAVSEA"
  ssic: string;
  serial: string;
  date: string; // each command dates its own signature (free text, e.g. "16 Jan 15")
  signer: SignatureBlock;
}
export interface Joint {
  kind: 'LETTER' | 'MEMORANDUM';
  parties: JointParty[]; // senior first; rendered with the senior at the right (ident + signature)
}

// Executive memorandum (Ch 12, figs 12-9 / 12-11): the OSD/SecDef staff memo that carries a decision
// or information UP to a principal. "ACTION MEMO" asks the principal to approve/sign (with an
// Approve/Disapprove initialing block); "INFO MEMO" informs, no action. Distinct from a naval memo:
// a centered title, FOR:/FROM: addressing, a Title-Case SUBJECT, BULLETED paragraphs, and a
// COORDINATION line. Reuses the shared `to` (FOR:), `subj`, `refs`, `body`, `signature`, `letterhead`.
export interface ExecMemo {
  // ACTION / INFORMATION are the bulleted staff memos (figs 12-9/12-11). MEMORANDUM-FOR is the plain
  // executive memorandum (fig 12-14): "MEMORANDUM FOR <recipient>" addressing, indented (not bulleted)
  // paragraphs, a centered signature, and a cc: line — no control line / FROM / recommendation.
  kind: 'ACTION' | 'INFORMATION' | 'MEMORANDUM-FOR';
  controlLine: string; // top-right control symbol under the date, e.g. "UNSECNAV ______"
  from: string; // FROM: originator (full name, title)
  recommendation: string; // ACTION memo: the "RECOMMENDATION:" text (unused on an INFO memo)
  decisionLines: boolean; // ACTION memo: render "Approve _____  Disapprove _____" for the principal
  coordination: string; // COORDINATION: value, e.g. "TAB D" or "None"
  attachments: string; // Attachments: value (defaults to "As stated")
  preparedBy: string; // "Prepared by:" — name, organization, phone
  cc: string; // MEMORANDUM-FOR: the cc: line (fig 12-14)
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
  // dow = Department of War blue seal (default); dod = DoD letterhead blue. Both rendered in the
  // letterhead ink color (PMS 288) for authentic, on-spec letterhead.
  seal: 'dow' | 'dod' | 'none';
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
  // Optional per-enclosure CUI banner. When CUI is enabled and this enclosure is rendered IN the
  // document, its appended page(s) carry THIS banner (top/bottom) instead of the letter's — so a
  // package can assemble enclosures of differing CUI categories, each marked on its own pages.
  // Blank = inherit the letter's banner. The tool marks what the user specifies; it makes no
  // classification determination of its own.
  cuiBanner?: string;
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
  // Optional transmittal-document note (ISOO CUI Marking Handbook): when a cover letter transmits CUI
  // enclosures, it carries the most restrictive marking it transmits PLUS a statement of its own status
  // once separated — e.g. "This document, when separated from its enclosures, is UNCONTROLLED." Free
  // text; the user supplies the exact wording. Rendered in the first-page designation block when set.
  transmittalNote: string;
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
  // Multiple-address letter (Ch 8): additional action addressees stacked under the "To:" line.
  // Use when there are four or fewer addressees total. When `to` holds a group/collective title,
  // leave these empty and list the members in `distribution` instead.
  toAddrs: ListEntry[];
  via: ListEntry[];
  subj: string;
  refs: ListEntry[];
  encls: EnclosureEntry[];

  // Body
  body: Paragraph[];

  // Closing
  signature: SignatureBlock;
  // Multiple-address letter (Ch 8-2): the "Distribution:" block, printed after the signature and
  // above "Copy to:". Used when there are more than four action addressees, or to vary copy counts
  // (e.g. "COMSUBFOR NORFOLK (4 copies)"). Entries here are ACTION addressees, not info copies.
  distribution: ListEntry[];
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

  // Memorandum of Agreement/Understanding parts (used when type === 'moa')
  moa: Moa;

  // Joint letter / joint memorandum parts (used when type === 'joint-letter')
  joint: Joint;

  // Executive memorandum parts (Ch 12, used when type === 'exec-memo')
  execMemo: ExecMemo;
}
