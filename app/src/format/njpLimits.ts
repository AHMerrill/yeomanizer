// Eligibility checks for NAVPERS 1626/7 — and ONLY the ones printed on the form itself.
//
// Every rule below is a verbatim restatement of a parenthetical the Government form prints next to
// the box: "(enlisted only)", "(E-6 and below only)", "(Embarked E-3 and below only)",
// "(officers only)", "(Not applicable to persons attached to or embarked in a vessel)". Nothing
// here is derived from the JAGMAN, the MCM, or anywhere else, and no numeric maximum (days of
// restriction, months of forfeiture) is checked — those limits are NOT on the form and would have
// to come from an authority we can cite. Until then they stay out.
//
// HARD BOUNDARY: this never recommends, ranks, or evaluates a punishment, and never comments on
// guilt, disposition, or what a command "should" do. It observes that a box the command ticked
// carries a printed eligibility limit that the grade entered on the same form appears to fall
// outside of. It is advisory, it never blocks an export, and it is silent when the grade field is
// blank or unparseable — a guess here would be worse than no check at all.
import type { LetterState } from '../types';

export interface NjpWarning {
  id: string;
  text: string;
}

type Branch = 'E' | 'W' | 'O';
interface Grade {
  branch: Branch;
  n: number;
}

// "E-3", "E3", "O-4", "W-2", "CWO3" → a comparable grade. Anything else → null (stay silent).
export function parseGrade(raw: string): Grade | null {
  const s = (raw || '').trim().toUpperCase();
  if (!s) return null;
  let m = /^(?:CWO|W)\s*-?\s*([1-5])$/.exec(s);
  if (m) return { branch: 'W', n: Number(m[1]) };
  m = /^([EO])\s*-?\s*([1-9])$/.exec(s);
  if (m) return { branch: m[1] as Branch, n: Number(m[2]) };
  return null;
}

// The grade the form carries for the accused: "Rate/Grade" first, then "Current Paygrade".
function accusedGrade(s: LetterState): Grade | null {
  return parseGrade(s.njp.values.rateGrade ?? '') ?? parseGrade(s.njp.values.currentPaygrade ?? '');
}

const isEnlisted = (g: Grade) => g.branch === 'E';
const isOfficer = (g: Grade) => g.branch === 'O' || g.branch === 'W';

export function njpLimitWarnings(state: LetterState): NjpWarning[] {
  if (state.type !== 'njp-1626-7') return [];
  const { checks } = state.njp;
  const g = accusedGrade(state);
  const out: NjpWarning[] = [];
  const grade = (gg: Grade) => `${gg.branch === 'W' ? 'W' : gg.branch}-${gg.n}`;

  if (g) {
    if (checks.pAdmonitionOral && !isEnlisted(g)) {
      out.push({ id: 'admonitionOral', text: `The form marks "Admonition: Oral" as (enlisted only); the grade entered is ${grade(g)}.` });
    }
    if (checks.pReprimandOral && !isEnlisted(g)) {
      out.push({ id: 'reprimandOral', text: `The form marks "Reprimand: Oral" as (enlisted only); the grade entered is ${grade(g)}.` });
    }
    if (checks.pReduction && !(isEnlisted(g) && g.n <= 6)) {
      out.push({ id: 'reduction', text: `The form marks "Reduction to pay grade" as (E-6 and below only); the grade entered is ${grade(g)}.` });
    }
    if (checks.pConfinement && !(isEnlisted(g) && g.n <= 3)) {
      out.push({ id: 'confinement', text: `The form marks "Confinement" as (Embarked E-3 and below only); the grade entered is ${grade(g)}.` });
    }
    if (checks.pRestrictionSuspendDuty && !isOfficer(g)) {
      out.push({ id: 'restrictionSuspendDuty', text: `The form marks "Restriction … with suspension from duty" as (officers only); the grade entered is ${grade(g)}.` });
    }
  }

  // Not a grade question, so it is surfaced as the form's own note rather than a mismatch. The
  // tool cannot know whether the accused is attached to or embarked in a vessel, and does not ask.
  if (checks.demandTrial || checks.doNotDemandTrial) {
    out.push({
      id: 'vesselException',
      text: 'The form notes the right to demand trial by court-martial is "Not applicable to persons attached to or embarked in a vessel."',
    });
  }

  return out;
}
