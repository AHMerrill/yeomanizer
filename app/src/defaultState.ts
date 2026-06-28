import type { CorrespondenceType, LetterState } from './types';

let _id = 0;
export const uid = (): string => `n${++_id}_${Math.round(performance.now() * 1000) % 100000}`;

export const defaultState: LetterState = {
  type: 'standard-letter',
  letterhead: {
    line1: 'DEPARTMENT OF THE NAVY',
    activityName: '',
    addressLine: '',
    cityStateZip: '',
    seal: 'dow', // Department of War blue seal — the current default
    replyRefPrinted: false,
    mode: 'on',
    preprintedLines: 4, // DEPT OF THE NAVY + activity + street + city/state/zip — bump for a taller letterhead
  },
  ssic: '',
  originatorCode: '',
  serial: '',
  includeSsic: true,
  includeCode: true,
  dateMode: 'auto',
  dateManual: '',
  from: '',
  to: '',
  toAddrs: [],
  via: [],
  subj: '',
  refs: [{ id: uid(), text: 'SECNAV M-5216.5 of June 2015' }],
  encls: [{ id: uid(), text: 'Sample Enclosure Title' }],
  body: [
    {
      id: uid(),
      text: 'This letter was produced by the yeomanizer, which renders correspondence to the standard letter format prescribed by reference (a). Whatever you type on the left appears, correctly formatted, on the right.',
      children: [],
    },
    {
      id: uid(),
      text: 'The format engine handles the mechanical details automatically.',
      children: [
        {
          id: uid(),
          text: 'Paragraph numbering, indentation, and the heading block follow the manual exactly.',
          children: [],
        },
        {
          id: uid(),
          text: 'Continuation lines return to the left margin, as required by paragraph 7-2.13.',
          children: [],
        },
      ],
    },
    {
      id: uid(),
      text: 'Point of contact is the originating office.',
      children: [],
    },
  ],
  signature: { name: '', title: '', authority: 'none' },
  distribution: [],
  copyTo: [],
  endorsementNumber: 'FIRST',
  endorsementOf: '',
  endorsements: [],
  cui: {
    enabled: false,
    banner: 'CUI',
    controlledBy1: 'Department of the Navy',
    controlledBy2: '',
    category: 'PRVCY',
    dissemination: 'FEDCON',
    poc: '',
    portionMarkings: false,
    transmittalNote: '',
  },
  nato: {
    orderNumber: '',
    rankGrade: 'O-3',
    name: '',
    dodId: '',
    from: '',
    to: '',
    via: '',
    departureDate: '',
    returnDate: '',
    armsGranted: false,
    dispatchQty: 'no/none',
    dispatchNumbers: 'N/A',
    includeSofa: true,
    authorizingOfficer: '',
    dateOfIssue: '',
  },
  business: {
    insideAddress: '',
    attention: '',
    salutation: '',
    subjectReplacesSalutation: false,
    complimentaryClose: 'Sincerely,',
    separateMailing: '',
  },
};

