'use strict';
/* Draft artist-audio showcase. Local fixture only. No upload, no mint.
   Bloom consumer follows Astra's SVG contract (motion/README.md).
   Does not rewrite Blender builders or midivault.
   Users pick a view (how) and a source (where). Source switches stop the
   previous in-page player. No automatic fallback. Empty ANT/AR are not
   selectable providers. */
(function () {
  const audio = document.getElementById('fixture-audio');
  const play = document.getElementById('play-pause');
  const watch = document.getElementById('watch');
  const volume = document.getElementById('volume');
  const volumeValue = document.getElementById('volume-value');
  const listenStatus = document.getElementById('listen-status');
  const sourceStatus = document.getElementById('source-status');
  const sourceButtons = [...document.querySelectorAll('button[data-source]')];
  const youtubeHost = document.getElementById('youtube-host');
  const youtubeFrame = document.getElementById('youtube-player');
  const stage = document.getElementById('bloom-stage');
  const motionStatus = document.getElementById('motion-status');
  const theme = document.querySelector('meta[name="theme-color"]');
  const saveBtn = document.getElementById('save-later');
  const removeBtn = document.getElementById('remove-later');
  const exportBtn = document.getElementById('export-later');
  const collectionStatus = document.getElementById('collection-status');
  const collectionList = document.getElementById('collection-list');
  if (!audio || !play || !volume || !listenStatus) return;

  const YT_ID = 'pb6OqIyyLAk'; // PUBLIC-CONSTANT: Astra-supplied YouTube upload id
  const YT_WATCH = 'https://www.youtube.com/watch?v=' + YT_ID;
  const FIXTURE_ID = 'test-audio-not-authorized-release';
  const later = window.BNRListenLater;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bloomSrc = stage && (stage.getAttribute('data-bloom-src') || 'assets/genesis-3d/motion/green-teal-breathing.svg');

  let bloom = null;
  let bloomPaused = true;
  let source = 'local';
  let youtubeLoaded = false;

  const PUBLIC_REF = {
    id: FIXTURE_ID,
    title: 'TEST AUDIO — not the authorized release',
    artist: 'Beehive Nature development fixture (not an artist release)',
    rights: 'unconfirmed',
    fixture: true,
    fixtureNote: 'Development-only generated tone. Not an authorized recording.',
    medium: 'audio',
    links: [
      { name: 'YouTube', kind: 'external', url: YT_WATCH }
    ]
  };

  function setListenStatus(text) {
    listenStatus.textContent = text;
  }

  function stopLocalAudio() {
    audio.pause();
    syncPlayLabel();
  }

  function unloadYouTube() {
    if (youtubeFrame) {
      youtubeFrame.removeAttribute('src');
      youtubeFrame.setAttribute('hidden', '');
    }
    if (youtubeHost) youtubeHost.hidden = true;
    youtubeLoaded = false;
  }

  function loadYouTube() {
    if (!youtubeFrame || !youtubeHost) return;
    youtubeHost.hidden = false;
    youtubeFrame.removeAttribute('hidden');
    if (!youtubeFrame.getAttribute('src')) {
      youtubeFrame.setAttribute('src', 'https://www.youtube-nocookie.com/embed/' + YT_ID + '?rel=0&modestbranding=1');
    }
    youtubeLoaded = true;
  }

  function applySource(next, opts) {
    const fromUser = !opts || !opts.silent;
    if (next === source && fromUser && next !== 'youtube') return;
    if (next === 'autonomi' || next === 'arweave') {
      if (sourceStatus) {
        sourceStatus.textContent = next === 'autonomi'
          ? 'Autonomi is not uploaded. This is not a playback source yet.'
          : 'Arweave is not uploaded. This is not a playback source yet.';
      }
      return;
    }
    if (next !== 'local' && next !== 'youtube') return;
    if (next !== source) {
      if (source === 'local') stopLocalAudio();
      if (source === 'youtube') unloadYouTube();
    }
    source = next;
    sourceButtons.forEach(function (button) {
      const available = button.getAttribute('data-available') === 'true';
      const current = button.getAttribute('data-source') === source;
      button.setAttribute('aria-pressed', String(current && available));
      button.disabled = !available;
    });
    if (source === 'youtube') {
      loadYouTube();
      play.disabled = false;
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
      setListenStatus('Local test audio is stopped. YouTube’s own player is below. BNR cannot control it. Embed is not guaranteed. Press Play to return to the local fixture.');
      if (sourceStatus) {
        sourceStatus.textContent = 'Source: YouTube (external). A public HTTPS host may help an embed, but YouTube still needs a valid client/referrer and per-video embed permission. DNS alone cannot guarantee playback. Direct watch link stays available.';
      }
    } else {
      play.disabled = false;
      if (youtubeLoaded) unloadYouTube();
      setListenStatus(audio.paused
        ? (audio.currentTime > 0
          ? 'Paused at ' + audio.currentTime.toFixed(1) + 's. Press Play to continue the development fixture.'
          : 'Idle. Press Play to hear the 1.5 second development tone.')
        : 'Playing the development fixture. TEST AUDIO — not the authorized release.');
      if (sourceStatus) {
        sourceStatus.textContent = 'Source: local test audio on this page (development fixture).';
      }
      syncPlayLabel();
    }
  }

  function syncPlayLabel() {
    if (source !== 'local') {
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
      return;
    }
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
    if (source !== 'local') {
      applySource('local', { silent: true });
    }
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
      setListenStatus('Paused at ' + audio.currentTime.toFixed(1) + 's. Press Play to continue.');
      syncPlayLabel();
    }
  });
  if (watch) {
    watch.disabled = true;
    watch.setAttribute('aria-disabled', 'true');
    watch.addEventListener('click', function () {
      setListenStatus('Watch is unavailable. This board has no video file. The optional 3D bloom film was not copied here.');
    });
  }
  sourceButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      applySource(button.getAttribute('data-source'));
    });
  });
  volume.addEventListener('input', applyVolume);
  audio.addEventListener('ended', function () {
    if (source === 'local') setListenStatus('The short fixture finished. Press Play to hear it again.');
    syncPlayLabel();
  });
  audio.addEventListener('pause', syncPlayLabel);
  audio.addEventListener('play', function () {
    if (source !== 'local') {
      audio.pause();
      return;
    }
    syncPlayLabel();
  });
  applyVolume();
  applySource('local', { silent: true });
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
    }).then(function (sourceText) {
      const doc = new DOMParser().parseFromString(sourceText, 'image/svg+xml');
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
    if (reading === 'cypherpunk') return kind === 'receipts' || kind === 'limits' || kind === 'storage';
    if (reading === 'raver') return kind === 'artwork' || kind === 'sources';
    return kind === 'credits' || kind === 'sources';
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
    applySource(source, { silent: true });
  }
  document.addEventListener('bregister', applyReading);
  applyReading({ detail: { reg: document.body.dataset.reg || 'bee' } });

  function paintCollection(store, note) {
    if (collectionList) {
      collectionList.replaceChildren();
      store.items.forEach(function (item) {
        const li = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = item.title;
        const meta = document.createElement('span');
        meta.textContent = item.fixture ? ' · development fixture · rights ' + item.rights : ' · rights ' + item.rights;
        li.append(title, meta);
        collectionList.appendChild(li);
      });
      if (!store.items.length) {
        const li = document.createElement('li');
        li.textContent = 'Nothing saved yet.';
        collectionList.appendChild(li);
      }
    }
    const saved = store.items.some(function (item) { return item.id === FIXTURE_ID; });
    if (saveBtn) saveBtn.disabled = saved;
    if (removeBtn) removeBtn.disabled = !saved;
    if (exportBtn) exportBtn.disabled = store.items.length === 0;
    if (collectionStatus && note) collectionStatus.textContent = note;
  }

  function showCollection() {
    if (!later) return;
    try {
      paintCollection(later.readStore(localStorage), collectionStatus ? collectionStatus.textContent : '');
    } catch (error) {
      if (collectionStatus) {
        collectionStatus.textContent = error.code === 'unreadable'
          ? 'Saved collection could not be read. Nothing was overwritten.'
          : 'This browser blocked the collection store. Nothing was saved or erased.';
      }
    }
  }

  if (saveBtn && later) {
    saveBtn.addEventListener('click', function () {
      let before;
      try { before = later.readStore(localStorage); }
      catch (error) {
        if (collectionStatus) {
          collectionStatus.textContent = error.code === 'unreadable'
            ? 'Saved collection could not be read. Save was refused. Earlier entries were not erased.'
            : 'Save was refused. This browser blocked storage. Earlier entries were not erased.';
        }
        return;
      }
      try {
        const result = later.saveItem(localStorage, PUBLIC_REF);
        paintCollection(result.store, result.already
          ? 'Already saved. One reference stays once.'
          : 'Saved this fixture’s public credit and YouTube link. Not a download. Not offline audio.');
      } catch (error) {
        if (collectionStatus) collectionStatus.textContent = 'Save was refused. Earlier entries were not erased.';
        paintCollection(before, '');
      }
    });
  }
  if (removeBtn && later) {
    removeBtn.addEventListener('click', function () {
      let before;
      try { before = later.readStore(localStorage); }
      catch (error) {
        if (collectionStatus) collectionStatus.textContent = 'Remove was refused. Earlier entries were not erased.';
        return;
      }
      try {
        paintCollection(later.removeItem(localStorage, FIXTURE_ID), 'Removed the saved fixture reference from this browser.');
      } catch (error) {
        if (collectionStatus) collectionStatus.textContent = 'Remove was refused. Earlier entries were not erased.';
        paintCollection(before, '');
      }
    });
  }
  if (exportBtn && later) {
    exportBtn.addEventListener('click', function () {
      let store;
      try { store = later.readStore(localStorage); }
      catch (error) {
        if (collectionStatus) collectionStatus.textContent = 'Export was refused. Nothing was downloaded.';
        return;
      }
      const exported = Object.assign({ exportedAt: new Date().toISOString() }, later.exportPublic(store));
      const blob = new Blob([JSON.stringify(exported, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bnr-listen-later.json';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      if (collectionStatus) collectionStatus.textContent = 'Exported public metadata only. No local paths, wallet data, or storage addresses.';
    });
  }
  showCollection();
})();
