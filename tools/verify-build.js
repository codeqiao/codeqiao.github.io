'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { COLLECTIONS, readCollection } = require('../lib/collections');

try {
  for (const collection of COLLECTIONS) {
    const entries = readCollection(process.cwd(), collection);
    const index = path.join('public', collection, 'index.html');
    const $ = cheerio.load(fs.readFileSync(index, 'utf8'));
    const rows = $('.item-list .item-row').toArray();
    if (rows.length !== entries.length) throw new Error(`${collection}: 预期 ${entries.length} 个列表条目，实际 ${rows.length} 个`);
    entries.forEach((entry, index) => {
      const row = $(rows[index]);
      if (row.attr('href') !== `${encodeURIComponent(entry.slug)}/` || row.find('strong').text() !== entry.title) {
        throw new Error(`${collection}/${entry.slug}: 列表标题或链接不正确`);
      }
      const detail = path.join('public', collection, entry.slug, 'index.html');
      if (!fs.existsSync(detail) || !fs.readFileSync(detail, 'utf8').includes('<html')) {
        throw new Error(`${collection}/${entry.slug}: 详情页未生成`);
      }
    });
    if (!entries.length && !$('.collection-empty').length) throw new Error(`${collection}: 空列表缺少提示`);
    console.log(`${collection}: 列表与详情页检查通过`);
  }
} catch (error) {
  console.error(`构建产物检查失败：${error.message}`);
  process.exitCode = 1;
}
