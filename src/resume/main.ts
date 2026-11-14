// The resume reads fine without this file. It only adds the button that opens the print dialog,
// where "Save as PDF" produces a copy that always matches the page.
const button = document.getElementById('print') as HTMLButtonElement | null
if (button) {
  button.hidden = false
  button.addEventListener('click', () => window.print())
}
