'use strict';

const { COLLECTIONS, readCollection } = require('../lib/collections');
const fs = require('node:fs');
const path = require('node:path');
try {
  for (const collection of COLLECTIONS) {
    const indexPath = path.join('source', collection, 'index.md');
    if (!fs.readFileSync(indexPath, 'utf8').includes(`<!-- collection:${collection} -->`)) {
      throw new Error(`${indexPath}: 缺少列表占位符`);
    }
    const entries = readCollection(process.cwd(), collection);
    console.log(`${collection}: ${entries.length} 项`);
  }
} catch (error) {
  console.error(`栏目检查失败：${error.message}`);
  process.exitCode = 1;
}
