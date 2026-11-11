'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

test('评论按页面保存，限制频率并拒绝无效请求', async t => {
  const { default: worker } = await import('../engagement/worker.mjs');
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  db.exec(fs.readFileSync('engagement/schema.sql', 'utf8'));
  const env = { ALLOWED_ORIGIN: 'https://codeqiao.github.io', COMMENT_SECRET: 'test-only-secret', DB: { prepare(sql) {
    const statement = (...args) => ({
      async first() { return db.prepare(sql).get(...args); },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; }
    });
    return { ...statement(), bind: (...args) => statement(...args) };
  } } };
  const origin = { Origin: env.ALLOWED_ORIGIN };
  const post = (payload, ip = '192.0.2.1') => worker.fetch(new Request('https://worker.example/comments', {
    method: 'POST', headers: { ...origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(payload)
  }), env);
  const payload = { path: '/games/guess/', nickname: '访客', body: '<script>只是文字</script>' };
  assert.equal((await post(payload)).status, 201);
  assert.equal((await post(payload)).status, 429);
  assert.equal((await post({ ...payload, path: '/bad/../path/' }, '192.0.2.2')).status, 400);
  assert.equal((await post({ ...payload, nickname: ' '.repeat(3) }, '192.0.2.2')).status, 400);
  assert.equal((await post({ path: '/games/', nickname: '另一位', body: '建议' }, '192.0.2.2')).status, 201);
  const get = url => worker.fetch(new Request(url, { headers: origin }), env);
  const list = await (await get('https://worker.example/comments?path=%2Fgames%2Fguess%2F')).json();
  assert.equal(list.comments.length, 1);
  assert.equal(list.comments[0].body, payload.body);
  assert.equal('client_hash' in list.comments[0], false);
  const counts = await (await get('https://worker.example/comment-counts?path=%2Fgames%2Fguess%2F&path=%2Fgames%2F')).json();
  assert.deepEqual(counts.counts, { '/games/': 1, '/games/guess/': 1 });
  const latest = await (await get('https://worker.example/recent-comments')).json();
  assert.equal(latest.comments.length, 2);
  assert.equal('client_hash' in latest.comments[0], false);
  assert.equal((await worker.fetch(new Request('https://worker.example/comments?path=%2F', { headers: { Origin: 'https://other.example' } }), env)).status, 403);
});
