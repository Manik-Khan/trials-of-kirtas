/* ════════════════════════════════════════════════════════════════════
   FEED-RENDER-V1 — shared Discord-style feed row renderer.

   Extracted from combat.html (Phase 3A) so the combat page's feed panel
   and the chronicle's server browser render rolls identically. This
   module OWNS the feed avatar art (single source of truth for the feed
   look); combat.html's PORTRAITS/TOKENS remain the authority for map
   tokens — a separate concern.

   Usage (both pages):
     const FR = FeedRender.create({
       characters: CHARACTERS,        // from characters.js — party detection
       canDelete:  row => bool,       // page policy; mirrors feed RLS
     });
     el.innerHTML = rows.map(FR.rowHtml).join('');

   Emits the same markup/classes as the original inline renderer:
   .feed-row  .feed-del  .feed-av  .feed-av-dm  .feed-av-i
   .feed-meta .feed-name .feed-text
   — pages provide the CSS (combat.html already has it; chronicle
   carries an adapted copy scoped to its combat panes).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }

  // Feed avatar art — portrait preferred, token fallback (same precedence
  // as the original inline renderer). Versionless + transform URLs, the
  // proven Cloudinary form on this account.
  const FEED_PORTRAITS = {
    cosmere:   'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833033/kirtas/characters/cosmere.png',
    caim:      'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833008/kirtas/characters/caim.png',
    liadan:    'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779732202/kirtas/portraits/liadan.png',
    vesperian: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1779833079/kirtas/characters/vesperian.png',
  };
  const FEED_TOKENS = {
    cosmere:   'https://res.cloudinary.com/df0tgoiyb/image/upload/w_400,q_auto,f_auto/kirtas/tokens/cosmere.png',
    caim:      'https://res.cloudinary.com/df0tgoiyb/image/upload/w_400,q_auto,f_auto/kirtas/tokens/caim.png',
    liadan:    'https://res.cloudinary.com/df0tgoiyb/image/upload/w_400,q_auto,f_auto/kirtas/tokens/liadan.png',
    vesperian: 'https://res.cloudinary.com/df0tgoiyb/image/upload/w_400,q_auto,f_auto/kirtas/tokens/vesperian.png',
  };

  function create(ctx) {
    ctx = ctx || {};
    const chars     = ctx.characters || (typeof CHARACTERS !== 'undefined' ? CHARACTERS : {});
    const portraits = ctx.portraits || FEED_PORTRAITS;
    const tokens    = ctx.tokens || FEED_TOKENS;
    const canDelete = typeof ctx.canDelete === 'function' ? ctx.canDelete : function () { return false; };

    function side(row) {
      if (!row.actor_key) return 'dm';
      return chars[row.actor_key] ? 'party' : 'enemy';
    }
    function nameColor(s) { return s === 'party' ? '#8fb0e0' : s === 'enemy' ? '#e0a08f' : 'var(--gold)'; }
    function time(ts) {
      try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
      catch (e) { return ''; }
    }
    function avatarHtml(row) {
      const s = side(row);
      const ring = s === 'party' ? '#4a6aa0' : s === 'enemy' ? '#a05a6a' : 'var(--gold)';
      const art = row.actor_key ? (portraits[row.actor_key] || tokens[row.actor_key] || '') : '';
      const inner = art
        ? `<img src="${art}" alt="" draggable="false" onerror="this.remove()" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : (s === 'dm' ? `<span class="feed-av-dm">◆</span>`
                      : `<span class="feed-av-i">${escapeHtml((row.actor_name || '?').trim().charAt(0).toUpperCase())}</span>`);
      return `<div class="feed-av" style="border-color:${ring}">${inner}</div>`;
    }
    function rowHtml(row) {
      const s = side(row);
      const tag = row.channel === 'chronicle' ? 'chronicle' : (row.kind === 'roll' ? 'roll' : row.kind);
      const hid = row.hidden ? ' · hidden' : '';
      const del = canDelete(row) ? `<button class="feed-del" data-del="${row.id}" title="Delete">✕</button>` : '';
      return `<div class="feed-row">${del}${avatarHtml(row)}<div style="min-width:0">`
        + `<div class="feed-meta"><span class="feed-name" style="color:${nameColor(s)}">${escapeHtml(row.actor_name)}</span> <span>· ${escapeHtml(tag)}${hid} · ${time(row.created_at)}</span></div>`
        + `<div class="feed-text">${row.body}</div></div></div>`;
    }

    return { side, nameColor, time, avatarHtml, rowHtml, escapeHtml, stripTags };
  }

  window.FeedRender = { create, escapeHtml, stripTags };
})();
