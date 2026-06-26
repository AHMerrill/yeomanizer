// A curated set of common Standard Subject Identification Codes (SSICs) to help
// users who don't have one memorized. This is NOT the full list — the complete
// catalog is in SECNAV M-5210.2. Codes are the major subject groups.
export interface SsicOption {
  code: string;
  label: string;
}

export const COMMON_SSIC: SsicOption[] = [
  { code: '1000', label: 'Military Personnel (general)' },
  { code: '1300', label: 'Assignment & Distribution' },
  { code: '1320', label: 'Orders' },
  { code: '1500', label: 'Training & Education' },
  { code: '1610', label: 'Performance Evaluations / Counseling' },
  { code: '1650', label: 'Awards & Decorations' },
  { code: '1700', label: 'Morale, Welfare & Recreation' },
  { code: '1740', label: 'Family Support / Programs' },
  { code: '1900', label: 'Separation & Retirement' },
  { code: '3000', label: 'Operations & Readiness' },
  { code: '3100', label: 'Naval Vessels & Aircraft' },
  { code: '3500', label: 'Training & Readiness (operational)' },
  { code: '4000', label: 'Logistics' },
  { code: '4400', label: 'Supply Control' },
  { code: '4600', label: 'Transportation & Travel' },
  { code: '5000', label: 'General Administration & Management' },
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
  { code: '6000', label: 'Medicine & Dentistry' },
  { code: '7000', label: 'Financial Management' },
  { code: '7220', label: 'Pay & Allowances' },
  { code: '11000', label: 'Facilities & Activities Ashore' },
  { code: '12000', label: 'Civilian Personnel' },
];
