[![Dependency Status](https://david-dm.org/plantain-00/clean-release.svg)](https://david-dm.org/plantain-00/clean-release)
[![devDependency Status](https://david-dm.org/plantain-00/clean-release/dev-status.svg)](https://david-dm.org/plantain-00/clean-release#info=devDependencies)
[![Build Status](https://travis-ci.org/plantain-00/clean-release.svg?branch=master)](https://travis-ci.org/plantain-00/clean-release)
[![npm version](https://badge.fury.io/js/clean-release.svg)](https://badge.fury.io/js/clean-release)
[![Downloads](https://img.shields.io/npm/dm/clean-release.svg)](https://www.npmjs.com/package/clean-release)

# clean-release
A CLI tool to copy files to be released into a tmp clean directory for npm publishing, electronjs packaging, docker image creation or deployment

#### install

`npm i clean-release -g`

#### usage

run `clean-release` or `clean-release --config clean-release.config.js`

#### config

key | type | description
--- | --- | ---
include | string[] | the files included, support glob
exclude | string[]? | the files excluded, support glob
base | string? | the base path, eg: `dist`, then `dist/foo/bar.js` will be copied into `foo` as `foo/bar.js`
postScript | string? or string[] | used to publish to npm, eg: `npm publish [dir] --access public`
releaseRepository | string? | used to publish to a git release repository, eg: `https://github.com/plantain-00/baogame-release.git`
releaseBranchName | string? | the branch name of the release repository
notClean | string? | if true, do not clean the tmp directory

#### electronjs packaging demo

```js
module.exports = {
  include: [
    'libs.js',
    'main.js',
    'config.js',
    'index.css',
    'scripts/index.js',
    'index.html',
    'LICENSE',
    'package.json',
    'README.md'
  ],
  exclude: [
  ],
  postScript: [
    'cd [dir] && npm i --production',
    'electron-packager [dir] "news" --out=dist --arch=x64 --version=1.2.1 --app-version="1.0.8" --platform=darwin --ignore="dist/"',
    'electron-packager [dir] "news" --out=dist --arch=x64 --version=1.2.1 --app-version="1.0.8" --platform=win32 --ignore="dist/"'
  ]
}
```
