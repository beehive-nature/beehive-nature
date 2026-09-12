'use strict';
(function () {
  const presets = {
    breathing: { name: 'Breathing bloom', duration: '6s', strength: 1, delay: '-0.14s' },
    shared: { name: 'Shared rhythm', duration: '6s', strength: .85, delay: '-0.28s' },
    celebration: { name: 'Celebration', duration: '3.6s', strength: 1.35, delay: '-0.10s' }
  };
  const stage = document.getElementById('bloom-stage');
  const play = document.getElementById('play-pause');
  const status = document.getElementById('motion-status');
  const intensity = document.getElementById('intensity');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const video = document.getElementById('bloom-film');
  let bloom = null, chosen = 'breathing', paused = false, pauseRevision = 0;
  function apply() {
    const preset = presets[chosen];
    document.querySelectorAll('[data-expression]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.expression === chosen)));
    document.getElementById('expression-name').textContent = preset.name;
    document.getElementById('intensity-value').value = intensity.value + '%';
    if (!bloom) return;
    bloom.style.setProperty('--bloom-duration', preset.duration);
    const level = Number(intensity.value);
    const strength = level <= 50 ? preset.strength * level / 50 : preset.strength + (2 - preset.strength) * (level - 50) / 50;
    bloom.style.setProperty('--bloom-strength', String(strength));
    bloom.style.setProperty('--bloom-ring-delay', preset.delay);
    bloom.classList.toggle('is-paused', paused || document.hidden);
    play.disabled = reduced.matches || Number(intensity.value) === 0;
    play.textContent = reduced.matches || Number(intensity.value) === 0 ? 'Still view' : paused ? 'Play movement' : 'Pause movement';
    status.textContent = reduced.matches ? 'Still, following your device’s reduced-motion setting.' : Number(intensity.value) === 0 ? 'Movement is set to zero. Your bloom is still.' : paused ? 'Paused. Take your time.' : preset.name + ' is playing. No sound.';
  }
  document.querySelectorAll('[data-expression]').forEach(button => button.addEventListener('click', () => { chosen = button.dataset.expression; apply(); }));
  intensity.addEventListener('input', apply);
  play.addEventListener('click', () => { paused = !paused; pauseRevision++; apply(); });
  reduced.addEventListener('change', () => { if (reduced.matches) video.pause(); apply(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); apply(); });
  function save(still) {
    if (!bloom) return;
    const copy = bloom.cloneNode(true);
    copy.classList.remove('is-paused');
    if (still) {
      const visibleCells = bloom.querySelectorAll('.bnr-bloom-cell');
      copy.querySelectorAll('.bnr-bloom-cell').forEach((cell, index) => {
        cell.style.setProperty('transform', getComputedStyle(visibleCells[index]).transform, 'important');
      });
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = '.bnr-bloom-cell{animation:none!important}';
      copy.append(style);
      copy.querySelector('desc').textContent += ' This still export freezes the visible composition.';
    }
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'bnr-' + chosen + (still ? '-still' : '') + '.svg';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = still ? 'Still SVG prepared. Check your downloads.' : 'Animated SVG prepared. Check your downloads. Creator credit travels with it.';
  }
  document.getElementById('save-animation').addEventListener('click', () => save(false));
  document.getElementById('save-still').addEventListener('click', () => save(true));
  document.getElementById('load-film').addEventListener('click', async () => {
    const load = document.getElementById('load-film');
    const filmStatus = document.getElementById('film-status');
    const previouslyPaused = paused, revision = pauseRevision;
    let deadline;
    load.disabled = true;
    filmStatus.textContent = 'Loading your 3D loop…';
    paused = true; apply();
    if (!video.getAttribute('src')) video.src = 'green-teal-breathing.mp4';
    video.hidden = false;
    document.getElementById('film-poster').hidden = true;
    video.controls = true;
    try {
      await Promise.race([video.play(), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Film load timeout')), 15000); })]);
      load.textContent = '3D loop loaded · controls below';
      filmStatus.textContent = 'The six-second loop is playing. Use its controls to pause.';
    } catch (_) {
      video.pause(); video.removeAttribute('src'); video.load(); video.controls = false;
      video.hidden = true; document.getElementById('film-poster').hidden = false;
      if (pauseRevision === revision) paused = previouslyPaused;
      apply();
      load.textContent = 'Try the 3D loop again';
      filmStatus.textContent = 'The film could not load. Your bloom is still available. Try again when you are ready.';
    } finally { clearTimeout(deadline); load.disabled = false; }
  });
  fetch('green-teal-breathing.svg').then(response => {
    if (!response.ok) throw new Error('Artwork unavailable');
    return response.text();
  }).then(source => {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg' || doc.querySelector('script,foreignObject')) throw new Error('Artwork invalid');
    bloom = document.importNode(doc.documentElement, true);
    stage.replaceChildren(bloom); stage.setAttribute('aria-busy', 'false');
    document.getElementById('save-animation').disabled = false;
    document.getElementById('save-still').disabled = false;
    document.getElementById('size-note').textContent = 'This self-contained SVG is ' + (new TextEncoder().encode(source).length / 1000).toFixed(1) + ' KB, including the original image and animation. The optional film loads separately.';
    apply();
  }).catch(() => {
    stage.setAttribute('aria-busy', 'false');
    play.textContent = 'Artwork unavailable';
    status.textContent = 'The original still is shown. Reload this page to try the movement again.';
  });
})();
