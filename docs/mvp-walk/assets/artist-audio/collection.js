'use strict';
/* Local listen-later collection. Public credit + public links only.
   No media download, no local paths, no wallet, no storage addresses. */
(function (root) {
  const STORE = 'bnr-listen-later';
  const SCHEMA = 'bnr-listen-later/1';

  function publicItem(entry) {
    return {
      id: entry.id,
      title: entry.title,
      artist: entry.artist,
      rights: entry.rights,
      fixture: !!entry.fixture,
      fixtureNote: entry.fixtureNote || '',
      medium: entry.medium || 'audio',
      links: (entry.links || []).filter(function (link) {
        return link && link.kind === 'external' && /^https:\/\//i.test(link.url || '') && !/^javascript:/i.test(link.url);
      }).map(function (link) {
        return { name: String(link.name), kind: 'external', url: String(link.url) };
      })
    };
  }

  function emptyStore() {
    return { schema: SCHEMA, items: [] };
  }

  function parseStore(raw) {
    if (raw == null) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schema !== SCHEMA || !Array.isArray(parsed.items)) {
      const error = new Error('unreadable');
      error.code = 'unreadable';
      throw error;
    }
    return { schema: SCHEMA, items: parsed.items.map(publicItem) };
  }

  function readStore(storage) {
    try {
      return parseStore(storage.getItem(STORE));
    } catch (error) {
      if (error && error.code === 'unreadable') throw error;
      const denied = new Error('storage-denied');
      denied.code = 'storage-denied';
      throw denied;
    }
  }

  function writeStore(storage, next) {
    const text = JSON.stringify(next);
    storage.setItem(STORE, text);
    const check = storage.getItem(STORE);
    if (check !== text) {
      const denied = new Error('storage-denied');
      denied.code = 'storage-denied';
      throw denied;
    }
  }

  function saveItem(storage, entry) {
    const before = readStore(storage);
    if (before.items.some(function (item) { return item.id === entry.id; })) {
      return { store: before, saved: false, already: true };
    }
    const next = { schema: SCHEMA, items: before.items.concat([publicItem(entry)]) };
    writeStore(storage, next);
    return { store: next, saved: true, already: false };
  }

  function removeItem(storage, id) {
    const before = readStore(storage);
    const next = { schema: SCHEMA, items: before.items.filter(function (item) { return item.id !== id; }) };
    writeStore(storage, next);
    return next;
  }

  function exportPublic(store) {
    return {
      schema: SCHEMA,
      note: 'Public credit and explicitly selected public links only. Not JAMS-compatible. Not a media download.',
      items: (store.items || []).map(publicItem)
    };
  }

  root.BNRListenLater = {
    STORE: STORE,
    SCHEMA: SCHEMA,
    publicItem: publicItem,
    readStore: readStore,
    writeStore: writeStore,
    saveItem: saveItem,
    removeItem: removeItem,
    exportPublic: exportPublic
  };
})(typeof window !== 'undefined' ? window : globalThis);
