'use strict';
(function () {
  const work = window.BNRFirstWork;
  const later = window.BNRListenLater;
  const el = id => document.getElementById(id);
  if (!work || !later || !el('keep-work')) return;
  const canonical = later.publicItem(work.record);
  const localLink = work.shareURL(location.href);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let known = false;
  let busy = false;
  let pendingImport = null;
  let fileGeneration = 0;
  let shareGeneration = 0;
  let bloom = null;
  let paused = reduced.matches;

  function note(id, text) { if (el(id)) el(id).textContent = text; }
  function entryText(item) { return item.title + ' — ' + item.artist; }
  function errorText(error) {
    switch (error && error.code) {
      case 'uncertain-write': return 'The change could not be confirmed. Check the collection below or reload before trying again.';
      case 'conflicting-entry': return 'Two references use the same ID with different details. Nothing was added or replaced.';
      case 'locking-unavailable': return 'This browser cannot safely coordinate saves. You can still view and export your collection.';
      case 'unreadable': return 'This collection could not be read. It has not been replaced.';
      case 'collection-full': return 'The collection is full. Export a copy, then remove a reference to make room.';
      case 'invalid-entry': return 'That file is not a supported BNR collection. Nothing was added.';
      default: return 'The browser refused the change. Nothing was replaced.';
    }
  }
  function refresh(message) {
    const focus = document.activeElement;
    const focusId = focus && focus.dataset && focus.dataset.collectionId;
    const focusIndex = [...el('work-collection').children].findIndex(row => row.dataset.collectionId === focusId);
    let store;
    try { store = later.readStore(localStorage); }
    catch (error) {
      el('keep-work').disabled = true;
      el('export-collection').disabled = true;
      el('confirm-import').disabled = true;
      for (const button of el('work-collection').querySelectorAll('button')) button.disabled = true;
      note('collection-status', message || errorText(error));
      note('work-status', 'Your collection is unavailable. You can still enjoy and share the bloom.');
      return;
    }
    el('work-collection').replaceChildren();
    for (const item of store.items) {
      const row = document.createElement('li');
      row.dataset.collectionId = item.id;
      const text = document.createElement('span');
      text.dataset.collectionId = item.id;
      text.setAttribute('tabindex', '-1');
      if (item.id === work.id && JSON.stringify(item) === JSON.stringify(canonical)) {
        const link = document.createElement('a');
        link.href = localLink;
        link.textContent = entryText(item);
        text.appendChild(link);
      } else {
        text.textContent = entryText(item);
        for (const ref of item.links) {
          const link = document.createElement('a');
          link.href = ref.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.textContent = ' · ' + ref.name + ' (new tab)';
          text.appendChild(link);
        }
      }
      const remove = document.createElement('button');
      remove.dataset.collectionId = item.id;
      remove.type = 'button'; remove.textContent = 'Remove'; remove.disabled = busy;
      remove.setAttribute('aria-label', 'Remove ' + item.title);
      remove.addEventListener('click', () => change('remove', item.id));
      row.append(text, remove); el('work-collection').appendChild(row);
    }
    if (!store.items.length) {
      const empty = document.createElement('li'); empty.textContent = 'Your collection is ready for its first piece.';
      el('work-collection').appendChild(empty);
    }
    const held = store.items.find(item => item.id === work.id);
    const saved = held && JSON.stringify(held) === JSON.stringify(canonical);
    el('keep-work').disabled = busy || !known || Boolean(held);
    el('keep-work').textContent = saved ? 'In your collection' : 'Keep this bloom';
    el('export-collection').disabled = busy || !store.items.length;
    el('confirm-import').disabled = busy || !pendingImport;
    el('import-collection').disabled = busy;
    el('cancel-import').disabled = busy;
    note('work-status', held && !saved ? 'A saved reference uses this ID with different details. Review it in your collection.'
      : saved ? 'Kept in this browser. Export a copy to bring it with you.'
      : 'Keep saves a reference in this browser. No account needed.');
    note('collection-status', message || (store.items.length ? store.items.length + ' saved in this browser.' : 'Nothing saved yet.'));
    if (focusId) {
      const rows = [...el('work-collection').children];
      const row = rows.find(item => item.dataset.collectionId === focusId) || rows[Math.min(Math.max(focusIndex, 0), rows.length - 1)];
      const button = row && row.querySelectorAll('button')[0];
      const target = button ? (button.disabled ? row.children[0] : button) : el('collection-status');
      target.setAttribute('tabindex', button && target === button ? '0' : '-1');
      target.focus({preventScroll:true});
    }
  }
  function clearImport(restoreFocus = document.activeElement === el('confirm-import') || document.activeElement === el('cancel-import')) {
    fileGeneration += 1;
    pendingImport = null;
    el('import-collection').value = '';
    el('import-preview').hidden = true;
    el('import-items').replaceChildren();
    el('confirm-import').disabled = true;
    if (restoreFocus) el('import-collection').focus();
  }
  async function change(action, id) {
    if (busy || (action === 'keep' && !known) || (action === 'import' && !pendingImport)) return;
    const importFocused = action === 'import' && document.activeElement === el('confirm-import');
    busy = true; refresh('Saving…');
    let message;
    let imported = false;
    try {
      if (action === 'keep') {
        // Refuse a pre-existing impostor record rather than treating its ID as
        // proof that the canonical work was already kept.
        const result = await later.importItems(localStorage, JSON.stringify({schema:later.SCHEMA,items:[canonical]}));
        message = result.added ? 'Genesis bloom is in your collection.' : 'Genesis bloom was already in your collection.';
      } else if (action === 'remove') {
        await later.removeItem(localStorage, id);
        message = 'Reference removed from this browser’s collection.';
      } else {
        const result = await later.importItems(localStorage, pendingImport);
        message = result.added + ' added; ' + result.already + ' already in your collection.';
        imported = true;
      }
    } catch (error) { message = errorText(error); }
    finally {
      busy = false; refresh(message);
      if (imported) clearImport(importFocused && (document.activeElement === el('confirm-import') || document.activeElement === document.body));
    }
  }
  function chooseWork() {
    known = work.resolveHash(location.hash) === work.id;
    el('work-content').hidden = !known;
    el('unknown-work').hidden = known;
    if (location.hash === '#share') el('share').open = true;
    refresh();
  }
  el('keep-work').addEventListener('click', () => change('keep'));
  el('confirm-import').addEventListener('click', () => change('import'));
  el('cancel-import').addEventListener('click', () => { if (!busy) { clearImport(); refresh('Import cancelled. Your collection is unchanged.'); } });
  window.addEventListener('hashchange', chooseWork);
  window.addEventListener('storage', event => { if (event.key === later.STORE || event.key === null) refresh(); });
  el('share-link').value = localLink;
  el('show-share').addEventListener('click', event => {
    event.preventDefault(); el('share').open = true; el('share-link').focus(); el('share-link').select();
  });
  const previewHost = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  if (previewHost) note('share-status', 'This preview link works on this machine. A public link follows release.');
  el('copy-link').addEventListener('click', async () => {
    const generation = ++shareGeneration;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(localLink);
      if (generation !== shareGeneration) return;
      note('share-status', previewHost ? 'Preview link copied. It opens on this machine.' : 'Link copied. The maker credit stays with the bloom.');
    } catch (_) {
      if (generation !== shareGeneration) return;
      el('share-link').focus(); el('share-link').select();
      note('share-status', 'Copy was unavailable. The link is selected so you can copy it yourself.');
    }
  });
  if (typeof navigator.share === 'function') {
    el('native-share').hidden = false;
    el('native-share').addEventListener('click', async () => {
      const generation = ++shareGeneration;
      try {
        await navigator.share({title:canonical.title + ' — ' + canonical.artist, text:'A little color to keep.', url:localLink});
        if (generation === shareGeneration) note('share-status', 'Share action completed. Only the recipient can choose to Keep.');
      } catch (error) {
        if (generation === shareGeneration) note('share-status', error.name === 'AbortError' ? 'Sharing cancelled.' : 'Sharing was unavailable. You can copy the link instead.');
      }
    });
  }
  el('import-collection').addEventListener('change', async () => {
    if (busy) return;
    const generation = ++fileGeneration;
    pendingImport = null; el('import-preview').hidden = true; el('confirm-import').disabled = true;
    const file = el('import-collection').files && el('import-collection').files[0];
    if (!file) return;
    try {
      if (file.size > 3000000) throw Object.assign(new Error('file-too-large'), {code:'invalid-entry'});
      const text = await file.text();
      if (generation !== fileGeneration) return;
      const preview = later.previewImport(text);
      for (const item of preview.items) {
        if (item.id === work.id && JSON.stringify(item) !== JSON.stringify(canonical)) {
          throw Object.assign(new Error('known-work-conflict'), {code:'conflicting-entry'});
        }
      }
      el('import-items').replaceChildren();
      for (const item of preview.items) {
        const row = document.createElement('li'); row.textContent = entryText(item); el('import-items').appendChild(row);
      }
      pendingImport = preview.items.length ? text : null;
      el('import-preview').hidden = false;
      refresh(preview.items.length ? 'Check the references, then choose Add. Nothing has been saved yet.' : 'This file has no references to add.');
    } catch (error) {
      if (generation === fileGeneration) { pendingImport = null; refresh(errorText(error)); }
    }
  });
  el('export-collection').addEventListener('click', () => {
    if (busy) return;
    try {
      const data = Object.assign({exportedAt:new Date().toISOString()}, later.exportPublic(later.readStore(localStorage)));
      const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'bnr-listen-later.json';
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
      note('collection-status', 'Download requested. Keep bnr-listen-later.json to restore your references in another browser.');
    } catch (_) { note('collection-status', 'Export could not start. Your collection is unchanged.'); }
  });
  function applyMotion() {
    if (bloom) bloom.classList.toggle('is-paused', paused || reduced.matches || document.hidden);
    el('bloom-pause').disabled = !bloom || reduced.matches;
    el('bloom-pause').textContent = reduced.matches ? 'Motion reduced' : paused ? 'Play motion' : 'Pause motion';
    el('bloom-pause').setAttribute('aria-pressed', String(paused || reduced.matches));
  }
  function loadBloom() {
    try { bloom = el('work-bloom').contentDocument && el('work-bloom').contentDocument.documentElement; }
    catch (_) { bloom = null; }
    if (!bloom || bloom.localName !== 'svg') bloom = null;
    applyMotion();
  }
  el('work-bloom').addEventListener('load', loadBloom);
  el('bloom-pause').addEventListener('click', () => { if (bloom && !reduced.matches) { paused = !paused; applyMotion(); } });
  reduced.addEventListener('change', () => { if (reduced.matches) paused = true; applyMotion(); });
  document.addEventListener('visibilitychange', () => { applyMotion(); if (!document.hidden) refresh(); });
  window.addEventListener('pagehide', () => { fileGeneration += 1; shareGeneration += 1; });
  loadBloom(); chooseWork();
})();
