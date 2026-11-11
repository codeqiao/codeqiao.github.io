'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

test('点赞接口按页面计数并防止同一浏览器重复点赞', async t => {
  const { default: worker } = await import('../engagement/worker.mjs');
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(fs.readFileSync('engagement/schema.sql', 'utf8'));
  const env = {
    ALLOWED_ORIGIN: 'https://codeqiao.github.io',
    DB: { prepare(sql) {
      const statement = (...args) => ({
        async first() { return db.prepare(sql).get(...args); },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() { const result = db.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; }
      });
      return { ...statement(), bind: (...args) => statement(...args) };
    } }
  };
  const origin = { Origin: env.ALLOWED_ORIGIN };
  const path = '/games/guess/';
  const visitor = '123e4567-e89b-42d3-a456-426614174000';
  const send = () => worker.fetch(new Request('https://worker.example/likes', {
    method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ path, visitor })
  }), env);
  const first = await (await send()).json();
  const second = await (await send()).json();
  assert.deepEqual(first, { count: 1, added: true });
  assert.deepEqual(second, { count: 1, added: false });
  const query = await worker.fetch(new Request(`https://worker.example/likes?path=${encodeURIComponent(path)}`, { headers: origin }), env);
  assert.deepEqual(await query.json(), { count: 1 });
  const other = await worker.fetch(new Request('https://worker.example/likes?path=%2Ftools%2Ffocus%2F', { headers: origin }), env);
  assert.deepEqual(await other.json(), { count: 0 });
  const forbidden = await worker.fetch(new Request('https://worker.example/likes?path=%2Fgames%2Fguess%2F', { headers: { Origin: 'https://elsewhere.example' } }), env);
  assert.equal(forbidden.status, 403);
  const invalid = await worker.fetch(new Request('https://worker.example/likes?path=%2F', { headers: origin }), env);
  assert.equal(invalid.status, 400);
  const batch = await worker.fetch(new Request('https://worker.example/like-counts?path=%2Fgames%2Fguess%2F&path=%2Ftools%2Ffocus%2F', { headers: origin }), env);
  assert.deepEqual(await batch.json(), { counts: { '/games/guess/': 1 } });
  await worker.fetch(new Request('https://worker.example/views', { method: 'POST', headers: origin }), env);
  await worker.fetch(new Request('https://worker.example/views', { method: 'POST', headers: origin }), env);
  const stats = await worker.fetch(new Request('https://worker.example/stats', { headers: origin }), env);
  const summary = await stats.json();
  assert.equal(summary.pageviews, 2);
  assert.equal(summary.likes, 1);
  assert.equal(summary.days.length, 1);
  assert.equal(summary.days[0].views, 2);
  assert.deepEqual(summary.pages, [{ path, likes: 1 }]);
  const badBody = await worker.fetch(new Request('https://worker.example/likes', { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: 'null' }), env);
  assert.equal(badBody.status, 400);
});
