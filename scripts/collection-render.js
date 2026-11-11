'use strict';

const { readCollection, renderCollection } = require('../lib/collections');

hexo.extend.filter.register('before_post_render', data => {
  const source = (data.source || '').replace(/\\/g, '/');
  const match = source.match(/^(skills|games|tools)\/index\.md$/);
  if (!match) return data;
  const collection = match[1];
  const marker = `<!-- collection:${collection} -->`;
  if (!data.content.includes(marker)) throw new Error(`${source}: 缺少列表占位符 ${marker}`);
  data.content = data.content.replace(marker, renderCollection(readCollection(hexo.base_dir, collection), collection));
  return data;
});
