// Pure helpers for the guarded Chronicle Feed /quest capture. The page owns
// the Quill and Supabase seams; these rules stay shared with the Node smoke.
(function questFeedCaptureModule(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuestFeedCapture = api;
})(typeof window !== 'undefined' ? window : globalThis, function questFeedCaptureFactory() {
  const COMMAND = 'quest';

  function isEnabled(search) {
    return new URLSearchParams(String(search || '')).get('questCapture') === '1';
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

  return { isEnabled, commandQuery, descriptionSeed, questTitle, selectedEntity, requestId, rpcPayload };
});
