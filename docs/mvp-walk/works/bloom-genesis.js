'use strict';
/* Draft bloom work page. Reuses Astra's breathing SVG contract and the
   listen-later collection already on main. Does not edit kandi or claim
   a public work URL, receive path, or licensed media copy. */
(function () {
  const stage = document.getElementById('bloom-stage');
  const still = document.getElementById('bloom-still');
  const toggle = document.getElementById('bloom-pause');
  const motionStatus = document.getElementById('motion-status');
  const keepBtn = document.getElementById('keep-reference');
  const forgetBtn = document.getElementById('forget-reference');
  const keepStatus = document.getElementById('keep-status');
  const theme = document.querySelector('meta[name="theme-color"]');
  const later = window.BNRListenLater;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bloomSrc = stage && (stage.getAttribute('data-bloom-src') ||
    '../assets/genesis-3d/motion/green-teal-breathing.svg');

  const WORK_REF = {
    id: 'bloom-genesis-lovis-mother',
    title: 'Green–teal–purple bloom',
    artist: 'LoVis and his mother',
    rights: 'original artwork — reference only, not a license',
    fixture: false,
    fixtureNote: 'Visual reference kept in this browser. Not a licensed media copy. No public work URL yet.',
    medium: 'visual',
    links: []
  };

  let bloom = null;
  let bloomPaused = true;
  let keepBusy = false;
  let keepUnknown = false;

  function setMotion(text) {
    if (motionStatus) motionStatus.textContent = text;
  }

  function applyBloom() {
    if (toggle) {
      toggle.hidden = !bloom;
      toggle.disabled = !bloom || reduced.matches;
      toggle.textContent = reduced.matches ? 'Motion reduced' : bloomPaused ? 'Let it breathe' : 'Rest the bloom';
      toggle.setAttribute('aria-pressed', String(bloomPaused || reduced.matches));
    }
    if (!bloom) return;
    bloom.classList.toggle('is-paused', bloomPaused || document.hidden || reduced.matches);
    if (still) still.hidden = true;
    setMotion(reduced.matches
      ? 'Resting artwork. This browser asked for less motion.'
      : bloomPaused
        ? 'The original bloom is still. Breathing is optional.'
        : 'A gentle breath inside this artwork. It is not a live connection.');
  }

  if (stage && bloomSrc) {
    fetch(bloomSrc).then(function (response) {
      if (!response.ok) throw new Error('bloom-missing');
      return response.text();
    }).then(function (markup) {
      const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
      if (doc.querySelector('parsererror')) throw new Error('bloom-unreadable');
      bloom = document.importNode(doc.documentElement, true);
      bloom.classList.add('bnr-breathing-bloom');
      bloom.removeAttribute('width');
      bloom.removeAttribute('height');
      bloom.style.setProperty('--bloom-duration', '6s');
      bloom.style.setProperty('--bloom-strength', '1');
      bloom.style.setProperty('--bloom-ring-delay', '-0.14s');
      bloom.setAttribute('aria-hidden', 'true');
      stage.appendChild(bloom);
      bloomPaused = reduced.matches;
      applyBloom();
    }).catch(function () {
      if (still) still.hidden = false;
      if (toggle) toggle.hidden = true;
      setMotion('The resting still is showing. Breathing motion needs a local HTTP server.');
    });
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      if (!bloom || reduced.matches) return;
      bloomPaused = !bloomPaused;
      applyBloom();
    });
  }
  document.addEventListener('visibilitychange', applyBloom);
  if (reduced.addEventListener) reduced.addEventListener('change', function () {
    bloomPaused = reduced.matches || bloomPaused;
    applyBloom();
  });

  function paintKeep(store, note) {
    const saved = store.items.some(function (item) { return item.id === WORK_REF.id; });
    if (keepBtn) {
      keepBtn.disabled = keepBusy || keepUnknown || saved;
      keepBtn.textContent = saved ? 'Kept in this browser' : 'Keep a reference';
    }
    if (forgetBtn) {
      forgetBtn.hidden = !saved;
      forgetBtn.disabled = keepBusy || keepUnknown || !saved;
    }
    if (keepStatus && note) keepStatus.textContent = note;
  }

  function showKeep(note) {
    if (!later) {
      if (keepBtn) keepBtn.disabled = true;
      if (keepStatus) keepStatus.textContent = 'The shared collection script did not load. The share card still holds the credit.';
      return false;
    }
    try {
      const store = later.readStore(localStorage);
      keepUnknown = false;
      paintKeep(store, note || (store.items.some(function (item) { return item.id === WORK_REF.id; })
        ? 'This bloom is already in your browser collection. That is a reference, not ownership.'
        : 'Keep a credited pointer in this browser. It is not a copy of the artwork and not a license.'));
      return true;
    } catch (error) {
      keepUnknown = true;
      if (keepBtn) keepBtn.disabled = true;
      if (forgetBtn) forgetBtn.disabled = true;
      if (keepStatus) {
        keepStatus.textContent = note || (error.code === 'unreadable'
          ? 'A saved collection could not be read. Nothing was overwritten.'
          : 'This browser blocked the collection store.');
      }
      return false;
    }
  }

  function keepError(error) {
    if (error.code === 'locking-unavailable') {
      return 'Saving needs shared storage locking. Your collection is unchanged. The share card still holds the credit.';
    }
    if (error.code === 'uncertain-write') return 'The change could not be confirmed. Nothing else was replaced.';
    if (error.code === 'unreadable') return 'The collection could not be read. The change was refused.';
    if (error.code === 'collection-full') return 'Your collection is full. Remove a reference on the listening board to make room.';
    return 'The change was refused. Earlier saved entries were not replaced.';
  }

  async function changeKeep(action) {
    if (!later || keepBusy) return;
    keepBusy = true;
    if (keepBtn) keepBtn.disabled = true;
    if (forgetBtn) forgetBtn.disabled = true;
    let note;
    try {
      if (action === 'save') {
        const result = await later.saveItem(localStorage, WORK_REF);
        note = result.already
          ? 'Already kept once. Still a reference, not a licensed copy.'
          : 'Kept a credited reference in this browser. Not ownership. Not a media file.';
      } else {
        await later.removeItem(localStorage, WORK_REF.id);
        note = 'Removed this bloom from the browser collection. The artwork itself was never downloaded.';
      }
    } catch (error) {
      note = keepError(error);
    } finally {
      keepBusy = false;
      showKeep(note);
    }
  }

  if (keepBtn) keepBtn.addEventListener('click', function () { changeKeep('save'); });
  if (forgetBtn) forgetBtn.addEventListener('click', function () { changeKeep('remove'); });
  window.addEventListener('storage', function (event) {
    if (later && (event.key === later.STORE || event.key === null)) showKeep();
  });

  let lastReading = null;
  const readingChoices = new Map();
  function applyReading(event) {
    const reading = (event && event.detail && event.detail.reg) || document.body.dataset.reg || 'bee';
    if (reading === lastReading) return;
    const details = [...document.querySelectorAll('[data-view-disclosure]')];
    if (lastReading) readingChoices.set(lastReading, details.map(function (d) { return d.open; }));
    const previous = readingChoices.get(reading);
    details.forEach(function (d, i) {
      d.open = previous ? previous[i] : reading === 'cypherpunk' && d.dataset.viewDisclosure === 'receipts';
    });
    if (theme) theme.content = reading === 'bee' ? '#f6f7f2' : reading === 'raver' ? '#16111f' : '#081610';
    lastReading = reading;
    applyBloom();
  }
  document.addEventListener('bregister', applyReading);
  applyReading({ detail: { reg: document.body.dataset.reg || 'bee' } });
  showKeep();
})();
