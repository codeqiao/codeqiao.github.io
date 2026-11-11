'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The site publishes the same file that agents install; there is only one source to maintain.
hexo.extend.generator.register('qidian-site-skill', () => ({
  path: 'skills/qidian-site/SKILL.md',
  data: fs.readFileSync(path.join(hexo.base_dir, 'skills/qidian-site/SKILL.md'), 'utf8')
}));
