/* homebrew-races-smoke.js — validates the homebrew_races data module against a mock
 * Supabase client. Checks query construction (table, columns, ordering, filters),
 * the shaped return, the denormalized creator name, and the RLS-refusal error paths.
 *
 * Run from the repo root:  node homebrew-races-smoke.js
 */
const fs = require('fs');
const path = require('path');

// ── mock Supabase: a chainable, thenable query builder backed by an in-memory store ──
function makeStore() { return { rows: [], seq: 0, calls: [] }; }
function makeSb(store) {
  return {
    from(table) {
      const Q = { _t: table, _op: 'select', _sel: null, _row: null, _patch: null, _f: {}, _order: null };
      Q.select = function (c) { Q._sel = c; return Q; };
      Q.order = function (c, o) { Q._order = { c, o }; return Q; };
      Q.insert = function (r) { Q._op = 'insert'; Q._row = r; return Q; };
      Q.update = function (p) { Q._op = 'update'; Q._patch = p; return Q; };
      Q.delete = function () { Q._op = 'delete'; return Q; };
      Q.eq = function (c, v) { Q._f[c] = v; return Q; };
      Q.then = function (resolve) { resolve(run(Q, store)); };   // make the builder awaitable
      return Q;
    }
  };
}
function run(Q, store) {
  store.calls.push({ table: Q._t, op: Q._op, sel: Q._sel, order: Q._order, filters: Q._f, row: Q._row, patch: Q._patch });
  if (Q._t !== 'homebrew_races') return { data: null, error: { message: 'unexpected table ' + Q._t } };
  if (Q._op === 'select') { return { data: store.rows.slice(), error: null }; }
  if (Q._op === 'insert') {
    const row = Object.assign({ id: 'id-' + (++store.seq), created_by: 'me-uid', created_at: new Date().toISOString() }, Q._row);
    store.rows.unshift(row);
    return { data: [row], error: null };
  }
  if (Q._op === 'update') {
    const row = store.rows.find(r => r.id === Q._f.id);
    if (!row) return { data: [], error: null };        // RLS-refusal shape: row filtered out
    Object.assign(row, Q._patch);
    return { data: [row], error: null };
  }
  if (Q._op === 'delete') { store.rows = store.rows.filter(r => r.id !== Q._f.id); return { error: null }; }
  return { data: [], error: null };
}

// ── load the module under a faked window/__tok (fast-path awaitTok) ──
const store = makeStore();
global.window = { __tok: { ready: Promise.resolve({ role: 'player' }), profile: { displayName: 'hagakuredisc' }, sb: makeSb(store) } };
global.document = { addEventListener() {}, removeEventListener() {} };
eval(fs.readFileSync(path.join(__dirname, 'homebrew-races.js'), 'utf8'));
const HR = global.window.HomebrewRaces;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  \u2713 ' + n); } else { fail++; console.log('  \u2717 ' + n); } };

const model = { name: 'Mouseling', custom: true, size: 'Small', speed: { walk: 20, label: '20 ft.' }, darkvision: null, abilityBonuses: {}, traits: [{ name: 'Observant Prey', entries: ['…'], source: 'Mouseling' }] };

(async () => {
  console.log('A. module shape');
  ok('window.HomebrewRaces exposes list/save/update/remove', HR && ['list','save','update','remove'].every(k => typeof HR[k] === 'function'));

  console.log('B. save (insert)');
  const saved = await HR.save('Mouseling', model);
  ok('returns shaped row with id', saved && saved.id && saved.name === 'Mouseling');
  ok('model round-trips', saved.model && saved.model.size === 'Small');
  ok('createdByName denormalized from profile.displayName', saved.createdByName === 'hagakuredisc');
  const insertCall = store.calls.find(c => c.op === 'insert');
  ok('insert hit homebrew_races', insertCall && insertCall.table === 'homebrew_races');
  ok('insert payload carries name + model + created_by_name', !!(insertCall.row && insertCall.row.name === 'Mouseling' && insertCall.row.model && insertCall.row.created_by_name === 'hagakuredisc'));
  ok('insert does NOT send created_by (server default pins it)', !('created_by' in insertCall.row));
  ok('store grew to 1 row', store.rows.length === 1);

  console.log('C. list (select + order)');
  const rows = await HR.list();
  ok('returns 1 shaped row', rows.length === 1 && rows[0].name === 'Mouseling');
  const selCall = store.calls.find(c => c.op === 'select');
  ok('select columns include model + created_by_name', /model/.test(selCall.sel) && /created_by_name/.test(selCall.sel));
  ok('ordered by created_at desc', selCall.order && selCall.order.c === 'created_at' && selCall.order.o && selCall.order.o.ascending === false);

  console.log('D. update');
  const upd = await HR.update(saved.id, 'Mouseling (v2)', Object.assign({}, model, { darkvision: 60 }));
  ok('returns shaped row with new name', upd && upd.name === 'Mouseling (v2)');
  ok('store reflects the rename', store.rows[0].name === 'Mouseling (v2)');
  ok('store reflects model change (darkvision 60)', store.rows[0].model.darkvision === 60);
  const updCall = store.calls.find(c => c.op === 'update');
  ok('update filtered by id', updCall && updCall.filters.id === saved.id);

  console.log('E. RLS-refusal + validation error paths');
  let threw = false; try { await HR.update('does-not-exist', 'x', model); } catch (e) { threw = /Update blocked/.test(e.message); }
  ok('update on a non-owned/missing row throws "Update blocked"', threw);
  threw = false; try { await HR.save('', model); } catch (e) { threw = /name is required/.test(e.message); }
  ok('save("") rejects (name required)', threw);
  threw = false; try { await HR.save('X', null); } catch (e) { threw = /model must be/.test(e.message); }
  ok('save(name, null) rejects (model required)', threw);

  console.log('F. remove (delete)');
  await HR.remove(saved.id);
  ok('store back to 0 rows', store.rows.length === 0);
  const delCall = store.calls.find(c => c.op === 'delete');
  ok('delete filtered by id', delCall && delCall.filters.id === saved.id);

  console.log('\n' + pass + '/' + (pass + fail) + ' passed');
  process.exit(fail ? 1 : 0);
})();
