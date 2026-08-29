// i18n-extract.mjs — capture a keyed element's inner text, markup-aware.
// Born from the markup-swap lane: keyed paragraphs carry inline tags (links,
// emphasis), so the naive "text up to the first inner tag" capture cannot
// verify them. This walks to the element's true close with a tag-depth
// counter and returns the decoded, tag-stripped, space-collapsed text.
const VOID = /^(br|img|hr|input|meta|link|source)\b/i;

export function extractKeyedText(html, tagStart) {
  // tagStart = index of '<' that opens the keyed element
  const openEnd = html.indexOf('>', tagStart);
  if (openEnd === -1) return '';
  let i = openEnd + 1, depth = 1, out = '';
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { out += html.slice(i); break; }
    out += html.slice(i, lt);
    const gt = html.indexOf('>', lt);
    if (gt === -1) break;
    const tag = html.slice(lt, gt + 1);
    i = gt + 1;
    if (tag.startsWith('</')) { depth--; if (depth === 0) break; }
    else if (!tag.endsWith('/>') && !VOID.test(tag.slice(1))) depth++;
  }
  return out
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '\u201C')
    .replace(/\s+/g, ' ')
    .trim();
}
