'use strict';
(function (root) {
  const id = 'bnr-genesis-bloom-v1';
  const record = Object.freeze({
    id: id,
    title: 'Genesis bloom',
    artist: 'LoVis and his mother',
    rights: 'Creator-supplied original; no additional licence granted',
    fixture: false,
    fixtureNote: '',
    medium: 'visual-art',
    links: Object.freeze([Object.freeze({
      name: 'View Genesis bloom', kind: 'external',
      url: 'https://skaists.dev/docs/mvp-walk/first-work.html'
    })])
  });
  function resolveHash(hash) {
    if (['', '#', '#work-content', '#makers', '#collection', '#share'].includes(hash)) return id;
    if (hash.length > 200 || !hash.startsWith('#work=')) return null;
    const params = new URLSearchParams(hash.slice(1));
    return [...params].length === 1 && params.get('work') === id ? id : null;
  }
  function shareURL(pageURL) {
    const url = new URL(pageURL);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid-page');
    url.search = '';
    url.hash = 'work=' + id;
    return url.href;
  }
  root.BNRFirstWork = Object.freeze({ id: id, record: record, resolveHash: resolveHash, shareURL: shareURL });
})(typeof window !== 'undefined' ? window : globalThis);
