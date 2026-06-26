// CUI privacy sub-category acronyms, per DON "Marking Documents Containing PII"
// guidance. PRVCY (General Privacy) is the most common. Other CUI categories exist
// (Legal, Financial, Law Enforcement, etc.) in the broader CUI Registry.
export interface CuiCategory {
  code: string;
  label: string;
}

export const CUI_CATEGORIES: CuiCategory[] = [
  { code: 'PRVCY', label: 'General Privacy' },
  { code: 'CONTRACT', label: 'Contract Use' },
  { code: 'DREC', label: 'Death Records' },
  { code: 'GENETIC', label: 'Genetic Information' },
  { code: 'HLTH', label: 'Health Information' },
  { code: 'PRIIG', label: 'Inspector General Protected' },
  { code: 'MIL', label: 'Military Personnel Records' },
  { code: 'PERS', label: 'Personnel Records' },
  { code: 'STUD', label: 'Student Records' },
];

// Common Limited Dissemination Controls. DON guidance recommends FEDCON for PII.
export const CUI_DISSEM: CuiCategory[] = [
  { code: 'FEDCON', label: 'Federal employees & contractors' },
  { code: 'FED ONLY', label: 'Federal employees only' },
  { code: 'NOFORN', label: 'No foreign dissemination' },
  { code: 'NOCON', label: 'No contractor access' },
];
