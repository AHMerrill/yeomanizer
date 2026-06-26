// Date formats — SECNAV M-5216.5 2-16. Day has NO leading zero.

const MONTHS_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Abbreviated (sender's symbol): "7 Sep 06"
export function abbreviatedDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

// Standard (in text): "5 May 2015"
export function standardDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

// Civilian (to Congress/business): "January 14, 2014"
export function civilianDate(d: Date): string {
  return `${MONTHS_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
