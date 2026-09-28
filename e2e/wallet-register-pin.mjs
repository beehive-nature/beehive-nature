// The register a wallet battery reads in. The batteries drive the PIPELINE
// (fetch, key, signer, outbox, receipt), and a register never changes what a
// person may do, so the same assertions must hold in all three:
//   WALLET_REG=cypherpunk (default)  every section and note open at once
//   WALLET_REG=bee | raver           the reader's own "everything" view (the
//                                    bee row / raver glyph the page remembers in
//                                    sessionStorage 'wl.view'), notes folded
// CI runs each battery once per register.
export const REG = process.env.WALLET_REG || 'cypherpunk';
if (!['bee', 'raver', 'cypherpunk'].includes(REG)) throw new Error('WALLET_REG must be bee, raver or cypherpunk, not ' + REG);

export function pinRegister(browser) {
  const newContext = browser.newContext.bind(browser);
  // a check that is ABOUT one register (a dress or fold law) opens its context
  // here and sets that register itself; the pin never touches it
  browser.newContextOwnRegister = newContext;
  browser.newContext = async (opts) => {
    const c = await newContext(opts);
    await c.addInitScript(r => {
      try {
        localStorage.setItem('bregister', r);
        if (r !== 'cypherpunk' && !sessionStorage.getItem('wl.view')) sessionStorage.setItem('wl.view', 'all');
      } catch (e) {}
    }, REG);
    return c;
  };
  console.log('register: ' + REG + (REG === 'cypherpunk' ? '' : ' (the "everything" view)'));
}
