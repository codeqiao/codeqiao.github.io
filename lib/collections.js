'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const COLLECTIONS = ['skills', 'games', 'tools'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readCollection(root, collection) {
  if (!COLLECTIONS.includes(collection)) throw new Error(`未知栏目: ${collection}`);
  const directory = path.join(root, 'source', collection);
  const entries = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const filename = path.join(directory, item.name, 'index.md');
    if (!fs.existsSync(filename)) continue;
    if (!SLUG.test(item.name)) throw new Error(`${filename}: 目录名必须是小写英文、数字和连字符`);
    const text = fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '');
    const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error(`${filename}: 缺少 YAML front matter`);
    const meta = yaml.load(match[1]);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error(`${filename}: 元信息无效`);
    if (meta.listed === false) continue;
    for (const field of ['title', 'description']) {
      if (typeof meta[field] !== 'string' || !meta[field].trim()) throw new Error(`${filename}: 必须填写 ${field}`);
    }
    if (meta.menu_id !== collection) throw new Error(`${filename}: menu_id 必须是 ${collection}`);
    if (meta.order !== undefined && (!Number.isFinite(meta.order) || meta.order < 0)) throw new Error(`${filename}: order 必须是非负数字`);
    entries.push({ slug: item.name, title: meta.title.trim(), description: meta.description.trim(), order: meta.order ?? 9999, hasIcon: collection === 'games' && fs.existsSync(path.join(directory, item.name, 'icon.svg')) });
  }
  return entries.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug, 'en'));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderCollection(entries, collection) {
  if (!entries.length) {
    const message = collection === 'skills' ? '有值得分享的 Skill 时，可以在这里添加介绍、使用方法和链接。' : '内容正在整理中。';
    return `<div class="collection-empty"><span class="empty-mark" aria-hidden="true">＋</span><div><h3>这里还没有内容</h3><p>${message}</p></div></div>`;
  }
  const rows = entries.map((entry, index) => `<a class="item-row${collection === 'games' ? ' game-row' : ''}" href="${encodeURIComponent(entry.slug)}/">${collection === 'games' ? (entry.hasIcon ? `<span class="game-icon"><img src="${encodeURIComponent(entry.slug)}/icon.svg" alt="" loading="lazy"></span>` : `<span class="game-icon game-icon-fallback" aria-hidden="true">${escapeHtml(Array.from(entry.title)[0])}</span>`) : `<span class="item-number">${String(index + 1).padStart(2, '0')}</span>`}<span class="item-content"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.description)}</span></span><span class="item-arrow" aria-hidden="true">↗</span></a>`);
  return `<div class="item-list">${rows.join('')}</div>`;
}

module.exports = { COLLECTIONS, readCollection, renderCollection };
