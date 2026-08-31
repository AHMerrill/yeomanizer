// Editor for NAVPERS 1626/7. The field list is DERIVED from the form geometry (data/form1626.ts)
// rather than retyped, so the editor can never offer a field the sheet doesn't have — or miss one
// it does. Labels come from the form itself.
//
// The tool records what the user enters and makes no determination: it does not suggest a
// disposition, recommend a punishment, or evaluate guilt. The only advisory check is
// format/njpLimits.ts, which restates eligibility limits printed on the form.
import type { LetterState, Njp, NjpPlea } from '../types';
import { FORM_1626_PAGES } from '../data/form1626';
import { njpLimitWarnings } from '../format/njpLimits';
import { searchArticles, UCMJ_ARTICLES } from '../data/ucmj';
import { NJP_SOURCES, citationsFor, type Citation } from '../data/njpCitations';
import { useState } from 'react';

const uid = () => Math.random().toString(36).slice(2, 9);

// "Where the rules live" — citations only. It names the authority and stops; it states no rule and
// checks nothing. See data/njpCitations.ts for why it deliberately goes no further.
function Citations({ kind }: { kind: Citation['k'] }) {
  const [open, setOpen] = useState(false);
  const list = citationsFor(kind);
  if (!list.length) return null;
  return (
    <div className="njp-cite">
      <button type="button" className="njp-cite-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '▾' : '▸'} Where the rules live
      </button>
      {open && (
        <div className="njp-cite-body">
          <p className="hint">
            Section numbers and titles only, copied from the sources below. This tool doesn&rsquo;t
            state the rule or check anything against it — read the authority.
          </p>
          <ul>
            {list.map((c) => (
              <li key={c.n}>
                <strong>JAGMAN {c.n}</strong> — {c.t}
                {c.subs && c.subs.length > 0 && (
                  <span className="njp-cite-subs">
                    {c.subs.map((x) => ` ${x.l}. ${x.t}`).join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="njp-cite-src">
            {NJP_SOURCES.ucmj.cite} · {NJP_SOURCES.mcm.cite} · {NJP_SOURCES.jagman.cite}
          </p>
        </div>
      )}
    </div>
  );
}

// Article picker for the pleas table. Typing "86", "awol", or "absence" finds Article 86; picking
// fills the number. The list is the statute's own headings (data/ucmj.ts) — it looks an article up,
// it does not suggest what to charge.
function ArticlePicker({ value, onPick, label }: { value: string; onPick: (a: string) => void; label: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const matches = searchArticles(q || value, 10);
  const known = UCMJ_ARTICLES.find((a) => a.a === value.trim());
  return (
    <div className="art-pick">
      <input
        type="text"
        placeholder="Article #"
        aria-label={label}
        value={value}
        title={known ? `Art. ${known.a} — ${known.t}` : undefined}
        onChange={(e) => {
          onPick(e.target.value);
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="art-results">
          {matches.map((a) => (
            <li key={a.a}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(a.a);
                  setQ('');
                  setOpen(false);
                }}
              >
                <strong>Art. {a.a}</strong> <span>{a.t}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Human labels for the generated slot ids, read off the form's own printed labels.
const SLOT_LABELS: Record<string, string> = {
  dateOfReport: 'Date of Report',
  nameOfAccused: 'Name of Accused',
  dodIdNumber: 'DoD ID Number',
  rateGrade: 'Rate/Grade',
  branch: 'Branch',
  divDept: 'Div/Dept',
  placeOfOffense: 'Place of Offense(s)',
  currentEnlistmentDate: 'Current Enlistment Date',
  currentEnlistmentExpiration: 'Current Enlistment Expiration',
  totalActiveService: 'Total Active Service',
  education: 'Education',
  afqt: 'AFQT',
  age: 'Age',
  maritalStatus: 'Marital Status',
  numberOfDependents: 'Number of Dependents',
  currentPaygrade: 'Current Paygrade',
  currentPayAmount: 'Current Pay Amount',
  currentPay12Month: 'Current Pay 1/2 Month',
  reducedPaygrade: 'Reduced Paygrade',
  reducedPayAmount: 'Reduced Pay Amount',
  reducedPay12Month: 'Reduced Pay 1/2 Month',
  dateOfMast: 'Date of Mast',
  dateAccusedInformedOfAboveActi: 'Date Accused Informed of Above Action',
  accused: 'Date Appeal Submitted by Accused',
  decision: 'Date Appeal Forwarded for Decision',
  appeal: 'Final Result of Appeal',
  filedAsOf: 'No Appeal Filed as of',
  // The restraint line and the CO's punishment blanks — each sits on the underline the form prints.
  restrictedLimitsLine: 'Restricted to the limits of',
  xoActionDate: 'Date of XO action',
  pRestrictionPlace: 'Restriction to (place)',
  pRestrictionDays: 'Restriction — days',
  pRestrictionSuspendPlace: 'Restriction w/ suspension from duty (place)',
  pRestrictionSuspendDays: 'Restriction w/ suspension — days',
  pCorrectionalCustodyDays: 'Correctional custody — day(s)',
  pConfinementDays: 'Confinement — days',
  pExtraDutiesDays: 'Extra duties — days',
  pReductionPaygrade: 'Reduction to pay grade of',
  pForfeitureAmount: 'Forfeiture — $ per month',
  pForfeitureMonths: 'Forfeiture — month(s)',
  pSuspendedAWhat: 'Punishment suspended (first)',
  pSuspendedADays: 'Suspended (first) — days',
  pSuspendedBWhat: 'Punishment suspended (second)',
  pSuspendedBDays: 'Suspended (second) — days',
  appealAckDate1: 'Appeal rights acknowledged — date',
  appealAckDate2: 'Appeal rights acknowledged — date (2)',
  entriesMadeDate: 'Service record entries made — date',
  upbRecordedDate: 'Recorded in the UPB — date',
};

const CHECK_LABELS: Record<string, string> = {
  preTrialConfinement: 'Pre-Trial Confinement',
  restricted: 'Restricted',
  noRestriction: 'No Restriction',
  xoDismissed: 'Dismissed',
  xoReferredToMast: "Referred to Captain's Mast",
  demandTrial: 'Demands trial by court-martial',
  doNotDemandTrial: 'Does NOT demand trial by court-martial',
  dismissedNoPunishment: 'Dismissed with no punishment (not NJP)',
  dismissedWithWarning: 'Dismissed with warning (not NJP)',
  pRestriction: 'Restriction',
  pRestrictionSuspendDuty: 'Restriction with suspension from duty (officers only)',
  pAdmonitionOral: 'Admonition: Oral (enlisted only)',
  pAdmonitionWriting: 'Admonition: In Writing',
  pReprimandOral: 'Reprimand: Oral (enlisted only)',
  pReprimandWriting: 'Reprimand: In Writing',
  pCorrectionalCustody: 'Correctional Custody',
  pConfinement: 'Confinement (Embarked E-3 and below only)',
  pExtraDuties: 'Extra duties',
  pReduction: 'Reduction to pay grade (E-6 and below only)',
  pForfeiture: 'Forfeiture of pay',
  pProcessCourtMartial: 'Process for Court Martial',
  pSuspendedA: 'Punishment suspended (first)',
  pSuspendedB: 'Punishment suspended (second)',
};

const RADIO_GROUPS: string[][] = [
  ['preTrialConfinement', 'restricted', 'noRestriction'],
  ['xoDismissed', 'xoReferredToMast'],
  ['demandTrial', 'doNotDemandTrial'],
];

const SECTIONS: { title: string; hint?: string; slots?: string[]; checks?: string[]; cite?: Citation['k'] }[] = [
  {
    title: 'Accused & report',
    slots: ['dateOfReport', 'nameOfAccused', 'dodIdNumber', 'rateGrade', 'branch', 'divDept', 'placeOfOffense'],
  },
  { title: 'Restraint', hint: 'Choose one, then name the limits if restricted.', checks: RADIO_GROUPS[0], slots: ['restrictedLimitsLine'], cite: 'initiation' },
  {
    title: 'Information concerning the accused',
    slots: ['currentEnlistmentDate', 'currentEnlistmentExpiration', 'totalActiveService', 'education',
            'afqt', 'age', 'maritalStatus', 'numberOfDependents', 'currentPaygrade', 'currentPayAmount',
            'currentPay12Month', 'reducedPaygrade', 'reducedPayAmount', 'reducedPay12Month'],
  },
  { title: 'Action of the Executive Officer (XOI)', hint: 'The form records the XO disposition as two boxes — dismissed, or referred to mast.', checks: RADIO_GROUPS[1], slots: ['xoActionDate'], cite: 'initiation' },
  { title: 'Right to demand trial by court-martial', hint: 'Not applicable to persons attached to or embarked in a vessel.', checks: RADIO_GROUPS[2], cite: 'authority' },
  {
    title: 'Action of the Commanding Officer',
    hint: 'Record what the command decided. This tool does not suggest or evaluate a disposition.',
    checks: ['dismissedNoPunishment', 'dismissedWithWarning', 'pRestriction', 'pRestrictionSuspendDuty',
             'pAdmonitionOral', 'pAdmonitionWriting', 'pReprimandOral', 'pReprimandWriting',
             'pCorrectionalCustody', 'pConfinement', 'pExtraDuties', 'pReduction', 'pForfeiture',
             'pProcessCourtMartial', 'pSuspendedA', 'pSuspendedB'],
    slots: ['pRestrictionPlace', 'pRestrictionDays', 'pRestrictionSuspendPlace',
            'pRestrictionSuspendDays', 'pCorrectionalCustodyDays', 'pConfinementDays',
            'pExtraDutiesDays', 'pReductionPaygrade', 'pForfeitureAmount', 'pForfeitureMonths',
            'pSuspendedAWhat', 'pSuspendedADays', 'pSuspendedBWhat', 'pSuspendedBDays',
            'dateOfMast', 'dateAccusedInformedOfAboveActi', 'appealAckDate1', 'appealAckDate2'],
    cite: 'punishment',
  },
  { title: 'Final administrative action', slots: ['accused', 'decision', 'appeal', 'filedAsOf', 'entriesMadeDate', 'upbRecordedDate'], cite: 'appeal' },
];

const ALL_SLOT_IDS = new Set(FORM_1626_PAGES.flatMap((p) => p.slots.map((s) => s.id)));

export function NjpForm({ state, onChange }: { state: LetterState; onChange: (s: LetterState) => void }) {
  const njp = state.njp;
  const patch = (p: Partial<Njp>) => onChange({ ...state, njp: { ...njp, ...p } });
  const setValue = (id: string, v: string) => patch({ values: { ...njp.values, [id]: v } });
  const setCheck = (id: string, on: boolean) => {
    const group = RADIO_GROUPS.find((g) => g.includes(id));
    const next = { ...njp.checks };
    if (group && on) group.forEach((g) => delete next[g]); // the form's mutually-exclusive boxes
    next[id] = on;
    if (!on) delete next[id];
    patch({ checks: next });
  };
  const setPlea = (id: string, p: Partial<NjpPlea>) =>
    patch({ pleas: njp.pleas.map((r) => (r.id === id ? { ...r, ...p } : r)) });

  const warnings = njpLimitWarnings(state);

  return (
    <>
      <section className="card" id="sec-njp">
        <div className="card-head">
          <h2>Report and Disposition of Offense(s)</h2>
        </div>
        <p className="hint">
          NAVPERS 1626/7 (Rev. 06-2025). A redrawn facsimile of the official form — check it against
          the current edition on MyNavy HR before filing. Signature areas export as CAC-signable
          fields. Nothing you type is stored or sent anywhere.
        </p>

        {warnings.length > 0 && (
          <div className="njp-warn" role="status">
            <strong>Worth a look</strong>
            <ul>
              {warnings.map((w) => (
                <li key={w.id}>{w.text}</li>
              ))}
            </ul>
            <p className="hint">
              These restate limits printed on the form itself. Advisory only — nothing is blocked,
              and the decision is the command&rsquo;s.
            </p>
          </div>
        )}

        {SECTIONS.map((sec) => (
          <div className="njp-section" key={sec.title}>
            <div className="sub-label">{sec.title}</div>
            {sec.hint && <p className="hint">{sec.hint}</p>}
            {sec.checks && (
              <div className="njp-checks">
                {sec.checks.map((id) => (
                  <label className="njp-check" key={id}>
                    <input
                      type="checkbox"
                      checked={!!njp.checks[id]}
                      onChange={(e) => setCheck(id, e.target.checked)}
                    />
                    <span>{CHECK_LABELS[id] ?? id}</span>
                  </label>
                ))}
              </div>
            )}
            {sec.slots && (
              <div className="njp-grid">
                {sec.slots.filter((id) => ALL_SLOT_IDS.has(id)).map((id) => (
                  <label className="njp-field" key={id}>
                    <span>{SLOT_LABELS[id] ?? id}</span>
                    <input
                      type="text"
                      value={njp.values[id] ?? ''}
                      aria-label={SLOT_LABELS[id] ?? id}
                      onChange={(e) => setValue(id, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
            {sec.cite && <Citations kind={sec.cite} />}
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Offenses</h2>
        </div>
        <label className="njp-field">
          <span>Details of Offense(s)</span>
          <textarea
            rows={6}
            aria-label="Details of offenses"
            value={njp.detailsOfOffenses}
            onChange={(e) => patch({ detailsOfOffenses: e.target.value })}
          />
        </label>
        <label className="njp-field">
          <span>Record of Previous Offense(s)</span>
          <textarea
            rows={4}
            aria-label="Record of previous offenses"
            value={njp.recordOfPreviousOffenses}
            onChange={(e) => patch({ recordOfPreviousOffenses: e.target.value })}
          />
        </label>
        <div className="sub-label">Entered pleas and findings</div>
        <p className="hint">
          Type a number or a keyword in the article box — &ldquo;86&rdquo;, &ldquo;awol&rdquo;, and
          &ldquo;absence&rdquo; all find Article 86. The list is the punitive articles as they appear in
          the U.S. Code; it looks an article up, it doesn&rsquo;t suggest what to charge. The sheet
          prints five rows.
        </p>
        {njp.pleas.map((row, i) => (
          <div className="njp-plea" key={row.id}>
            <span className="entry-idx">{i + 1}</span>
            <ArticlePicker
              value={row.article}
              label={`Row ${i + 1} article`}
              onPick={(a) => setPlea(row.id, { article: a })}
            />
            {(['charge', 'specification', 'plea', 'finding'] as const).map((k) => (
              <input
                key={k}
                type="text"
                placeholder={k[0].toUpperCase() + k.slice(1)}
                aria-label={`Row ${i + 1} ${k}`}
                value={row[k]}
                onChange={(e) => setPlea(row.id, { [k]: e.target.value })}
              />
            ))}
            <button title="Remove row" onClick={() => patch({ pleas: njp.pleas.filter((r) => r.id !== row.id) })}>
              ✕
            </button>
          </div>
        ))}
        <button
          className="add-btn"
          onClick={() =>
            patch({ pleas: [...njp.pleas, { id: uid(), article: '', charge: '', specification: '', plea: '', finding: '' }] })
          }
        >
          + Add row
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Restraint &amp; comments</h2>
        </div>
        <label className="njp-field">
          <span>Commanding Officer&rsquo;s comments</span>
          <textarea
            rows={4}
            aria-label="Commanding Officer's comments"
            value={njp.coComments}
            onChange={(e) => patch({ coComments: e.target.value })}
          />
        </label>
      </section>
    </>
  );
}
