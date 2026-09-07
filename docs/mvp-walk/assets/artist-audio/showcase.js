'use strict';
/* Draft artist-audio showcase. Local fixture only. No upload, no mint.
   Bloom consumer follows Astra's SVG contract (motion/README.md).
   Does not rewrite Blender builders or midivault. */
(function () {
  const audio = document.getElementById('fixture-audio');
  const play = document.getElementById('play-pause');
  const volume = document.getElementById('volume');
  const volumeValue = document.getElementById('volume-value');
  const listenStatus = document.getElementById('listen-status');
  const stage = document.getElementById('bloom-stage');
  const motionStatus = document.getElementById('motion-status');
  const theme = document.querySelector('meta[name="theme-color"]');
  if (!audio || !play || !volume || !listenStatus) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bloomSrc = stage && (stage.getAttribute('data-bloom-src') || 'assets/genesis-3d/motion/green-teal-breathing.svg');
  let bloom = null;
  let bloomPaused = true;

  function setListenStatus(text) {
    listenStatus.textContent = text;
  }

  function syncPlayLabel() {
    if (audio.paused) {
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
    } else {
      play.textContent = 'Pause';
      play.setAttribute('aria-pressed', 'true');
    }
  }

  function applyVolume() {
    const level = Number(volume.value);
    audio.volume = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0.8;
    if (volumeValue) volumeValue.value = Math.round(audio.volume * 100) + '%';
  }

  play.addEventListener('click', function () {
    if (audio.paused) {
      const start = audio.play();
      if (start && typeof start.then === 'function') {
        start.then(function () {
          setListenStatus('Playing the development fixture. TEST AUDIO — not the authorized release.');
          syncPlayLabel();
        }).catch(function () {
          setListenStatus('Playback was blocked or failed. Use the native audio control, or try Play again.');
          syncPlayLabel();
        });
      }
    } else {
      audio.pause();
      setListenStatus('Paused. Press Play when you want to hear the fixture again.');
      syncPlayLabel();
    }
  });
  volume.addEventListener('input', applyVolume);
  audio.addEventListener('ended', function () {
    setListenStatus('The short fixture finished. Press Play to hear it again.');
    syncPlayLabel();
  });
  audio.addEventListener('pause', syncPlayLabel);
  audio.addEventListener('play', syncPlayLabel);
  applyVolume();
  syncPlayLabel();
  if (audio.autoplay) {
    audio.autoplay = false;
    audio.pause();
  }

  function applyBloom() {
    if (!bloom) return;
    bloom.classList.toggle('is-paused', bloomPaused || document.hidden || reduced.matches);
    if (motionStatus) {
      motionStatus.textContent = reduced.matches
        ? 'Still, following your device’s reduced-motion setting. Audio still waits for Play.'
        : bloomPaused
          ? 'Bloom paused. Audio is a separate Play control.'
          : 'Breathing bloom is moving. This motion has no sound of its own.';
    }
  }

  if (stage && bloomSrc) {
    fetch(bloomSrc).then(function (response) {
      if (!response.ok) throw new Error('Artwork unavailable');
      return response.text();
    }).then(function (source) {
      const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg' || doc.querySelector('script,foreignObject')) {
        throw new Error('Artwork invalid');
      }
      bloom = document.importNode(doc.documentElement, true);
      bloom.classList.add('bnr-breathing-bloom');
      bloom.style.setProperty('--bloom-duration', '6s');
      bloom.style.setProperty('--bloom-strength', '1');
      bloom.style.setProperty('--bloom-ring-delay', '-0.14s');
      stage.replaceChildren(bloom);
      stage.setAttribute('aria-busy', 'false');
      bloomPaused = reduced.matches;
      applyBloom();
    }).catch(function () {
      stage.setAttribute('aria-busy', 'false');
      if (motionStatus) motionStatus.textContent = 'Bloom SVG could not load. Credits and receipts below still stand.';
    });
  }

  const bloomToggle = document.getElementById('bloom-pause');
  if (bloomToggle) {
    bloomToggle.addEventListener('click', function () {
      if (reduced.matches) return;
      bloomPaused = !bloomPaused;
      bloomToggle.textContent = bloomPaused ? 'Play bloom' : 'Pause bloom';
      applyBloom();
    });
  }
  reduced.addEventListener('change', function () {
    if (reduced.matches) bloomPaused = true;
    applyBloom();
  });
  document.addEventListener('visibilitychange', applyBloom);

  function defaultOpen(reading, kind) {
    if (reading === 'cypherpunk') return kind === 'receipts' || kind === 'limits';
    if (reading === 'raver') return kind === 'artwork';
    return kind === 'credits';
  }
  function restoreVisibleFocus(focus) {
    if (!focus || !focus.isConnected) return;
    let target = focus;
    for (let node = focus.parentElement; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS' && !node.open) target = node.querySelector('summary');
    }
    if (target && target.focus) target.focus({ preventScroll: true });
  }
  let lastReading = null;
  const readingChoices = new Map();
  function applyReading(event) {
    const reading = (event && event.detail && event.detail.reg) || document.body.dataset.reg || 'bee';
    if (reading === lastReading) return;
    const focus = document.activeElement;
    const details = [...document.querySelectorAll('[data-view-disclosure]')];
    if (lastReading) readingChoices.set(lastReading, details.map(function (d) { return d.open; }));
    const previous = readingChoices.get(reading);
    details.forEach(function (d, i) {
      d.open = previous ? previous[i] : defaultOpen(reading, d.dataset.viewDisclosure);
    });
    if (theme) theme.content = reading === 'bee' ? '#f6f7f2' : reading === 'raver' ? '#111018' : '#081610';
    lastReading = reading;
    restoreVisibleFocus(focus);
    applyBloom();
  }
  document.addEventListener('bregister', applyReading);
  applyReading({ detail: { reg: document.body.dataset.reg || 'bee' } });
})();
