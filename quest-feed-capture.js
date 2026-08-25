// Pure helpers for the guarded Chronicle Feed /quest capture. The page owns
// the Quill and Supabase seams; these rules stay shared with the Node smoke.
(function questFeedCaptureModule(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuestFeedCapture = api;
})(typeof window !== 'undefined' ? window : globalThis, function questFeedCaptureFactory() {
  const COMMAND = 'quest';
  const DESCRIPTION_PREFIX = 'tok-quest-rich-v1:';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textParagraph(value) {
    return { type: 'paragraph', content: value ? [{ type: 'text', text: String(value) }] : [] };
  }

  function normalizeInline(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'text') {
      const text = String(node.text || '');
      return text ? { type: 'text', text } : null;
    }
    if (node.type === 'hardBreak') return { type: 'hardBreak' };
    if (node.type !== 'tokMention') return null;
    const attrs = node.attrs || {};
    const type = attrs.type === 'npc' || attrs.type === 'location' ? attrs.type : '';
    const label = String(attrs.label || '').trim();
    if (!type || !label) return null;
    return {
      type: 'tokMention',
      attrs: {
        type,
        key: String(attrs.key || attrs.id || '').trim(),
        label,
        resolved: Boolean(attrs.resolved),
      },
    };
  }

  function normalizeDoc(value) {
    const source = value && typeof value === 'object' && value.type === 'doc' ? value : null;
    const paragraphs = (source?.content || [])
      .filter(node => node && node.type === 'paragraph')
      .map(node => ({
        type: 'paragraph',
        content: (node.content || []).map(normalizeInline).filter(Boolean),
      }));
    return { type: 'doc', content: paragraphs.length ? paragraphs : [textParagraph('')] };
  }

  function descriptionDoc(value) {
    if (value && typeof value === 'object') return normalizeDoc(value);
    const raw = String(value || '');
    if (raw.startsWith(DESCRIPTION_PREFIX)) {
      try { return normalizeDoc(JSON.parse(raw.slice(DESCRIPTION_PREFIX.length))); }
      catch (_) { return { type: 'doc', content: [textParagraph(raw)] }; }
    }
    return {
      type: 'doc',
      content: raw.split(/\r?\n/).map(textParagraph),
    };
  }

  function encodeDescription(value) {
    return DESCRIPTION_PREFIX + JSON.stringify(descriptionDoc(value));
  }

  function descriptionText(value) {
    return descriptionDoc(value).content.map(paragraph => (
      (paragraph.content || []).map(node => (
        node.type === 'tokMention' ? `@${node.attrs.label}` : node.type === 'hardBreak' ? '\n' : node.text
      )).join('')
    )).join('\n');
  }

  function descriptionHTML(value) {
    return descriptionDoc(value).content.map(paragraph => (
      (paragraph.content || []).map(node => {
        if (node.type === 'text') return esc(node.text);
        if (node.type === 'hardBreak') return '<br>';
        const attrs = node.attrs || {};
        const label = `@${attrs.label}`;
        if (!attrs.resolved || !attrs.key) {
          return `<span class="quest-description-mention is-unresolved" title="Mention not linked">${esc(label)}</span>`;
        }
        const data = attrs.type === 'npc' ? 'data-npc' : 'data-location';
        return `<span class="quest-description-mention ${attrs.type}-link" ${data}="${esc(attrs.key)}" tabindex="0">${esc(label)}</span>`;
      }).join('')
    )).join('<br>');
  }

  function isEnabled(search) {
    return new URLSearchParams(String(search || '')).get('questCapture') === '1';
  }

  function isRailEnabled(search) {
    return new URLSearchParams(String(search || '')).get('questCapture') !== '0';
  }

  function commandQuery(text, cursor) {
    const before = String(text || '').slice(0, Number(cursor) || 0);
    const match = before.match(/(?:^|\s)\/([a-z]*)$/i);
    if (!match) return null;
    const query = match[1].toLowerCase();
    if (!COMMAND.startsWith(query)) return null;
    const index = before.length - query.length - 1;
    return { index, length: query.length + 1, query, exact: query === COMMAND };
  }

  function descriptionSeed(text, commandIndex) {
    const prose = String(text || '').slice(0, Math.max(0, Number(commandIndex) || 0));
    const lines = prose.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return lines.length ? lines[lines.length - 1] : '';
  }

  function questTitle(title, objective) {
    const named = String(title || '').trim();
    if (named) return named;
    const task = String(objective || '').trim().replace(/[.!?]+$/, '');
    if (task.length <= 80) return task;
    const cut = task.slice(0, 80);
    const space = cut.lastIndexOf(' ');
    return (space > 48 ? cut.slice(0, space) : cut) + '…';
  }

  function selectedEntity(items, id) {
    return (items || []).find(item => String(item.key) === String(id)) || null;
  }

  function requestId(cryptoApi) {
    const api = cryptoApi || (typeof crypto !== 'undefined' ? crypto : null);
    if (api && typeof api.randomUUID === 'function') return api.randomUUID();
    const bytes = new Uint8Array(16);
    if (api && typeof api.getRandomValues === 'function') api.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  function rpcPayload(input) {
    return {
      p_request_id: input.requestId,
      p_title: input.title,
      p_description: input.description,
      p_objective: input.objective,
      p_giver_id: input.giverId || null,
      p_giver_label: input.giverLabel || null,
      p_location_id: input.locationId || null,
      p_location_label: input.locationLabel || null,
      p_origin: 'chronicle',
      p_source_feed_post_id: input.sourceFeedPostId,
      p_source_journal_page_id: null,
    };
  }

  return {
    isEnabled,
    isRailEnabled,
    commandQuery,
    descriptionSeed,
    questTitle,
    selectedEntity,
    requestId,
    rpcPayload,
    descriptionDoc,
    encodeDescription,
    descriptionText,
    descriptionHTML,
  };
});
