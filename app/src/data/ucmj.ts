// UCMJ punitive articles — Articles 77 through 134, all 94 of them including the lettered ones
// (87a, 120b, 128a, 131g, …).
//
// Source: the official U.S. Code, Title 10, Subtitle A, Part II, Chapter 47, Subchapter X
// (uscode.house.gov, Office of the Law Revision Counsel). Article number, U.S. Code section, and
// the section's own heading — nothing added, nothing paraphrased. This is a LOOKUP, not legal
// advice: it does not carry elements, definitions, or maximum punishments, and it never suggests
// what to charge. It exists so a yeoman can pick "Art. 86 — Absence without leave" from a list
// instead of typing it, the same way the SSIC lookup works.
//
// Regenerating: fetch the subchapter X page from uscode.house.gov and re-extract; the statute
// changes rarely, but a new NDAA can add or renumber an article.
export interface UcmjArticle {
  /** Article number as cited, e.g. "86" or "120b". */
  a: string;
  /** U.S. Code section in title 10, e.g. "886". */
  s: string;
  /** The section heading, verbatim. */
  t: string;
}

export const UCMJ_ARTICLES: UcmjArticle[] = [
  {"a":"77","s":"877","t":"Principals"},
  {"a":"78","s":"878","t":"Accessory after the fact"},
  {"a":"79","s":"879","t":"Conviction of offense charged, lesser included offenses, and attempts"},
  {"a":"80","s":"880","t":"Attempts"},
  {"a":"81","s":"881","t":"Conspiracy"},
  {"a":"82","s":"882","t":"Soliciting commission of offenses"},
  {"a":"83","s":"883","t":"Malingering"},
  {"a":"84","s":"884","t":"Breach of medical quarantine"},
  {"a":"85","s":"885","t":"Desertion"},
  {"a":"86","s":"886","t":"Absence without leave"},
  {"a":"87","s":"887","t":"Missing movement; jumping from vessel"},
  {"a":"87a","s":"887a","t":"Resistance, flight, breach of arrest, and escape"},
  {"a":"87b","s":"887b","t":"Offenses against correctional custody and restriction"},
  {"a":"88","s":"888","t":"Contempt toward officials"},
  {"a":"89","s":"889","t":"Disrespect toward superior commissioned officer; assault of superior commissioned officer"},
  {"a":"90","s":"890","t":"Willfully disobeying superior commissioned officer"},
  {"a":"91","s":"891","t":"Insubordinate conduct toward warrant officer, noncommissioned officer, or petty officer"},
  {"a":"92","s":"892","t":"Failure to obey order or regulation"},
  {"a":"93","s":"893","t":"Cruelty and maltreatment"},
  {"a":"93a","s":"893a","t":"Prohibited activities with military recruit or trainee by person in position of special trust"},
  {"a":"94","s":"894","t":"Mutiny or sedition"},
  {"a":"95","s":"895","t":"Offenses by sentinel or lookout"},
  {"a":"95a","s":"895a","t":"Disrespect toward sentinel or lookout"},
  {"a":"96","s":"896","t":"Release of prisoner without authority; drinking with prisoner"},
  {"a":"97","s":"897","t":"Unlawful detention"},
  {"a":"98","s":"898","t":"Misconduct as prisoner"},
  {"a":"99","s":"899","t":"Misbehavior before the enemy"},
  {"a":"100","s":"900","t":"Subordinate compelling surrender"},
  {"a":"101","s":"901","t":"Improper use of countersign"},
  {"a":"102","s":"902","t":"Forcing a safeguard"},
  {"a":"103","s":"903","t":"Spies"},
  {"a":"103a","s":"903a","t":"Espionage"},
  {"a":"103b","s":"903b","t":"Aiding the enemy"},
  {"a":"104","s":"904","t":"Public records offenses"},
  {"a":"104a","s":"904a","t":"Fraudulent enlistment, appointment, or separation"},
  {"a":"104b","s":"904b","t":"Unlawful enlistment, appointment, or separation"},
  {"a":"105","s":"905","t":"Forgery"},
  {"a":"105a","s":"905a","t":"False or unauthorized pass offenses"},
  {"a":"106","s":"906","t":"Impersonation of officer, noncommissioned or petty officer, or agent or official"},
  {"a":"106a","s":"906a","t":"Wearing unauthorized insignia, decoration, badge, ribbon, device, or lapel button"},
  {"a":"107","s":"907","t":"False official statements; false swearing"},
  {"a":"107a","s":"907a","t":"Parole violation"},
  {"a":"108","s":"908","t":"Military property of United States \u2014 Loss, damage, destruction, or wrongful disposition"},
  {"a":"108a","s":"908a","t":"Captured or abandoned property"},
  {"a":"109","s":"909","t":"Property other than military property of United States \u2014 Waste, spoilage, or destruction"},
  {"a":"109a","s":"909a","t":"Mail matter: wrongful taking, opening, etc"},
  {"a":"110","s":"910","t":"Improper hazarding of vessel or aircraft"},
  {"a":"111","s":"911","t":"Leaving scene of vehicle accident"},
  {"a":"112","s":"912","t":"Drunkenness and other incapacitation offenses"},
  {"a":"112a","s":"912a","t":"Wrongful use, possession, etc., of controlled substances"},
  {"a":"113","s":"913","t":"Drunken or reckless operation of a vehicle, aircraft, or vessel"},
  {"a":"114","s":"914","t":"Endangerment offenses"},
  {"a":"115","s":"915","t":"Communicating threats"},
  {"a":"116","s":"916","t":"Riot or breach of peace"},
  {"a":"117","s":"917","t":"Provoking speeches or gestures"},
  {"a":"117a","s":"917a","t":"Wrongful broadcast or distribution of intimate visual images"},
  {"a":"118","s":"918","t":"Murder"},
  {"a":"119","s":"919","t":"Manslaughter"},
  {"a":"119a","s":"919a","t":"Death or injury of an unborn child"},
  {"a":"119b","s":"919b","t":"Child endangerment"},
  {"a":"120","s":"920","t":"Rape and sexual assault generally"},
  {"a":"120a","s":"920a","t":"Mails: deposit of obscene matter"},
  {"a":"120b","s":"920b","t":"Rape and sexual assault of a child"},
  {"a":"120c","s":"920c","t":"Other sexual misconduct"},
  {"a":"121","s":"921","t":"Larceny and wrongful appropriation"},
  {"a":"121a","s":"921a","t":"Fraudulent use of credit cards, debit cards, and other access devices"},
  {"a":"121b","s":"921b","t":"False pretenses to obtain services"},
  {"a":"122","s":"922","t":"Robbery"},
  {"a":"122a","s":"922a","t":"Receiving stolen property"},
  {"a":"123","s":"923","t":"Offenses concerning Government computers"},
  {"a":"123a","s":"923a","t":"Making, drawing, or uttering check, draft, or order without sufficient funds"},
  {"a":"124","s":"924","t":"Frauds against the United States"},
  {"a":"124a","s":"924a","t":"Bribery"},
  {"a":"124b","s":"924b","t":"Graft"},
  {"a":"125","s":"925","t":"Kidnapping"},
  {"a":"126","s":"926","t":"Arson; burning property with intent to defraud"},
  {"a":"127","s":"927","t":"Extortion"},
  {"a":"128","s":"928","t":"Assault"},
  {"a":"128a","s":"928a","t":"Maiming"},
  {"a":"128b","s":"928b","t":"Domestic violence"},
  {"a":"129","s":"929","t":"Burglary; unlawful entry"},
  {"a":"129a","s":"929a","t":"Omitted]"},
  {"a":"130","s":"930","t":"Stalking"},
  {"a":"131","s":"931","t":"Perjury"},
  {"a":"131a","s":"931a","t":"Subornation of perjury"},
  {"a":"131b","s":"931b","t":"Obstructing justice"},
  {"a":"131c","s":"931c","t":"Misprision of serious offense"},
  {"a":"131d","s":"931d","t":"Wrongful refusal to testify"},
  {"a":"131e","s":"931e","t":"Prevention of authorized seizure of property"},
  {"a":"131f","s":"931f","t":"Noncompliance with procedural rules"},
  {"a":"131g","s":"931g","t":"Wrongful interference with adverse administrative proceeding"},
  {"a":"132","s":"932","t":"Retaliation"},
  {"a":"133","s":"933","t":"Conduct unbecoming an officer"},
  {"a":"134","s":"934","t":"General article"},
];

