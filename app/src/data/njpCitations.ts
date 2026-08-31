// Where the rules live — a signpost, never a verdict.
//
// This module carries CITATIONS ONLY: document names, section numbers, and section titles copied
// verbatim from the official sources. It states no rule, computes no limit, and evaluates nothing.
// That is deliberate. The NJP maximum-punishment scheme varies by the imposing authority's grade,
// by officer vs enlisted, by the vessel exception, and by promotion authority — and it carries
// COMBINATION rules about which punishments may be imposed together and how their limits interact.
// Applying those is a legal judgment. A tool that told a command "this package is within limits"
// would be influencing the process while looking authoritative, so this one points at the authority
// and stops. The reader is the legal officer, not this app.
//
// Sources, each verified against the official publisher:
//   * UCMJ art. 15 — 10 U.S.C. § 815, heading verbatim from uscode.house.gov (Office of the Law
//     Revision Counsel).
//   * Manual for Courts-Martial (2024 ed.), Part V — jsc.defense.gov, 803 pp. Cited at PART level
//     only: the part heading is confirmed, but Part V's paragraph list could not be decoded from
//     the PDF cleanly enough to reproduce, so it is not enumerated here. Better a correct coarse
//     citation than a fabricated precise one.
//   * JAGMAN, JAGINST 5800.7G CH-2, Part B — jag.navy.mil. Section numbers, titles, and subsection
//     letters extracted from the instruction's own table of contents, verbatim and complete.
//
// Revisions move. Each entry carries the edition it was read from so a stale citation is visible.

export interface CitationSub { l: string; t: string }
export interface Citation {
  /** Section number as cited, e.g. "0111". Empty for whole-document references. */
  n: string;
  /** Title, verbatim from the source. */
  t: string;
  /** Which part of the 1626/7 this sits beside. */
  k: 'authority' | 'initiation' | 'punishment' | 'appeal' | 'after';
  subs?: CitationSub[];
}

export const NJP_SOURCES = {
  ucmj: {
    label: 'UCMJ art. 15 — Commanding officer\'s non-judicial punishment',
    cite: '10 U.S.C. § 815',
    where: 'uscode.house.gov',
  },
  mcm: {
    label: 'Manual for Courts-Martial, Part V — Nonjudicial Punishment Procedure',
    cite: 'MCM (2024 ed.), Part V',
    where: 'jsc.defense.gov',
  },
  jagman: {
    label: 'Manual of the Judge Advocate General, Part B — Nonjudicial Punishment',
    cite: 'JAGINST 5800.7G CH-2, ch. I, pt. B',
    where: 'jag.navy.mil',
  },
} as const;

