-- migrate_chronicle.sql  (Phase 2 — one-time import of data/chronicle.json)
-- Generated from the 11 live entries. Run ONCE in the Supabase SQL editor,
-- AFTER schema_delta_chronicle_unify.sql. Re-running is guarded: it aborts
-- if any migrated rows (meta->>'legacy_id') already exist.
--
-- Mapping: text->body, author->actor_name, timestamp->created_at, display
-- fields->meta, original id->meta.legacy_id (export round-trips it).
-- 'Tyros' entries migrate as Cosmere (rename; original kept in meta.legacy_author).
-- author_id is recovered live via profiles.character_key; DM rows stay null
-- (staff edit via is_staff() regardless).

do $$
begin
  if exists (select 1 from public.feed where meta ? 'legacy_id') then
    raise exception 'chronicle migration already ran (legacy_id rows present)';
  end if;
end $$;

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-27T05:13:44.312Z$mig$::timestamptz, 2, 'chronicle', 'message', $mig$vesperian$mig$, $mig$Vesperian$mig$, (select user_id from public.profiles where character_key = 'vesperian'),
  $mig$<p>We make it to a darker forest about 2 days into our travels. The military is split on staying in the forest or getting to the outskirts. <span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="cosmere">Cosmere Runestar</span> tried to talk to the commander, but he was a racist and would not listen. <span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="liadan">Líadan Luchóg</span> is trying to persuade them by scaring them with a ghost story.</p><p><br></p><blockquote><span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="cosmere">Cosmere Runestar</span> Felt some negative kind of energy nearby.</blockquote><p><br></p><p>We get ambushed by a battalion of Gobbos. First combat!!! </p>$mig$,
  array[$mig$cosmere$mig$,$mig$liadan$mig$]::text[], $mig${"legacy_id": "1779858824312", "character": "Fighter", "color": "#5a9aaa"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-27T04:21:17.601Z$mig$::timestamptz, 2, 'chronicle', 'message', $mig$vesperian$mig$, $mig$Vesperian$mig$, (select user_id from public.profiles where character_key = 'vesperian'),
  $mig$<p>We take off with a contingent of travelers and military officers that <span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="caim">Caim</span> is associated with. We have a few days travel to the waypoint.</p><p><br></p><p><span style="color: rgb(122, 154, 170);" data-mention-type="location-unresolved" data-mention-key="verens watch">Verens Watch</span> was once upon a time a major trade checkpoint and way-station. It has fallen into disrepair as trade has waned due to political strife.</p>$mig$,
  array[$mig$caim$mig$]::text[], $mig${"legacy_id": "1779855677601", "character": "Fighter", "color": "#5a9aaa", "location": "Mortain", "sessionTitle": "The Journey Into Kirtas"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T06:00:19.783Z$mig$::timestamptz, 1, 'chronicle', 'message', $mig$vesperian$mig$, $mig$Vesperian$mig$, (select user_id from public.profiles where character_key = 'vesperian'),
  $mig$<p><span style="color: rgb(138, 180, 201);">Veren's Watch </span></p><p><br></p><p>A Kirtasian fort that we don't know much about. We don't know if it's occupied. </p><p><br></p><p>So in summary, we have all met at the Gold leaf Tavern in the town of Morain and we're deciding to venture north and decide if we're going to the mountains or the coast. Not totally committed but leaning towards mountains, we had the mouse laying do their first performance was successful and got six silver pieces we have yeah they all enjoyed it thoroughly all right. And then we've also met the teething. Everybody's together the first step to making us all famous is going well. The Mousketeers</p>$mig$,
  null, $mig${"legacy_id": "1779256819783", "character": "Fighter", "color": "#5a9aaa"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T05:38:00.442Z$mig$::timestamptz, 1, 'chronicle', 'message', null, $mig$DM$mig$, null,
  $mig$<p><img src="https://i.imgur.com/Y7nokce.png"></p>$mig$,
  null, $mig${"legacy_id": "1779255480442", "character": "Narrator", "color": "#b8952a", "sessionTitle": "Northern Numior extends to the Kharak Mountains and Kirtas beyond"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T05:31:17.369Z$mig$::timestamptz, 1, 'chronicle', 'message', $mig$vesperian$mig$, $mig$Vesperian$mig$, (select user_id from public.profiles where character_key = 'vesperian'),
  $mig$<p>We are in the tavern called <span style="color: rgb(122, 154, 170);" data-mention-type="location-unresolved" data-mention-key="goldleaf">Goldleaf</span> </p><p><br></p><p><span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="caim">Caim</span> managed to talk his way inside. <span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="liadan">Líadan Luchóg</span> managed to sneak in. Cosmere and <span style="color: rgb(212, 172, 58);" data-mention-type="npc" data-mention-key="vesperian">Vesperian Vale</span> were already inside. </p><p><br></p><p><br></p><p><br></p><p><br></p>$mig$,
  array[$mig$caim$mig$,$mig$liadan$mig$,$mig$vesperian$mig$]::text[], $mig${"legacy_id": "1779255077369", "character": "Fighter", "color": "#5a9aaa"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T05:26:49.614Z$mig$::timestamptz, 1, 'chronicle', 'message', null, $mig$DM$mig$, null,
  $mig$<p><span style="color: rgb(122, 154, 170);" data-mention-type="location-unresolved" data-mention-key="goldleaftavern">Goldleaftavern</span> <span class="ql-cursor">﻿</span><img src="https://i.imgur.com/X5TAJK0.png"></p>$mig$,
  null, $mig${"legacy_id": "1779254809614", "character": "Narrator", "color": "#b8952a"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T04:49:18.767Z$mig$::timestamptz, 1, 'chronicle', 'message', null, $mig$DM$mig$, null,
  $mig$<p><img src="https://i.imgur.com/3sIiMIl.png"></p>$mig$,
  null, $mig${"legacy_id": "1779252558767", "character": "Narrator", "color": "#b8952a"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T04:25:00.776Z$mig$::timestamptz, 1, 'chronicle', 'message', null, $mig$DM$mig$, null,
  $mig$<p>Kirtas is a grey-zone. Not a huge amount of information. </p><p><br></p><p><span style="color: rgb(138, 180, 201);" data-mention-type="location" data-mention-key="tiersgard">Tiersgard</span> has trade with military forces, and water trade. However, land trading is not really happening. </p><p><br></p>$mig$,
  array[$mig$tiersgard$mig$]::text[], $mig${"legacy_id": "1779251100776", "character": "Narrator", "color": "#b8952a"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T03:58:09.224Z$mig$::timestamptz, 1, 'chronicle', 'message', $mig$cosmere$mig$, $mig$Cosmere$mig$, (select user_id from public.profiles where character_key = 'cosmere'),
  $mig$<p>A little history of Caim: </p><p><br></p><p>Caim joined a monastic order with all that's been going on. Spent a couple decades learning about  healing and then also for putting those that are a very wounded out of out of their misery as well. It's also a part of that about mercy so I would imagine if we're in Mortain now these the kingdom of <span style="color: #8ab4c9" data-mention-type="location" data-mention-key="numior">Numior</span> or I guess there's rumbling that like they are meaning to potentially move towards like an attack you know they're like take advantage of the fact that <span style="color: rgb(138, 180, 201);">Kirtas</span> is every weekend so whether there is like a battle force coming or like kind of like to see what's going on I've been sent to the mountain pass to investigate</p>$mig$,
  array[$mig$numior$mig$]::text[], $mig${"legacy_id": "1779249489224", "character": "Warlock", "color": "#c05060", "legacy_author": "Tyros"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-20T03:37:04.581Z$mig$::timestamptz, 1, 'chronicle', 'message', null, $mig$DM$mig$, null,
  $mig$<p>Locations: </p><p><br></p><p><span style="color: rgb(138, 180, 201);">Mortain</span> </p><p><br></p><p>The most significant settlement in Northern Numior, Mortain was for many years an administrative center due to its proximity to Kirtas via the mountain passes and, more circuitously, the Coast Road. With the coming of the civil war and corresponding withdrawal of Kirtasian military and administrative personnel the town fell into rapid decline and irrelevancy.&nbsp;This state of affairs perpetuated for over a decade and the rolling plains and woodlands extending from the town north to the Kharak range returned mostly to a state of wilderness.&nbsp;Smallholder farms surrounding the immediate area of the town supported a local market, a few artisans and a sense of independence, hardihood and overall pride in self-reliance among the populace. </p><p><br></p><p>As the war dragged on Mortain began to grow in prominence again in conjunction with the rise of mercenary bands.&nbsp;As the last stop for groups headed into the beleaguered kingdom the town became an ad-hoc military depot and outfitting center. Those aspiring to fight from throughout Numior would make their way individually, in small groups or even as whole companies to Mortain to prepare for the journey over the mountains and glory beyond.&nbsp;Farmers and artisans grew prosperous providing supplies and equipment to these groups and the farmland expanded into large areas around the town. While Northern Numior remains remains a backwater with the decline of trade and civilian travel to Kirtas, Mortain stands out as a relatively cosmopolitan and prosperous settlement that has been fortunate to reap the benefits of a comfortably distant catastrophe.</p>$mig$,
  null, $mig${"legacy_id": "1779248224581", "character": "Narrator", "color": "#b8952a", "location": "Mortain"}$mig$::jsonb, false);

insert into public.feed (created_at, session, channel, kind, actor_key, actor_name, author_id, body, tags, meta, hidden)
values ($mig$2026-05-18T06:45:59.727Z$mig$::timestamptz, 0, 'chronicle', 'message', $mig$liadan$mig$, $mig$Líadan$mig$, (select user_id from public.profiles where character_key = 'liadan'),
  $mig$Bish, I'm a mouse. I just say "squeak".$mig$,
  null, $mig${"legacy_id": "1779086759727", "character": "Bard", "color": "#5a9a6a"}$mig$::jsonb, false);

-- Seed the live session counter from the JSON config.
update public.campaign set current_session = 2, updated_at = now() where id = 1;
