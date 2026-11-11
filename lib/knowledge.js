'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

function readKnowledge(root) {
  const directory = path.join(root, 'source', '_posts');
  const posts = new Map();
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!match) throw new Error(`${file}: 缺少 YAML front matter`);
      const meta = yaml.load(match[1]);
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error(`${file}: 元信息无效`);
      if (meta.published === false) continue;
      const slug = meta.slug || path.basename(entry.name, '.md');
      if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${file}: 文章 slug 须使用小写英文、数字和连字符`);
      if (posts.has(slug)) throw new Error(`${file}: 重复的文章 slug ${slug}`);
      if (typeof meta.title !== 'string' || !meta.title.trim()) throw new Error(`${file}: 必须填写 title`);
      const related = meta.related ?? [];
      if (!Array.isArray(related) || related.some(item => typeof item !== 'string')) throw new Error(`${file}: related 必须是文章 slug 列表`);
      if (new Set(related).size !== related.length) throw new Error(`${file}: related 包含重复引用`);
      // Ignore examples in fenced and inline code when discovering references.
      const body = text.slice(match[0].length).replace(/^\s*(```+|~~~+)[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '').replace(/`[^`\n]*`/g, '');
      const inline = [...body.matchAll(/\{%\s*post_link\s+([^\s%]+)[^%]*%\}/g)].map(item => item[1].split('#')[0]);
      posts.set(slug, { slug, file: path.relative(root, file).replace(/\\/g, '/'), related: [...new Set([...related, ...inline])], incoming: [] });
    }
  }
  scan(directory);
  for (const post of posts.values()) {
    for (const target of post.related) {
      if (target === post.slug) throw new Error(`${post.file}: 不能引用自己`);
      if (!posts.has(target)) throw new Error(`${post.file}: 找不到关联文章 ${target}`);
      posts.get(target).incoming.push(post.slug);
    }
  }
  return posts;
}

function renderKnowledge(post) {
  const sections = [];
  if (post.related.length) sections.push(`## 延伸阅读\n\n${post.related.map(slug => `- {% post_link ${slug} %}`).join('\n')}`);
  if (post.incoming.length) sections.push(`## 引用本文\n\n${post.incoming.sort().map(slug => `- {% post_link ${slug} %}`).join('\n')}`);
  return sections.length ? `\n\n${sections.join('\n\n')}\n` : '';
}

module.exports = { readKnowledge, renderKnowledge };
