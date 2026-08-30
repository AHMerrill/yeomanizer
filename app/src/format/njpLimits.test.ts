import { describe, it, expect } from 'vitest';
import { njpLimitWarnings, parseGrade } from './njpLimits';
import { defaultFor } from '../defaultState';

const withNjp = (values: Record<string, string>, checks: Record<string, boolean>) => {
  const s = defaultFor('njp-1626-7');
  return { ...s, njp: { ...s.njp, values, checks } };
};
const ids = (s: ReturnType<typeof withNjp>) => njpLimitWarnings(s).map((w) => w.id);

describe('parseGrade', () => {
  it('reads the grade formats a yeoman actually types', () => {
    expect(parseGrade('E-3')).toEqual({ branch: 'E', n: 3 });
    expect(parseGrade('e3')).toEqual({ branch: 'E', n: 3 });
    expect(parseGrade('O-4')).toEqual({ branch: 'O', n: 4 });
    expect(parseGrade('CWO3')).toEqual({ branch: 'W', n: 3 });
  });
  it('returns null rather than guessing', () => {
    expect(parseGrade('')).toBeNull();
    expect(parseGrade('SN')).toBeNull();
    expect(parseGrade('Seaman')).toBeNull();
  });
});

describe('njpLimitWarnings — only limits printed on the form', () => {
  it('is silent when the grade is blank or unparseable (never guesses)', () => {
    expect(ids(withNjp({}, { pReduction: true, pConfinement: true }))).toEqual([]);
    expect(ids(withNjp({ rateGrade: 'Seaman' }, { pReduction: true }))).toEqual([]);
  });

  it('flags reduction above E-6 — the form says (E-6 and below only)', () => {
    expect(ids(withNjp({ rateGrade: 'E-7' }, { pReduction: true }))).toContain('reduction');
    expect(ids(withNjp({ rateGrade: 'E-5' }, { pReduction: true }))).not.toContain('reduction');
  });

  it('flags confinement above E-3 — the form says (Embarked E-3 and below only)', () => {
    expect(ids(withNjp({ rateGrade: 'E-4' }, { pConfinement: true }))).toContain('confinement');
    expect(ids(withNjp({ rateGrade: 'E-3' }, { pConfinement: true }))).not.toContain('confinement');
  });

  it('flags oral admonition/reprimand for an officer — the form says (enlisted only)', () => {
    const w = ids(withNjp({ rateGrade: 'O-3' }, { pAdmonitionOral: true, pReprimandOral: true }));
    expect(w).toContain('admonitionOral');
    expect(w).toContain('reprimandOral');
  });

  it('flags suspension from duty for an enlisted member — the form says (officers only)', () => {
    expect(ids(withNjp({ rateGrade: 'E-6' }, { pRestrictionSuspendDuty: true }))).toContain('restrictionSuspendDuty');
    expect(ids(withNjp({ rateGrade: 'O-2' }, { pRestrictionSuspendDuty: true }))).not.toContain('restrictionSuspendDuty');
  });

  it('restates the vessel exception when a court-martial election is recorded', () => {
    expect(ids(withNjp({}, { doNotDemandTrial: true }))).toEqual(['vesselException']);
  });

  it('says nothing at all on a blank form, and never on another type', () => {
    expect(njpLimitWarnings(defaultFor('njp-1626-7'))).toEqual([]);
    expect(njpLimitWarnings(defaultFor('standard-letter'))).toEqual([]);
  });

  // The hard boundary: these strings restate the form and nothing else.
  it('never recommends, ranks, or evaluates a punishment', () => {
    const all = njpLimitWarnings(withNjp({ rateGrade: 'E-7' }, {
      pReduction: true, pConfinement: true, pAdmonitionOral: true, doNotDemandTrial: true,
    })).map((w) => w.text.toLowerCase()).join(' ');
    for (const banned of ['should', 'recommend', 'appropriate', 'guilty', 'innocent', 'we suggest',
                          'typical', 'consider ', 'instead', 'too harsh', 'too lenient', 'excessive']) {
      expect(all).not.toContain(banned);
    }
  });
});