// Free-text search over article number and heading. "86", "awol", "absence", "unauthorized" all
// find Article 86. Returns at most `limit` matches, best (prefix on the number) first.
export function searchArticles(q: string, limit = 12): UcmjArticle[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const scored: { a: UcmjArticle; rank: number }[] = [];
  for (const a of UCMJ_ARTICLES) {
    const num = a.a.toLowerCase();
    const title = a.t.toLowerCase();
    let rank = -1;
    if (num === s) rank = 0;
    else if (num.startsWith(s)) rank = 1;
    else if (title.startsWith(s)) rank = 2;
    else if (title.includes(s)) rank = 3;
    else if (SYNONYMS[s]?.includes(a.a)) rank = 2;
    if (rank >= 0) scored.push({ a, rank });
  }
  scored.sort((x, y) => x.rank - y.rank || x.a.a.localeCompare(y.a.a, undefined, { numeric: true }));
  return scored.slice(0, limit).map((x) => x.a);
}

// The handful of terms people actually type that don't appear in the statute's own headings.
// Deliberately tiny and literal — it maps a common word to an article, never to an interpretation.
const SYNONYMS: Record<string, string[]> = {
  awol: ['86'],
  ua: ['86'],
  unauth: ['86'],
  drugs: ['112a'],
  wrongful: ['112a'],
  dui: ['113'],
  disrespect: ['89', '91'],
  orders: ['90', '91', '92'],
  fraternization: ['134'],
};
