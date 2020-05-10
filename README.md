# clean-release

[![Dependency Status](https://david-dm.org/plantain-00/clean-release.svg)](https://david-dm.org/plantain-00/clean-release)
[![devDependency Status](https://david-dm.org/plantain-00/clean-release/dev-status.svg)](https://david-dm.org/plantain-00/clean-release#info=devDependencies)
[![Build Status: Linux](https://travis-ci.org/plantain-00/clean-release.svg?branch=master)](https://travis-ci.org/plantain-00/clean-release)
[![Build Status: Windows](https://ci.appveyor.com/api/projects/status/github/plantain-00/clean-release?branch=master&svg=true)](https://ci.appveyor.com/project/plantain-00/clean-release/branch/master)
[![npm version](https://badge.fury.io/js/clean-release.svg)](https://badge.fury.io/js/clean-release)
[![Downloads](https://img.shields.io/npm/dm/clean-release.svg)](https://www.npmjs.com/package/clean-release)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fplantain-00%2Fclean-release%2Fmaster%2Fpackage.json)](https://github.com/plantain-00/clean-release)

A CLI tool to copy files to be released into a tmp clean directory for npm publishing, electronjs packaging, docker image creation or deployment

## install

`yarn global add clean-release`

## usage

run `clean-release` or `clean-release --config clean-release.config.js` or `clean-release --config clean-release.config.ts`

## config

key | type | description
--- | --- | ---
include | string[] | the files included, support glob
exclude | string[]? | the files excluded, support glob
base | string? | the base path, eg: `dist`, then `dist/foo/bar.js` will be copied into `foo` as `foo/bar.js`
postScript | [postScript](#post-script) | used to publish to npm, eg: `npm publish "[dir]" --access public`
releaseRepository | string? | used to publish to a git release repository, eg: `https://github.com/plantain-00/baogame-release.git`
releaseBranchName | string? | the branch name of the release repository
notClean | boolean? | if true, do not clean the tmp directory
askVersion | boolean? | if true, will ask promp version
changesGitStaged | boolean? | if true, will make sure all changes is git staged
execOptions | childProcess.ExecOptions? | passed to `childProcess.exec`

## post script

```ts
postScript?: Script | Script[];

type Script = string | ((context: Context) => string) | ((context: Context) => Promise<string>)

type Context = {
  dir: string
  version: string
  tag: string | undefined
}
```

## npm package demo

```js
const { name, devDependencies: { electron: electronVersion } } = require('./package.json')

module.exports = {
  include: [
    'bin/*',
    'dist/**/*',
    'LICENSE',
    'package.json',
    'README.md'
  ],
  exclude: [
  ],
  askVersion: true,
  changesGitStaged: true,
  postScript: [
    'git add package.json',
    'git commit -m "[version]"',
    'git tag v[version]',
    'git push',
    'git push origin v[version]',
    'cd "[dir]" && npm i --production',
    'prune-node-modules "[dir]/node_modules"',
    `electron-packager "[dir]" "${name}" --out=dist --arch=x64 --electron-version=${electronVersion} --platform=darwin --ignore="dist/"`,
    `electron-packager "[dir]" "${name}" --out=dist --arch=x64 --electron-version=${electronVersion} --platform=win32 --ignore="dist/"`,
    `7z a -r -tzip dist/${name}-darwin-x64-[version].zip dist/${name}-darwin-x64/`,
    `7z a -r -tzip dist/${name}-win32-x64-$[version].zip dist/${name}-win32-x64/`,
    `electron-installer-windows --src dist/${name}-win32-x64/ --dest dist/`,
    `cd dist && create-dmg ${name}-darwin-x64/${name}.app`
  ]
}
```

## electronjs packaging demo

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
    'cd "[dir]" && npm i --production',
    'electron-packager "[dir]" "news" --out=dist --arch=x64 --version=1.2.1 --app-version="1.0.8" --platform=darwin --ignore="dist/"',
    'electron-packager "[dir]" "news" --out=dist --arch=x64 --version=1.2.1 --app-version="1.0.8" --platform=win32 --ignore="dist/"'
  ]
}
```

## docker demo

```js
module.exports = {
  include: [
    'dist/*.js',
    'static/protocol.proto',
    'static/scripts/*.bundle-*.js',
    'static/index.html',
    'LICENSE',
    'package.json',
    'README.md',
    'Dockerfile'
  ],
  exclude: [
  ],
  postScript: [
    'cd "[dir]" && docker build -t plantain/baogame . && docker push plantain/baogame'
  ]
}
```

## change logs

```bash
# v2
cd "[dir]"

# v1
cd [dir]
```
