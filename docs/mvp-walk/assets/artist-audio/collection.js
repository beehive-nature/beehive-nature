'use strict';
/* Local credited links, never media or signing material. Mutations use an
   exclusive Web Lock shared by cooperating tabs; unsupported browsers stay
   read/export-only. Validation constrains fields and links, but cannot certify
   that arbitrary artist-supplied prose contains no private information. */
(function (root) {
  const STORE = 'bnr-listen-later';
  const SCHEMA = 'bnr-listen-later/1';
  const LOCK = STORE + ':mutation';
  const MAX_ITEMS = 100;
  const MAX_TEXT = 1000000;
  const ITEM_KEYS = ['id', 'title', 'artist', 'rights', 'fixture', 'fixtureNote', 'medium', 'links'];
  const SENSITIVE = /token|secret|password|passwd|passcode|credential|authorization|auth|signature|apikey|privatekey|session|jwt|nsec|wallet|privatepath|localpath/;

  function failure(code, phase) {
    const error = new Error(code);
    error.code = code;
    if (phase) error.phase = phase;
    return error;
  }

  function record(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(function (key) { return !keys.includes(key); })) {
      throw failure('invalid-entry');
    }
  }

  function scalar(value, max, allowEmpty) {
    if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()) ||
        /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw failure('invalid-entry');
    return value;
  }

  function publicURL(value) {
    scalar(value, 2048, false);
    if (value !== value.trim() || /\s|\\/.test(value)) throw failure('invalid-entry');
    let url;
    try { url = new URL(value); } catch (_) { throw failure('invalid-entry'); }
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') ||
        /(^|\.)(localhost|local|localdomain|lan|home|internal|intranet|test|invalid)$/.test(host)) {
      throw failure('invalid-entry');
    }
    for (const [key, data] of url.searchParams) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE.test(normalized) || normalized === 'key' || normalized === 'sig' ||
          /[\u0000-\u001f\u007f-\u009f]/.test(key + data) ||
          /(?:nsec1|bearer\s|file:|[a-z]:[\\/])/i.test(data)) throw failure('invalid-entry');
    }
    if (url.hash) {
      let fragment;
      try { fragment = decodeURIComponent(url.hash.slice(1)); } catch (_) { throw failure('invalid-entry'); }
      if (!/^[a-z][a-z0-9_-]{0,79}$/i.test(fragment) ||
          SENSITIVE.test(fragment.toLowerCase().replace(/[^a-z0-9]/g, ''))) throw failure('invalid-entry');
    }
    // Public YouTube share/watch references become one stable watch URL. Only
    // recognized navigation/tracking parameters are eligible for this rewrite.
    const youtube = /^(www\.|m\.|music\.)?youtube\.com$/.test(host);
    if ((youtube && url.pathname === '/watch') || host === 'youtu.be') {
      const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
      const allowed = ['v', 't', 'start', 'end', 'list', 'index', 'si', 'feature'];
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '') ||
          [...url.searchParams.keys()].some(function (key) { return !allowed.includes(key); })) {
        throw failure('invalid-entry');
      }
      return 'https://www.youtube.com/watch?v=' + id;
    }
    return url.href;
  }

  function publicItem(entry) {
    record(entry, ITEM_KEYS);
    if (typeof entry.fixture !== 'boolean' || !Array.isArray(entry.links) || entry.links.length > 8) {
      throw failure('invalid-entry');
    }
    return {
      id: scalar(entry.id, 160, false),
      title: scalar(entry.title, 300, false),
      artist: scalar(entry.artist, 300, false),
      rights: scalar(entry.rights, 160, false),
      fixture: entry.fixture,
      fixtureNote: scalar(entry.fixtureNote === undefined ? '' : entry.fixtureNote, 1000, true),
      medium: scalar(entry.medium === undefined ? 'audio' : entry.medium, 32, false),
      links: Array.from(entry.links, function (link) {
        record(link, ['name', 'kind', 'url']);
        if (link.kind !== 'external') throw failure('invalid-entry');
        return { name: scalar(link.name, 120, false), kind: 'external', url: publicURL(link.url) };
      })
    };
  }

  function validatedStore(store) {
    record(store, ['schema', 'items']);
    if (store.schema !== SCHEMA || !Array.isArray(store.items) || store.items.length > MAX_ITEMS) {
      throw failure('invalid-entry');
    }
    const items = Array.from(store.items, publicItem);
    if (new Set(items.map(function (item) { return item.id; })).size !== items.length) {
      throw failure('invalid-entry');
    }
    return { schema: SCHEMA, items: items };
  }

  function parseStore(raw) {
    if (raw === null) return { schema: SCHEMA, items: [] };
    try {
      if (typeof raw !== 'string' || raw.length > MAX_TEXT) throw failure('invalid-entry');
      return validatedStore(JSON.parse(raw));
    } catch (_) { throw failure('unreadable', 'read'); }
  }

  function readStore(storage) {
    let raw;
    try { raw = storage.getItem(STORE); }
    catch (_) { throw failure('storage-denied', 'read'); }
    return parseStore(raw);
  }

  function writeStore(storage, next) {
    const text = JSON.stringify(next);
    if (text.length > MAX_TEXT) throw failure('collection-full');
    try { storage.setItem(STORE, text); }
    catch (_) { throw failure('storage-denied', 'write'); }
    // A successful set can precede loss of read access or an uncooperative
    // writer. Never call this outcome unchanged, and never restore stale data.
    let check;
    try { check = storage.getItem(STORE); }
    catch (_) { throw failure('uncertain-write', 'verify'); }
    if (check !== text) throw failure('uncertain-write', 'verify');
  }

  async function mutation(options, action) {
    const locks = options && Object.prototype.hasOwnProperty.call(options, 'locks')
      ? options.locks : root.navigator && root.navigator.locks;
    if (!locks || typeof locks.request !== 'function') throw failure('locking-unavailable', 'lock');
    let entered = false;
    try {
      return await locks.request(LOCK, { mode: 'exclusive' }, function () {
        entered = true;
        return action();
      });
    } catch (error) {
      if (!entered) throw failure('locking-unavailable', 'lock');
      throw error;
    }
  }

  async function saveItem(storage, entry, options) {
    const candidate = publicItem(entry);
    return mutation(options, function () {
      const before = readStore(storage);
      if (before.items.some(function (item) { return item.id === candidate.id; })) {
        return { store: before, saved: false, already: true };
      }
      if (before.items.length >= MAX_ITEMS) throw failure('collection-full');
      const next = { schema: SCHEMA, items: before.items.concat([candidate]) };
      writeStore(storage, next);
      return { store: next, saved: true, already: false };
    });
  }

  async function removeItem(storage, id, options) {
    scalar(id, 160, false);
    return mutation(options, function () {
      const before = readStore(storage);
      const next = { schema: SCHEMA, items: before.items.filter(function (item) { return item.id !== id; }) };
      if (next.items.length !== before.items.length) writeStore(storage, next);
      return next;
    });
  }

  function exportPublic(store) {
    const valid = validatedStore(store);
    return {
      schema: SCHEMA,
      note: 'Credited links, not a media download. Not JAMS-compatible. Check artist-supplied text before sharing; validation cannot detect every private detail.',
      items: valid.items
    };
  }

  root.BNRListenLater = {
    STORE: STORE,
    SCHEMA: SCHEMA,
    MAX_ITEMS: MAX_ITEMS,
    publicItem: publicItem,
    readStore: readStore,
    saveItem: saveItem,
    removeItem: removeItem,
    exportPublic: exportPublic
  };
})(typeof window !== 'undefined' ? window : globalThis);