// Per-type starting draft. Most types share `defaultState`; some need faithful defaults that match
// their manual figure. NB: these are DEFAULTS, not limits — every field stays toggleable (e.g. the
// MFR's identification block and letterhead are off by default per Figure 10-1, but a command whose
// local practice uses a file number can switch them on; "not required" ≠ removed).
export function defaultFor(type: CorrespondenceType): LetterState {
  const base: LetterState = { ...defaultState, type };
  if (type === 'mfr') {
    return {
      ...base,
      letterhead: { ...base.letterhead, mode: 'off' }, // MFR is plain bond (fig 10-1)
      includeSsic: false, // identification symbols are optional on an MFR — date only by default
      includeCode: false,
      refs: [],
      encls: [],
      subj: '',
      body: [
        {
          id: uid(),
          text: 'Use a Memorandum for the Record to capture information that is not recorded elsewhere — the results of a meeting, an important telephone conversation, or an oral agreement.',
          children: [],
        },
        {
          id: uid(),
          text: 'An MFR is the most informal memorandum; it may be typed or handwritten. If it is only two or three lines, it can be added directly to the file copy of the document it supports.',
          children: [],
        },
        {
          id: uid(),
          text: 'A full signature line and identification symbols are not required, but the memorandum should be dated, signed, and show the signer’s organizational code.',
          children: [],
        },
      ],
    };
  }
  if (type === 'business-letter') {
    return {
      ...base,
      letterhead: { ...base.letterhead, mode: 'on' }, // 11-2.13: every copy needs a letterhead (no From: line)
      includeSsic: true,
      includeCode: true,
      ssic: '5216',
      originatorCode: '00',
      serial: '',
      from: '',
      to: '',
      via: [],
      subj: 'PREPARATION OF A BUSINESS LETTER',
      refs: [],
      encls: [],
      business: {
        insideAddress:
          'Mr. A. B. Recipient\nVice President, Operations\nExample Company, Inc.\n1234 Any Street\nAnytown, ST 12345-6789',
        attention: '',
        salutation: 'Dear Mr. Recipient:',
        subjectReplacesSalutation: false,
        complimentaryClose: 'Sincerely,',
        separateMailing: '',
      },
      body: [
        {
          id: uid(),
          text: 'Use the business letter to correspond with agencies, businesses, or individuals outside the Department of Defense who are unfamiliar with the standard naval letter.',
          children: [],
        },
        {
          id: uid(),
          text: 'Unlike the standard letter, the business letter uses an inside address and a salutation, a civilian-style date, and a centered “Sincerely,” over the signature. Main paragraphs are not numbered; subparagraphs are lettered and numbered just as in a standard letter.',
          children: [],
        },
        {
          id: uid(),
          text: 'Refer to previous communications and enclosures in the body of the letter only, without calling them references or enclosures.',
          children: [],
        },
      ],
      signature: { name: '', title: 'Executive Officer', authority: 'by-direction' },
      copyTo: [],
    };
  }
  return base;
}

// A blank canvas for a type — keeps its STRUCTURAL defaults (letterhead mode, includeSsic/Code,
// dateMode, seal) but empties every CONTENT field back to placeholders. Backs the "Reset all" card.
export function blankFor(type: CorrespondenceType): LetterState {
  const base = defaultFor(type);
  return {
    ...base,
    ssic: '',
    originatorCode: '',
    serial: '',
    letterhead: { ...base.letterhead, activityName: '', addressLine: '', cityStateZip: '' },
    from: '',
    to: '',
    toAddrs: [],
    via: [],
    subj: '',
    refs: [],
    encls: [],
    body: [{ id: uid(), text: '', children: [] }],
    signature: { name: '', title: '', authority: 'none' },
    distribution: [],
    copyTo: [],
    endorsementOf: '',
    endorsements: [],
    cui: { ...defaultState.cui },
    business: { ...defaultState.business },
    nato: { ...defaultState.nato },
  };
}

// Keep one auto-endorsement per non-empty Via addressee (From = the via), preserving any
// body/signature already entered, plus any manually-added (non-via) endorsements. This is why
// adding a Via makes its endorsement page appear automatically. Only letters/memos get them.
export function syncViaEndorsements(s: LetterState): LetterState {
  if (s.type !== 'standard-letter' && s.type !== 'memo-from-to') return s;
  const vias = s.via.filter((v) => v.text.trim());
  const byVia = new Map(s.endorsements.filter((e) => e.viaId).map((e) => [e.viaId, e]));
  const manual = s.endorsements.filter((e) => !e.viaId);
  const viaEndos = vias.map((v) => {
    const e = byVia.get(v.id);
    return e
      ? { ...e, endorser: v.text }
      : {
          id: uid(),
          viaId: v.id,
          endorser: v.text,
          serial: '',
          body: [{ id: uid(), text: '', children: [] }],
          sigName: '',
          sigTitle: '',
          authority: 'none' as const,
        };
  });
  return { ...s, endorsements: [...viaEndos, ...manual] };
}
