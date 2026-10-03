/* blink.js — bLink: one small public record that says where a file lives and what to do with it.

   address (64 hex, the only thing the network knows) + a human name + an expected size + a type hint
   + the handler a surface should offer first: watch, view or download.

   THE LAWS THIS FILE KEEPS
   - a bLink is public by construction: everything in it is readable by anyone who holds the link. it
     has no field for a payment, a receipt, a sponsor or a person. spend receipts are private by default
     and do not ride in a link.
   - the address is the capability. name, size and type are LABELS the sender wrote; the network does
     not store them and nothing here treats them as verified. a surface compares the label with what
     the network answers and says so when they differ.
   - reads the link shape other Autonomi download buttons already publish (?a=<address>&n=<name>&s=<size>)
     as well as autonomi://<address> and a bare address, so one pasted link works everywhere.
   - writes the fragment form (#a=…): a fragment is not sent to the server that hosts the page.
   - no network, no wallet, no storage. parse and format only. */
(function (root) {
  'use strict';
  var ADAPTER = 'autonomi', HANDLERS = ['watch', 'view', 'download'], NAME_MAX = 200;
  var HEX64 = /^[0-9a-f]{64}$/;
  var WATCH = /\.(mp4|m4v|webm|mov|mkv|ogv|mp3|m4a|ogg|oga|opus|wav|flac)$/i;
  var VIEW = /\.(png|jpe?g|gif|webp|avif|svg|pdf|txt|md)$/i;

  function address(raw) {
    var m = /^\s*(?:autonomi:\/\/)?([0-9a-fA-F]{64})\s*$/.exec(raw == null ? '' : String(raw));
    return m ? m[1].toLowerCase() : null;
  }
  // A file name a person can read and a file system will take: no path separators, no control or
  // direction-override characters, no leading dots, no trailing dots or spaces.
  function cleanName(raw) {
    var s = String(raw == null ? '' : raw).normalize('NFC')
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, '')
      .trim().replace(/^\.+/, '').replace(/[. ]+$/, '');
    return Array.from(s).slice(0, NAME_MAX).join('').trim();
  }
  function cleanSize(raw) {
    if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
    if (typeof raw !== 'string' || !/^\d{1,16}$/.test(raw)) return null;
    var n = Number(raw); return Number.isSafeInteger(n) ? n : null;
  }
  function cleanType(raw) {
    var s = String(raw == null ? '' : raw).trim().toLowerCase();
    return /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/.test(s) ? s : '';
  }
  function fallbackName(a) { return 'autonomi-' + a.slice(0, 8) + '.bin'; }
  // The handler a surface offers first. An explicit, known choice wins; then the type; then the name.
  // With neither label the answer is null: the surface keeps its own default and nothing is guessed.
  function handlerFor(link) {
    if (HANDLERS.indexOf(link.handler) >= 0) return link.handler;
    var t = link.type || '';
    if (/^(video|audio)\//.test(t)) return 'watch';
    if (/^(image|text)\//.test(t) || t === 'application/pdf') return 'view';
    if (t) return 'download';
    if (!link.name) return null;
    return WATCH.test(link.name) ? 'watch' : VIEW.test(link.name) ? 'view' : 'download';
  }
  function build(a, p) {
    var link = { adapter: ADAPTER, address: a, name: cleanName(p.get('n')), size: cleanSize(p.get('s')), type: cleanType(p.get('t')), handler: null };
    var h = String(p.get('h') || '').toLowerCase();
    link.handler = handlerFor({ handler: h, type: link.type, name: link.name });
    return link;
  }
  var none = { get: function () { return null; } };
  /* parse(text) → a bLink, or null when no complete address is present.
     Takes: a bare address, autonomi://<address>, "a=…&n=…&s=…", or any URL carrying those in its
     query or its fragment (a fragment may also be the bare address, as bViEw links always were). */
  function parse(raw) {
    var text = String(raw == null ? '' : raw).trim();
    if (!text) return null;
    var a = address(text);
    if (a) return build(a, none);
    var parts = [], hash = text.indexOf('#'), query = text.indexOf('?');
    if (hash >= 0) parts.push(text.slice(hash + 1));
    if (query >= 0 && (hash < 0 || query < hash)) parts.push(text.slice(query + 1, hash < 0 ? text.length : hash));
    if (hash < 0 && query < 0) parts.push(text);
    for (var i = 0; i < parts.length; i++) {
      var bare = null;
      try { bare = address(decodeURIComponent(parts[i])); } catch (e) { bare = null; }
      if (bare) return build(bare, none);
      var p = new URLSearchParams(parts[i]);
      a = address(p.get('a'));
      if (a) return build(a, p);
    }
    return null;
  }
  function enc(s) { return encodeURIComponent(s).replace(/[()'!*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); }
  /* format(link, base) → base + '#a=…&n=…&s=…&t=…&h=…'. Throws on a link with no complete address:
     a link that cannot be followed is never written. Only labels that are present are written. */
  function format(link, base) {
    var a = address(link && link.address);
    if (!a) throw new Error('a bLink needs a complete 64-character address');
    var out = ['a=' + a], n = cleanName(link.name), s = cleanSize(link.size), t = cleanType(link.type);
    if (n) out.push('n=' + enc(n));
    if (s !== null) out.push('s=' + s);
    if (t) out.push('t=' + enc(t));
    // the handler is written only when it says something the type and the name do not already say
    if (HANDLERS.indexOf(link.handler) >= 0 && link.handler !== handlerFor({ type: t, name: n })) out.push('h=' + link.handler);
    return String(base == null ? '' : base).replace(/[#?].*$/, '') + '#' + out.join('&');
  }
  // What to call the file on disk: the sender's label, else the network's own name, else the address.
  function saveName(link, networkName) { return cleanName(link && link.name) || cleanName(networkName) || fallbackName(link.address); }

  var api = { parse: parse, format: format, address: address, cleanName: cleanName, handlerFor: handlerFor, saveName: saveName, ADAPTER: ADAPTER, HANDLERS: HANDLERS.slice() };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window === 'object') root.BLink = api;
})(typeof window === 'object' ? window : globalThis);
