'use strict';

const { readKnowledge, renderKnowledge } = require('../lib/knowledge');

hexo.extend.filter.register('before_post_render', data => {
  const source = (data.source || '').replace(/\\/g, '/');
  if (!source.startsWith('_posts/')) return data;
  const posts = readKnowledge(hexo.base_dir);
  const post = [...posts.values()].find(item => item.file === `source/${source}`);
  if (post) data.content += renderKnowledge(post);
  return data;
});
