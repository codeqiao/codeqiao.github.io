'use strict';

const { readKnowledge } = require('../lib/knowledge');
try {
  const posts = readKnowledge(process.cwd());
  const links = [...posts.values()].reduce((sum, post) => sum + post.related.length, 0);
  console.log(`知识库: ${posts.size} 篇文章，${links} 条关联`);
} catch (error) {
  console.error(`知识库检查失败：${error.message}`);
  process.exitCode = 1;
}
