module.exports = {
  include: [
    'bin/*',
    'dist/*.js',
    'LICENSE',
    'package.json',
    'README.md'
  ],
  exclude: [
  ],
  askVersion: true,
  postScript: [
    'npm publish [dir] --access public',
    'git commit -m "feat: publish [version]"',
    'git tag v[version]',
    'git push'
  ]
}