/** JAGMAN ch. I, Part B — every section, in order, titles verbatim. */
export const JAGMAN_PART_B: Citation[] = [
  {"n":"0106","t":"Authority to Impose","k":"authority","subs":[{"l":"a","t":"Commander"},{"l":"b","t":"Navy"},{"l":"c","t":"Marine Corps"},{"l":"d","t":"Officer in charge"},{"l":"e","t":"Principal assistant"},{"l":"f","t":"Joint commander"},{"l":"g","t":"Withholding of NJP authority"},{"l":"h","t":"Terminology"},{"l":"i","t":"Offenses subject to exclusive STC authority"},
]},
  {"n":"0107","t":"Jurisdiction Over Individuals","k":"authority","subs":[{"l":"a","t":"General"},{"l":"b","t":"Party before a fact-finding body"},{"l":"c","t":"Action when accused is no longer of the command"},{"l":"d","t":"Over Reserve Component personnel on active duty or inactive-duty training"},
]},
  {"n":"0108","t":"Limitations on Initiation of Article 15, UCMJ, Proceedings","k":"initiation","subs":[{"l":"a","t":"Right to refuse NJP"},{"l":"b","t":"Units attached to ships"},{"l":"c","t":"Training"},{"l":"d","t":"Use of self-reporting of arrest, conviction, or criminal charges by civilian authorities"},{"l":"e","t":"Cases previously tried in civilian courts"},{"l":"f","t":"Waiver of statute of limitations"},
]},
  {"n":"0109","t":"Advice to Accused for Article 15, UCMJ, Proceedings","k":"initiation","subs":[{"l":"a","t":"Advice and consultation before and after NJP"},{"l":"b","t":"Use of NJP records"},{"l":"c","t":"Consultation options"},{"l":"d","t":"Service record entries"},
]},
  {"n":"0110","t":"Procedures for Initiation of Article 15, UCMJ, Proceedings","k":"initiation","subs":[{"l":"a","t":"Article 15, UCMJ, guide"},{"l":"b","t":"Standard of proof"},{"l":"c","t":"Observers at NJP proceedings"},{"l":"d","t":"Alternatives to personal appearance"},{"l":"e","t":"NJP based on report of a fact-finding body"},{"l":"f","t":"Advice after imposition of NJP"},
]},
  {"n":"0111","t":"Limitations on and Nature of Punishments","k":"punishment","subs":[{"l":"a","t":"Restriction imposed upon officers and warrant officers"},{"l":"b","t":"Correctional custody"},{"l":"c","t":"Confinement"},{"l":"d","t":"Extra duties"},{"l":"e","t":"Reduction in grade"},{"l":"f","t":"Arrest in quarters"},{"l":"g","t":"No punishment"},{"l":"h","t":"Suspended punishment"},{"l":"i","t":"Punishment involving forfeiture of pay"},
]},
  {"n":"0112","t":"Limitations on Nonjudicial Punishments to be Imposed on Reserve Component Personnel Not on Active Duty","k":"punishment","subs":[{"l":"a","t":"Punishment involving restraint on liberty"},{"l":"b","t":"Punishment involving forfeiture of pay"},
]},
  {"n":"0113","t":"Effective Date and Execution of Nonjudicial Punishments","k":"punishment","subs":[{"l":"a","t":"Forfeiture of pay and reduction in grade"},{"l":"b","t":"Punishments involving restraint and extra duties"},{"l":"c","t":"Punitive letters"},
]},
  {"n":"0114","t":"Punitive Censure","k":"punishment","subs":[{"l":"a","t":"General"},{"l":"b","t":"Official records of admonition or reprimand"},{"l":"c","t":"Internal departmental responsibility"},{"l":"d","t":"Content of letter of admonition or reprimand"},{"l":"e","t":"Appeals"},{"l":"f","t":"Forwarding letter"},{"l":"g","t":"Removal and set aside"},{"l":"a","t":"General"},{"l":"b","t":"Rebuttal"},
]},
  {"n":"0115","t":"Announcement of Nonjudicial Punishment","k":"after","subs":[{"l":"a","t":"Publication"},{"l":"b","t":"Public censures"},{"l":"c","t":"Release to the public"},{"l":"d","t":"Release of results to victims"},
]},
  {"n":"0116","t":"Command Action on Nonjudicial Punishment Appeals","k":"appeal","subs":[{"l":"a","t":"Time limit"},{"l":"b","t":"Procedures"},{"l":"c","t":"Contents of forwarding endorsement"},
]},
  {"n":"0117","t":"Authority to Act on Nonjudicial Punishment Appeals","k":"appeal","subs":[{"l":"a","t":"When the officer who imposed punishment is in a Navy chain of command"},{"l":"b","t":"When the officer who imposed punishment is in a Marine Corps chain of command"},{"l":"c","t":"When punishment is imposed within a joint force"},{"l":"d","t":"Limits on authority to act on appeal"},{"l":"e","t":"Proceedings after appeal"},
]},
  {"n":"0118","t":"Suspension, Mitigation, Remission, Setting Aside, and Vacation of Suspension","k":"after","subs":[{"l":"a","t":"Definition of \"successor in command\""},{"l":"b","t":"Authority to suspend, mitigate, remit, set aside"},{"l":"c","t":"Interruption of period of suspension"},{"l":"d","t":"Vacation of suspension"},
]},
  {"n":"0119","t":"Records of Nonjudicial Punishment","k":"after","subs":[{"l":"a","t":"Records"},{"l":"b","t":"Report of officer misconduct"},{"l":"c","t":"Report of enlisted misconduct"},
]},
];

export function citationsFor(kind: Citation['k']): Citation[] {
  return JAGMAN_PART_B.filter((c) => c.k === kind);
}
