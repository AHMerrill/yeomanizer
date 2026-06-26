// U.S. Navy grade -> NATO rank code (STANAG 2116). Used by the NATO travel order to
// auto-fill the "OF-x / OR-x" code from a selected US rank. Verified against a real order
// (LCDR = O-4 = OF-3).
export interface NavyRank {
  grade: string; // 'O-4'
  abbr: string; // 'LCDR'
  title: string; // 'Lieutenant Commander'
  nato: string; // 'OF-3'
}

export const NAVY_RANKS: NavyRank[] = [
  { grade: 'E-1', abbr: 'SR', title: 'Seaman Recruit', nato: 'OR-1' },
  { grade: 'E-2', abbr: 'SA', title: 'Seaman Apprentice', nato: 'OR-2' },
  { grade: 'E-3', abbr: 'SN', title: 'Seaman', nato: 'OR-3' },
  { grade: 'E-4', abbr: 'PO3', title: 'Petty Officer Third Class', nato: 'OR-4' },
  { grade: 'E-5', abbr: 'PO2', title: 'Petty Officer Second Class', nato: 'OR-5' },
  { grade: 'E-6', abbr: 'PO1', title: 'Petty Officer First Class', nato: 'OR-6' },
  { grade: 'E-7', abbr: 'CPO', title: 'Chief Petty Officer', nato: 'OR-7' },
  { grade: 'E-8', abbr: 'SCPO', title: 'Senior Chief Petty Officer', nato: 'OR-8' },
  { grade: 'E-9', abbr: 'MCPO', title: 'Master Chief Petty Officer', nato: 'OR-9' },
  { grade: 'W-1', abbr: 'WO1', title: 'Warrant Officer 1', nato: 'WO-1' },
  { grade: 'W-2', abbr: 'CWO2', title: 'Chief Warrant Officer 2', nato: 'WO-2' },
  { grade: 'W-3', abbr: 'CWO3', title: 'Chief Warrant Officer 3', nato: 'WO-3' },
  { grade: 'W-4', abbr: 'CWO4', title: 'Chief Warrant Officer 4', nato: 'WO-4' },
  { grade: 'W-5', abbr: 'CWO5', title: 'Chief Warrant Officer 5', nato: 'WO-5' },
  { grade: 'O-1', abbr: 'ENS', title: 'Ensign', nato: 'OF-1' },
  { grade: 'O-2', abbr: 'LTJG', title: 'Lieutenant Junior Grade', nato: 'OF-1' },
  { grade: 'O-3', abbr: 'LT', title: 'Lieutenant', nato: 'OF-2' },
  { grade: 'O-4', abbr: 'LCDR', title: 'Lieutenant Commander', nato: 'OF-3' },
  { grade: 'O-5', abbr: 'CDR', title: 'Commander', nato: 'OF-4' },
  { grade: 'O-6', abbr: 'CAPT', title: 'Captain', nato: 'OF-5' },
  { grade: 'O-7', abbr: 'RDML', title: 'Rear Admiral (lower half)', nato: 'OF-6' },
  { grade: 'O-8', abbr: 'RADM', title: 'Rear Admiral (upper half)', nato: 'OF-7' },
  { grade: 'O-9', abbr: 'VADM', title: 'Vice Admiral', nato: 'OF-8' },
  { grade: 'O-10', abbr: 'ADM', title: 'Admiral', nato: 'OF-9' },
];

export function rankByGrade(grade: string): NavyRank | undefined {
  return NAVY_RANKS.find((r) => r.grade === grade);
}
