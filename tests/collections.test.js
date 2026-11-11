'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readCollection, renderCollection } = require('../lib/collections');

test('列表按顺序生成，转义内容并跳过不展示的页面', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-collections-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const collection = path.join(root, 'source', 'tools');
  fs.mkdirSync(collection, { recursive: true });
  const write = (slug, text) => { const dir = path.join(collection, slug); fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, 'index.md'), text); };
  write('later', '---\ntitle: "B & C"\ndescription: "<test>"\nmenu_id: tools\norder: 2\n---\n');
  write('first', '---\ntitle: First\ndescription: Example\nmenu_id: tools\norder: 1\n---\n');
  write('hidden', '---\nlisted: false\n---\n');
  const entries = readCollection(root, 'tools');
  assert.deepEqual(entries.map(item => item.slug), ['first', 'later']);
  const html = renderCollection(entries, 'tools');
  assert.match(html, /href="first\/"/);
  assert.match(html, /B &amp; C/);
  assert.match(html, /&lt;test&gt;/);
  assert.doesNotMatch(html, /href="hidden\//);
});

test('缺少描述的内容不能通过校验', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-collections-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'source', 'skills', 'example');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.md'), '---\ntitle: Example\n---\n');
  assert.throws(() => readCollection(root, 'skills'), /description/);
});

test('游戏图标自动发现并为未提供图标的游戏提供文字兜底', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-games-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'source', 'games');
  for (const [slug, title, icon] of [['island', '小岛', true], ['puzzle', '谜题', false]]) {
    const game = path.join(dir, slug); fs.mkdirSync(game, { recursive: true });
    fs.writeFileSync(path.join(game, 'index.md'), '---\ntitle: ' + title + '\ndescription: test\nmenu_id: games\n---\n');
    if (icon) fs.writeFileSync(path.join(game, 'icon.svg'), '<svg/>');
  }
  const html = renderCollection(readCollection(root, 'games'), 'games');
  assert.match(html, /src="island\/icon\.svg"/);
  assert.match(html, /game-icon-fallback[^>]*>谜/);
});
