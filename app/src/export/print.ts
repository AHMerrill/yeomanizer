// PDF export via the browser print pipeline. This honors the exact @page CSS and
// real-world units in preview.css, so the printed/"Save as PDF" output matches the
// on-screen page character-for-character. Highest-fidelity path.
export function printLetter(): void {
  window.print();
}
