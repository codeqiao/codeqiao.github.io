'use strict';

// Provide readable names for public paths without coupling the statistics service to Hexo.
hexo.extend.generator.register('stats-titles', locals => {
  const titles = {};
  for (const item of [...locals.posts.toArray(), ...locals.pages.toArray()]) {
    const path = '/' + item.path.replace(/index\.html$/, '').replace(/\/?$/, '/');
    if (/^\/(?:\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+|(?:games|tools|skills)\/[a-z0-9-]+)\/$/.test(path)) titles[path] = item.title;
  }
  return { path: 'stats/titles.json', data: JSON.stringify(titles) };
});
