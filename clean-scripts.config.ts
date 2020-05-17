import { checkGitStatus } from 'clean-scripts'

const tsFiles = `"src/**/*.ts"`
const jsFiles = `"*.config.js"`

export default {
  build: [
    `rimraf dist/`,
    `tsc -p src/`
  ],
  lint: {
    ts: `eslint --ext .js,.ts ${tsFiles} ${jsFiles}`,
    export: `no-unused-export ${tsFiles}`,
    commit: `commitlint --from=HEAD~1`,
    markdown: `markdownlint README.md`,
    typeCoverage: 'type-coverage -p src --strict'
  },
  test: [
    () => checkGitStatus()
  ],
  fix: `eslint --ext .js,.ts ${tsFiles} ${jsFiles} --fix`
}
