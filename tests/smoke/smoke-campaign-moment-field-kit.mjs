import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function ok(condition, label) {
  if (condition) passed += 1;
  else { failed += 1; console.log('  FAIL: ' + label); }
}
function read(path) { return readFileSync(new URL(path, import.meta.url), 'utf8'); }
function executable(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:''|[^'])*'/g, "''");
}

const preflight = read('../../docs/guides/CAMPAIGN-MOMENT-PREFLIGHT.sql');
const resolver = read('../../docs/guides/CAMPAIGN-MOMENT-IDENTITY-RESOLVER.sql');
const guide = read('../../docs/guides/CAMPAIGN-MOMENT-FIELD-PASS.md');

ok(/READ ONLY/i.test(preflight), 'prerequisite probe declares its read-only boundary');
ok(!/\b(insert|update|delete|alter|drop|create|grant|revoke|truncate)\b/i.test(executable(preflight)), 'prerequisite probe contains no write statement');
for (const table of ['feed', 'journal_pages', 'encounters', 'scenes', 'forge_sessions', 'entities', 'item_events', 'item_instances']) {
  ok(preflight.includes(`('${table}')`), `preflight checks ${table}`);
}
ok(preflight.includes("('feed', 'id', 'int8')") && preflight.includes("('journal_pages', 'id', 'uuid')"), 'preflight checks feed and Journal identity types');
ok(preflight.includes("('scenes', 'id', 'uuid')") && preflight.includes("('forge_sessions', 'id', 'uuid')"), 'preflight checks both typed battle-map identities');
ok(preflight.includes("('is_member')") && preflight.includes("('is_staff')"), 'preflight checks both RLS helper functions');
ok(/blocked_partial_contract/.test(preflight) && /bool_or\(present\)/.test(preflight), 'preflight fails closed on a half-created campaign contract');
ok(/campaign_policies/.test(preflight) && /campaign_grants/.test(preflight) && /campaign_realtime/.test(preflight), 'post-apply probe returns security and realtime evidence');

ok(/READ ONLY/i.test(resolver), 'identity resolver declares its read-only boundary');
ok(!/\b(insert|update|delete|alter|drop|create|grant|revoke|truncate)\b/i.test(executable(resolver)), 'identity resolver contains no write statement');
ok(/journal_pages[\s\S]*shared_feed_id/.test(resolver), 'resolver exposes the Journal-to-feed identity seam');
ok(/encounters e[\s\S]*left join public\.scenes s on s\.key = e\.map_ref/.test(resolver), 'resolver proves legacy encounter map_ref against typed scene identity');
ok(/forge_sessions/.test(resolver) && !/select[\s\S]{0,80}\bmap\b[\s\S]{0,40}from public\.forge_sessions/i.test(resolver), 'resolver lists Forge identities without dumping map documents');
ok(/item_events e[\s\S]*item_instances i/.test(resolver), 'resolver pairs permanent items with append-only event identities');
ok(/never update an old event/i.test(resolver), 'resolver narrates the append-only item-event boundary');

ok(/status = installed_review_security/.test(guide), 'runbook requires a post-apply contract check');
ok(/blocked_partial_contract/.test(guide), 'runbook stops on a partial live contract');
ok(/at most one of `scene_id` and `forge_session_id`/.test(guide), 'runbook preserves one typed battle-map authority');
ok(/Never UPDATE an old event/.test(guide), 'runbook forbids manufacturing an item-event link');
ok(/personal `data\/map-pins\.json` mark/.test(guide), 'runbook excludes personal World marks');
ok(/world\.html\?path=1/.test(guide) && /chronicle\.html\?campaignLinks=1/.test(guide) && /sheet-v2\.html\?character=/.test(guide), 'runbook covers all three guarded consumers');
ok(/player desktop\/mobile/.test(guide) && /staff desktop\/mobile/.test(guide), 'runbook requires the full audience and viewport matrix');
ok(/Keep the readers guarded if any cell fails/.test(guide), 'promotion remains fail-closed');

console.log(`\nsmoke-campaign-moment-field-kit: ${passed}/${passed + failed} passed${failed ? `  (${failed} FAILED)` : ''}`);
process.exit(failed ? 1 : 0);
