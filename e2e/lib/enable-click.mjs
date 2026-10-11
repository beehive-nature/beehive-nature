// enable-click.mjs — the one place a browser test may enable a control.
//
// A test that enables a control in one Playwright step and clicks it in the
// next races the page: its own refresh can re-disable the control between the
// two (wallet check, run 37108235973 attempt 1, 2026-10-03). Here the enable
// and the click are one synchronous browser task, so nothing can run between
// them. scripts/lint-e2e-enable-click.mjs fails the run if any other e2e file
// writes to `disabled`.
export const enableAndClick = locator => locator.evaluate(b => { b.disabled = false; b.click(); });
