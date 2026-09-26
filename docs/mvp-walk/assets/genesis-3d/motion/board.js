'use strict';
/* Campaign-board consumer of Astra's breathing bloom.
   Uses the published SVG contract (README.md / svg-receipt.json):
   root .bnr-breathing-bloom, .is-paused, --bloom-duration / --bloom-strength /
   --bloom-ring-delay. Presets match studio.js. Does not rewrite studio.js,
   register.js, or the Blender builders. Film and SVG export stay on the
   artist studio page. */
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
  const name = document.getElementById('expression-name');
  const value = document.getElementById('intensity-value');
  if (!stage || !play || !status || !intensity || !name || !value) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const src = stage.getAttribute('data-bloom-src') || 'assets/genesis-3d/motion/green-teal-breathing.svg';
  let bloom = null, chosen = 'breathing', paused = false;
  function apply() {
    const preset = presets[chosen];
    document.querySelectorAll('#bloom-board [data-expression]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.expression === chosen));
    });
    name.textContent = preset.name;
    value.value = intensity.value + '%';
    if (!bloom) return;
    bloom.style.setProperty('--bloom-duration', preset.duration);
    const level = Number(intensity.value);
    const strength = level <= 50 ? preset.strength * level / 50 : preset.strength + (2 - preset.strength) * (level - 50) / 50;
    bloom.style.setProperty('--bloom-strength', String(strength));
    bloom.style.setProperty('--bloom-ring-delay', preset.delay);
    bloom.classList.toggle('is-paused', paused || document.hidden);
    play.disabled = reduced.matches || Number(intensity.value) === 0;
    play.textContent = reduced.matches || Number(intensity.value) === 0 ? 'Still view' : paused ? 'Play movement' : 'Pause movement';
    status.textContent = reduced.matches
      ? 'Still, following your device’s reduced-motion setting.'
      : Number(intensity.value) === 0
        ? 'Movement is set to zero. Your bloom is still.'
        : paused
          ? 'Paused. The pose holds.'
          : preset.name + ' is playing.';
  }
  document.querySelectorAll('#bloom-board [data-expression]').forEach(function (button) {
    button.addEventListener('click', function () { chosen = button.dataset.expression; apply(); });
  });
  intensity.addEventListener('input', apply);
  play.addEventListener('click', function () { paused = !paused; apply(); });
  reduced.addEventListener('change', apply);
  document.addEventListener('visibilitychange', apply);
  document.addEventListener('bregister', apply);
  fetch(src).then(function (response) {
    if (!response.ok) throw new Error('Artwork unavailable');
    return response.text();
  }).then(function (source) {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg' || doc.querySelector('script,foreignObject')) {
      throw new Error('Artwork invalid');
    }
    bloom = document.importNode(doc.documentElement, true);
    stage.replaceChildren(bloom);
    stage.setAttribute('aria-busy', 'false');
    apply();
  }).catch(function () {
    stage.setAttribute('aria-busy', 'false');
    play.textContent = 'Artwork unavailable';
    status.textContent = 'The original still is shown. Reload this page to try the movement again.';
  });
})();
