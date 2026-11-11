'use strict';

const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['client/pet-3d.js'],
  outfile: 'source/generated/pet-3d.js',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  legalComments: 'eof'
}).catch(error => {
  console.error('3D 小猫构建失败：', error);
  process.exitCode = 1;
});
