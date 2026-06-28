// A curated set of common Standard Subject Identification Codes (SSICs) to help users who don't have
// one memorized — searchable by number or keyword in the editor. This is NOT the full catalog (the
// complete list of ~2,200 codes is in SECNAV M-5210.2, public domain); it covers all 13 major subject
// GROUPS plus the most commonly used second-level codes. Codes/titles are not invented — unknown codes
// are left to the user to type directly.
export interface SsicOption {
  code: string;
  label: string;
  major?: boolean; // one of the 13 top-level subject groups
}

export const COMMON_SSIC: SsicOption[] = [
  { code: '1000', label: 'Military Personnel', major: true },
  { code: '1300', label: 'Assignment & Distribution' },
  { code: '1320', label: 'Orders' },
  { code: '1500', label: 'Training & Education' },
  { code: '1610', label: 'Performance Evaluations / Counseling' },
  { code: '1650', label: 'Awards & Decorations' },
  { code: '1700', label: 'Morale, Welfare & Recreation' },
  { code: '1740', label: 'Family Support / Programs' },
  { code: '1900', label: 'Separation & Retirement' },
  { code: '2000', label: 'Telecommunications', major: true },
  { code: '3000', label: 'Operations & Readiness', major: true },
  { code: '3100', label: 'Naval Vessels & Aircraft' },
  { code: '3500', label: 'Training & Readiness (operational)' },
  { code: '4000', label: 'Logistics', major: true },
  { code: '4400', label: 'Supply Control' },
  { code: '4600', label: 'Transportation & Travel' },
  { code: '5000', label: 'General Administration & Management', major: true },
  { code: '5040', label: 'Inspections / Management Reviews' },
  { code: '5100', label: 'Safety & Occupational Health' },
  { code: '5200', label: 'Management Programs & Techniques' },
  { code: '5210', label: 'Records / Information Management' },
  { code: '5211', label: 'Privacy & FOIA' },
  { code: '5215', label: 'Directives Management' },
  { code: '5216', label: 'Correspondence Management' },
  { code: '5300', label: 'Manpower' },
  { code: '5350', label: 'Alcohol & Drug Abuse' },
  { code: '5354', label: 'Equal Opportunity' },
  { code: '5510', label: 'Personnel & Information Security' },
  { code: '5520', label: 'Investigations' },
  { code: '5800', label: 'Legal Services (JAG)' },
  { code: '6000', label: 'Medicine & Dentistry', major: true },
  { code: '7000', label: 'Financial Management', major: true },
  { code: '7220', label: 'Pay & Allowances' },
  { code: '8000', label: 'Ordnance Material', major: true },
  { code: '9000', label: 'Ships Design & Material', major: true },
  { code: '10000', label: 'General Material', major: true },
  { code: '11000', label: 'Facilities & Activities Ashore', major: true },
  { code: '12000', label: 'Civilian Personnel', major: true },
  { code: '13000', label: 'Aeronautical & Astronautical Material', major: true },
];
