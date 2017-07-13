module.exports = {
  include: [
    'bin/clean-release',
    'dist/index.js',
    'LICENSE',
    'package.json',
    'README.md'
  ],
  exclude: [
  ],
  postScript: 'npm publish . --access public'
}
