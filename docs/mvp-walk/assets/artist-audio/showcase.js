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
  const volumeBox = volume && volume.closest('label');
  const nativeNote = document.querySelector('.native');
  const creditTitle = document.querySelector('.credit-line b');
  const creditArtist = document.querySelector('.credit-line small');
  const sourcesPanel = document.getElementById('sources-panel');
  const bloomToggle = document.getElementById('bloom-pause');
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
  let playbackRequest = 0;
  let collectionBusy = false;
  let collectionUnknown = false;

  const PUBLIC_REFS = { local: {
    id: FIXTURE_ID,
    title: 'TEST AUDIO — not the authorized release',
    artist: 'Beehive Nature development fixture (not an artist release)',
    rights: 'unconfirmed',
    fixture: true,
    fixtureNote: 'Development-only generated tone. Not an authorized recording.',
    medium: 'audio',
    links: []
  }, youtube: {
    id: 'youtube-' + YT_ID,
    title: 'Sugar Is Sweeter (Sugar Daddy)',
    artist: 'CJ Bolland',
    rights: 'unconfirmed',
    fixture: false,
    fixtureNote: '',
    medium: 'video',
    links: [{ name: 'Listen on YouTube', kind: 'external', url: YT_WATCH }]
  }};

  function setListenStatus(text) {
    listenStatus.textContent = text;
  }

  function stopLocalAudio() {
    playbackRequest += 1;
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
    if (sourcesPanel) sourcesPanel.open = true;
    youtubeFrame.removeAttribute('hidden');
    if (!youtubeFrame.getAttribute('src')) {
      youtubeFrame.setAttribute('src', 'https://www.youtube-nocookie.com/embed/' + YT_ID + '?rel=0&playsinline=1');
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
    play.hidden = source !== 'local';
    audio.hidden = source !== 'local';
    if (volumeBox) volumeBox.hidden = source !== 'local';
    if (nativeNote) nativeNote.hidden = source !== 'local';
    if (creditTitle) creditTitle.textContent = PUBLIC_REFS[source].title;
    if (creditArtist) creditArtist.textContent = PUBLIC_REFS[source].artist
      + (source === 'youtube' ? ' · separate YouTube recording' : '');
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
      setListenStatus('CJ Bolland — use the YouTube player below for play, pause and volume. The development tone is stopped.');
      if (sourceStatus) {
        sourceStatus.textContent = 'Separate listen: YouTube. If it cannot play here, use the direct YouTube link.';
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
    showCollection();
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
    if (source !== 'local') return;
    if (audio.paused) {
      const request = ++playbackRequest;
      const start = audio.play();
      if (start && typeof start.then === 'function') {
        start.then(function () {
          if (request !== playbackRequest || source !== 'local') return;
          setListenStatus('Playing the development fixture. TEST AUDIO — not the authorized release.');
          syncPlayLabel();
        }).catch(function () {
          if (request !== playbackRequest || source !== 'local') return;
          setListenStatus('Playback was blocked or failed. Use the native audio control, or try Play again.');
          syncPlayLabel();
        });
      }
    } else {
      playbackRequest += 1;
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
  audio.addEventListener('volumechange', function () {
    volume.value = String(audio.volume);
    if (volumeValue) volumeValue.value = Math.round(audio.volume * 100) + '%';
  });
  audio.addEventListener('ended', function () {
    if (source === 'local') setListenStatus('The short fixture finished. Press Play to hear it again.');
    syncPlayLabel();
  });
  audio.addEventListener('pause', function () {
    playbackRequest += 1;
    syncPlayLabel();
    if (source === 'local' && !audio.ended) setListenStatus('Paused at ' + audio.currentTime.toFixed(1) + 's. Press Play to continue.');
  });
  audio.addEventListener('play', function () {
    if (source !== 'local') {
      audio.pause();
      return;
    }
    syncPlayLabel();
    setListenStatus('Playing the development fixture. TEST AUDIO — not the authorized release.');
  });
  window.addEventListener('pagehide', function () {
    stopLocalAudio();
    unloadYouTube();
    applySource('local', { silent: true });
  });
  applyVolume();
  applySource('local', { silent: true });
  if (audio.autoplay) {
    audio.autoplay = false;
    audio.pause();
  }

  function applyBloom() {
    if (bloomToggle) {
      bloomToggle.disabled = !bloom || reduced.matches;
      bloomToggle.textContent = reduced.matches ? 'Motion reduced' : bloomPaused ? 'Play bloom' : 'Pause bloom';
      bloomToggle.setAttribute('aria-pressed', String(bloomPaused || reduced.matches));
    }
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
        meta.textContent = ' · ' + item.artist + (item.fixture && !/fixture/i.test(item.artist) ? ' · development fixture' : '');
        li.append(title, meta);
        item.links.forEach(function (link) {
          const a = document.createElement('a');
          a.textContent = ' · ' + link.name;
          a.href = link.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          li.appendChild(a);
        });
        collectionList.appendChild(li);
      });
      if (!store.items.length) {
        const li = document.createElement('li');
        li.textContent = 'Nothing saved yet.';
        collectionList.appendChild(li);
      }
    }
    const saved = store.items.some(function (item) { return item.id === PUBLIC_REFS[source].id; });
    if (saveBtn) {
      saveBtn.disabled = collectionBusy || collectionUnknown || saved;
      saveBtn.textContent = saved ? 'Saved for later' : source === 'youtube' ? 'Save this YouTube track' : 'Save this test reference';
    }
    if (removeBtn) removeBtn.disabled = collectionBusy || collectionUnknown || !saved;
    if (exportBtn) exportBtn.disabled = collectionBusy || collectionUnknown || store.items.length === 0;
    if (collectionStatus && note) collectionStatus.textContent = note;
  }

  function showCollection(note) {
    if (!later) return;
    try {
      const store = later.readStore(localStorage);
      collectionUnknown = false;
      paintCollection(store, note || (store.items.length
        ? store.items.length + ' saved in this browser. Export a copy to keep.'
        : 'Nothing saved yet.'));
      return true;
    } catch (error) {
      collectionUnknown = true;
      [saveBtn, removeBtn, exportBtn].forEach(function (button) { if (button) button.disabled = true; });
      if (collectionStatus) {
        collectionStatus.textContent = note || (error.code === 'unreadable'
          ? 'Saved collection could not be read. Nothing was overwritten. Reload to try again.'
          : 'This browser blocked the collection store. Reload to try again.');
      }
      return false;
    }
  }

  function collectionError(error) {
    if (error.code === 'uncertain-write') return 'The change could not be confirmed. Check the collection below or reload before trying again.';
    if (error.code === 'locking-unavailable') return 'Saving needs a browser with shared storage locking. Your existing collection is unchanged; you can still export it.';
    if (error.code === 'unreadable') return 'Saved collection could not be read. The change was refused; no replacement was written.';
    if (error.code === 'collection-full') return 'Your collection is full. Export a copy, then remove a reference to make room.';
    return 'The change was refused. Your earlier saved entries were not replaced.';
  }

  async function changeCollection(action) {
    if (!later || collectionBusy) return;
    const selected = PUBLIC_REFS[source];
    collectionBusy = true;
    [saveBtn, removeBtn, exportBtn].forEach(function (button) { if (button) button.disabled = true; });
    let note;
    try {
      if (action === 'save') {
        const result = await later.saveItem(localStorage, selected);
        note = result.already ? 'Already saved once.' : 'Saved “' + selected.title + '” for later. This saves a reference, not the audio.';
      } else {
        await later.removeItem(localStorage, selected.id);
        note = 'Removed “' + selected.title + '” from this browser’s collection.';
      }
    } catch (error) {
      note = collectionError(error);
    } finally {
      collectionBusy = false;
      showCollection(note);
    }
  }
  if (saveBtn && later) saveBtn.addEventListener('click', function () { changeCollection('save'); });
  if (removeBtn && later) removeBtn.addEventListener('click', function () { changeCollection('remove'); });
  if (exportBtn && later) {
    exportBtn.addEventListener('click', function () {
      let store;
      try { store = later.readStore(localStorage); }
      catch (error) {
        if (collectionStatus) collectionStatus.textContent = 'Export was refused. Nothing was downloaded.';
        return;
      }
      try {
        const exported = Object.assign({ exportedAt: new Date().toISOString() }, later.exportPublic(store));
        const blob = new Blob([JSON.stringify(exported, null, 2) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bnr-listen-later.json';
        document.body.append(a);
        try { a.click(); } finally {
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
        }
        if (collectionStatus) collectionStatus.textContent = 'Collection download requested. Check your browser’s downloads for bnr-listen-later.json.';
      } catch (error) {
        if (collectionStatus) collectionStatus.textContent = 'Export could not start. Your collection is unchanged.';
      }
    });
  }
  window.addEventListener('storage', function (event) {
    if (later && (event.key === later.STORE || event.key === null)) showCollection();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) showCollection(); });
  showCollection();
})();
