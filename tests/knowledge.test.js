'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readKnowledge, renderKnowledge } = require('../lib/knowledge');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-knowledge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'source', '_posts');
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, content) => fs.writeFileSync(path.join(dir, `${name}.md`), content);
  return { root, write };
}

test('关联自动形成双向导航', t => {
  const { root, write } = fixture(t);
  write('one', '---\ntitle: One\nrelated: [two]\n---\n');
  write('two', '---\ntitle: Two\n---\n');
  const posts = readKnowledge(root);
  assert.match(renderKnowledge(posts.get('one')), /post_link two/);
  assert.match(renderKnowledge(posts.get('two')), /post_link one/);
});

test('无效或自引用会被拒绝', t => {
  const { root, write } = fixture(t);
  write('one', '---\ntitle: One\nrelated: [missing]\n---\n');
  assert.throws(() => readKnowledge(root), /找不到关联文章/);
  write('one', '---\ntitle: One\nrelated: [one]\n---\n');
  assert.throws(() => readKnowledge(root), /不能引用自己/);
});

test('正文引用自动建立反向链接，代码示例不计入', t => {
  const { root, write } = fixture(t);
  write('one', '---\ntitle: One\n---\n正文 {% post_link two %}\n\n```txt\n{% post_link nonexistent %}\n```\n');
  write('two', '---\ntitle: Two\n---\n');
  const posts = readKnowledge(root);
  assert.deepEqual(posts.get('one').related, ['two']);
  assert.deepEqual(posts.get('two').incoming, ['one']);
});
