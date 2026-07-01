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
  moa: {
    kind: 'AGREEMENT',
    partyA: '',
    partyB: '',
    signerB: { name: '', title: '', authority: 'none' },
    shortTitleA: '',
    shortTitleB: '',
    ssicB: '',
    serialB: '',
    dateB: '',
  },
  joint: {
    kind: 'LETTER',
    parties: [],
  },
  execMemo: {
    kind: 'ACTION',
    controlLine: '',
    from: '',
    recommendation: '',
    decisionLines: true,
    coordination: '',
    attachments: 'As stated',
    preparedBy: '',
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
  if (type === 'memo-from-to') {
    // 10-2: "the only identification symbol you need is the date, unless local practice calls for more."
    // Default to date-only; the SSIC/code toggles stay available for commands whose practice adds them.
    return { ...base, includeSsic: false, includeCode: false };
  }
  if (type === 'joint-letter') {
    // Joint letter (Ch 7, fig 7-4): co-signed by multiple commands, each keeping its own identification
    // symbols; the senior command is listed first and signs at the right.
    return {
      ...base,
      letterhead: { ...base.letterhead, line1: 'DEPARTMENT OF THE NAVY', activityName: '', addressLine: '', cityStateZip: 'WASHINGTON DC' },
      includeSsic: false, // each party carries its own SSIC in the joint identification columns
      includeCode: false,
      from: '',
      to: 'Chief of Naval Operations',
      via: [],
      subj: 'HOW TO PREPARE A JOINT LETTER',
      refs: [],
      encls: [],
      joint: {
        kind: 'LETTER',
        parties: [
          {
            command: 'NAVAL SEA SYSTEMS COMMAND (20362-5101)',
            from: 'Commander, Naval Sea Systems Command',
            shortTitle: 'NAVSEA',
            ssic: '5216',
            serial: 'Ser 07/207',
            date: '16 Jan 15',
            signer: { name: 'A. N. PIDGEON', title: 'Deputy', authority: 'none' },
          },
          {
            command: 'NAVAL SUPPLY SYSTEMS COMMAND (20376-5000)',
            from: 'Commander, Naval Supply Systems Command',
            shortTitle: 'NAVSUP',
            ssic: '5216',
            serial: 'Ser 02/318',
            date: '9 Jan 15',
            signer: { name: 'J. K. JANICKI', title: 'Acting', authority: 'none' },
          },
        ],
      },
      body: [
        {
          id: uid(),
          text: 'A joint letter may be used to establish an agreement between two or more activities, or for other matters of mutual concern. To prepare a joint memorandum, switch the kind above — “JOINT LETTER” becomes “JOINT MEMORANDUM.”',
          children: [],
        },
        {
          id: uid(),
          text: 'List the command titles so the senior is at the top. Each command keeps its own identification symbols, shown in the columns above.',
          children: [],
        },
        {
          id: uid(),
          text: 'Arrange the signature lines so the senior official is at the right; the senior official signs last.',
          children: [],
        },
      ],
    };
  }
  if (type === 'moa') {
    // MOA/MOU (fig 10-5): plain bond, dual identification blocks (party A left, party B right),
    // BETWEEN the two activities, dual signatures (the senior official signs at the right).
    return {
      ...base,
      letterhead: { ...base.letterhead, mode: 'off' },
      includeSsic: true,
      includeCode: true,
      ssic: '5216',
      originatorCode: 'N02',
      serial: '234',
      dateMode: 'manual',
      dateManual: '20 Jan 15',
      from: '',
      to: '',
      via: [],
      subj: 'MEMORANDUM OF AGREEMENT',
      refs: [],
      encls: [],
      moa: {
        kind: 'AGREEMENT',
        partyA: 'Commander, Naval Air Systems Command',
        partyB: 'Commander, Naval Intelligence Command',
        signerB: { name: '', title: 'Deputy', authority: 'none' },
        shortTitleA: 'NAVAIRSYSCOM',
        shortTitleB: 'NAVINTCOM',
        ssicB: '5216',
        serialB: 'N7/702',
        dateB: '23 Jan 15',
      },
      signature: { name: '', title: 'Acting', authority: 'none' },
      body: [
        {
          id: uid(),
          text: 'This Memorandum of Agreement establishes the responsibilities of the parties named above. Use a Memorandum of Understanding instead when the parties are recording a shared understanding rather than binding commitments.',
          children: [],
        },
        {
          id: uid(),
          text: 'On plain bond, list the activity titles so the senior is first. Center the title and the word BETWEEN; arrange the signature lines so the senior official signs at the right.',
          children: [],
        },
        {
          id: uid(),
          text: 'When your activity is the last to sign, send a copy of the signed agreement to every cosigner.',
          children: [],
        },
      ],
    };
  }
  if (type === 'exec-memo') {
    // Executive memorandum (Ch 12, fig 12-9 Action Memo): letterhead of the signing office, a centered
    // "ACTION MEMO" title, FOR:/FROM: addressing, a Title-Case SUBJECT, bulleted paragraphs, a
    // RECOMMENDATION with an Approve/Disapprove decision block, COORDINATION, and "Prepared by".
    return {
      ...base,
      includeSsic: false,
      includeCode: false,
      dateMode: 'none', // "Date (After signed)" — a principal's memo is dated when signed
      from: '',
      to: 'SECRETARY OF THE NAVY',
      via: [],
      subj: 'Action Memo Format',
      refs: [],
      encls: [],
      signature: { name: '', title: '', authority: 'none' },
      execMemo: {
        kind: 'ACTION',
        controlLine: 'UNSECNAV ______',
        from: 'Paul S. Rogers, General Counsel of the Navy',
        recommendation: 'That SECNAV sign the memorandum at TAB A.',
        decisionLines: true,
        coordination: 'TAB D',
        attachments: 'As stated',
        preparedBy: 'A. Officer, OGC, (703) 555-0100',
      },
      body: [
        {
          id: uid(),
          text: 'What should the Secretary do? This bullet explains what action is required — different from the entry for the recommendation (TAB A).',
          children: [],
        },
        {
          id: uid(),
          text: 'Due date for action. This bullet is used for incoming correspondence at TAB B.',
          children: [],
        },
        {
          id: uid(),
          text: 'Why it is necessary and acceptable for the Secretary to approve or sign the recommended action. This bullet identifies key points, contentious issues, and problem areas (TAB C).',
          children: [],
        },
      ],
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
    moa: { ...defaultState.moa, signerB: { ...defaultState.moa.signerB } },
    joint: { ...defaultState.joint, parties: [] },
    execMemo: { ...defaultState.execMemo },
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
