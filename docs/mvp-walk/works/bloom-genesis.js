'use strict';
/* Companion bloom presentation. Motion only. Keep, share and import stay on
   the canonical first-work page. Does not wrap the #35 controller or write a
   second collection identity. */
(function () {
  const CANONICAL = '../first-work.html#work=bnr-genesis-bloom-v1';
  const stage = document.getElementById('bloom-stage');
  const still = document.getElementById('bloom-still');
  const toggle = document.getElementById('bloom-pause');
  const motionStatus = document.getElementById('motion-status');
  const theme = document.querySelector('meta[name="theme-color"]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bloomSrc = stage && (stage.getAttribute('data-bloom-src') ||
    '../assets/genesis-3d/motion/green-teal-breathing.svg');

  let bloom = null;
  let bloomPaused = true;

  function setMotion(text) {
    if (motionStatus) motionStatus.textContent = text;
  }

  function nameLoadedArtwork() {
    if (!bloom) return;
    bloom.removeAttribute('aria-hidden');
    bloom.setAttribute('role', 'img');
    const named = (still && still.getAttribute('alt')) ||
      'Original green–teal–purple bloom by LoVis and his mother.';
    bloom.setAttribute('aria-label', named);
    if (still) {
      still.hidden = true;
      still.setAttribute('aria-hidden', 'true');
    }
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
    nameLoadedArtwork();
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
      stage.appendChild(bloom);
      bloomPaused = reduced.matches;
      applyBloom();
    }).catch(function () {
      if (still) {
        still.hidden = false;
        still.removeAttribute('aria-hidden');
      }
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

  const copyBtn = document.getElementById('copy-work-link');
  const copyStatus = document.getElementById('copy-status');
  if (copyBtn && copyStatus) {
    copyBtn.addEventListener('click', function () {
      let href;
      try {
        href = new URL(CANONICAL, location.href).href;
      } catch (error) {
        href = CANONICAL;
      }
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        copyStatus.textContent = 'Copy is unavailable here. The origin-relative work link is on the card.';
        return;
      }
      navigator.clipboard.writeText(href).then(function () {
        copyStatus.textContent = 'Work link copied. It opens the bloom with its makers’ credit.';
      }, function () {
        copyStatus.textContent = 'Copy was refused. The origin-relative work link is still on the card.';
      });
    });
  }

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
})();
