/* The directory searches published text only. No network or identity needed. */
(() => {
'use strict';
const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function createSearch(query, family = '') {
  return { terms: normalize(query).trim().split(/\s+/u).filter(Boolean), family };
}

function matchesSearch(record, search) {
  if (search.family && record.family !== search.family) return false;
  const words = normalize(record.text);
  return search.terms.every(term => words.includes(term));
}
const api = Object.freeze({ createSearch, matchesSearch });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else window.BNRAtlasSearch = api;
})();
