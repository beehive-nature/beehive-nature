// enable-click.mjs — the one place a browser test may enable a control.
//
// A test that enables a control in one Playwright step and clicks it in the
// next races the page: its own refresh can re-disable the control between the
// two (wallet check, run 37108235973 attempt 1, 2026-10-03). Here the enable
// and the click are one synchronous browser task, so nothing can run between
// them. scripts/lint-e2e-enable-click.mjs pins this file to the statement
// below and fails the run if any other e2e file writes to `disabled`.
//
// A DOM click skips what a Playwright click checks, so the same task first
// refuses a control a person could not press: no box, not visible, or covered
// at its centre by something else.
export const enableAndClick = locator => locator.evaluate(b => {
  b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const r = b.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!r.width || !r.height || getComputedStyle(b).visibility !== 'visible' || !(hit === b || b.contains(hit))) throw new Error('enableAndClick: the control is hidden or covered; a person could not press it');
  b.disabled = false;
  b.click();
});
