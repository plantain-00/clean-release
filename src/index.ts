import * as tmp from 'tmp'
import minimist from 'minimist'
import * as path from 'path'
import glob from 'glob'
import * as fs from 'fs'
import cpy from 'cpy'
import mkdirp from 'mkdirp'
import * as childProcess from 'child_process'
import * as rimraf from 'rimraf'
import { askVersion } from 'npm-version-cli'
import * as packageJson from '../package.json'

function showToolVersion () {
  console.log(`Version: ${packageJson.version}`)
}

function globAsync (pattern: string, ignore?: string | string[]) {
  return new Promise<string[]>((resolve, reject) => {
    glob(pattern, { ignore }, (error, matches) => {
      if (error) {
        reject(error)
      } else {
        resolve(matches)
      }
    })
  })
}

function mkdirpAsync (dir: string) {
  return new Promise<mkdirp.Made>((resolve, reject) => {
    mkdirp(dir, (error, made) => {
      if (error) {
        reject(error)
      } else {
        resolve(made)
      }
    })
  })
}

function exec (command: string, options: childProcess.ExecOptions | undefined) {
  return new Promise<string>((resolve, reject) => {
    console.log(`${command}...`)
    const subProcess = childProcess.exec(command, options || {}, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
    subProcess.stdout.pipe(process.stdout)
    subProcess.stderr.pipe(process.stderr)
  })
}

async function executeCommandLine () {
  const argv = minimist(process.argv.slice(2), { '--': true })

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  let config: string | undefined = argv.config
  if (!config) {
    config = 'clean-release.config.js'
  }

  const configData: ConfigData = require(path.resolve(process.cwd(), config))
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  const packageJsonData: { version: string } = require(packageJsonPath)

  if (configData.changesGitStaged) {
    const status = (await exec(`git status -s`, configData.execOptions)).trim()
    if (status && status.split('\n').some(s => !s.startsWith('A ') && !s.startsWith('M '))) {
      throw new Error('There are changes not staged for commit.')
    }
  }

  if (configData.askVersion) {
    packageJsonData.version = await askVersion()
  }

  const result = tmp.dirSync()
  console.log(`Tmp Dir: ${result.name}`)
  try {
    if (configData.releaseRepository) {
      if (configData.releaseBranchName) {
        await exec(`git clone -b ${configData.releaseBranchName} ${configData.releaseRepository} "${result.name}" --depth=1`, configData.execOptions)
      } else {
        await exec(`git clone ${configData.releaseRepository} "${result.name}" --depth=1`, configData.execOptions)
      }

      const fileOrDirectories = fs.readdirSync(result.name)
      for (const fileOrDirectory of fileOrDirectories) {
        const fullpath = path.resolve(result.name, fileOrDirectory)
        if (!fs.statSync(fullpath).isDirectory() || fileOrDirectory !== '.git') {
          rimraf.sync(fullpath)
        }
      }
    }

    if (!configData.include || configData.include.length === 0) {
      throw new Error('Expect at least one pattern.')
    }
    const uniqFiles = await globAsync(configData.include.length === 1 ? configData.include[0] : `{${configData.include.join(',')}}`, configData.exclude)

    for (const file of uniqFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Error: file: "${file}" not exists.`)
      }

      if (fs.statSync(file).isFile()) {
        let relativePath = path.relative('.', path.dirname(file))
        if (configData.base && relativePath.startsWith(configData.base)) {
          relativePath = path.relative(configData.base, relativePath)
        }
        const directoryPath = path.resolve(result.name, relativePath)
        await mkdirpAsync(directoryPath)

        await cpy(file, directoryPath)
        console.log(`Copied: ${file} To:  ${relativePath}`)
      }
    }

    if (configData.releaseRepository) {
      await exec(`cd ${result.name} && git add -A --force && git commit -m "${packageJsonData.version}" && git tag v${packageJsonData.version} && git push && git push origin v${packageJsonData.version}`, configData.execOptions)
    }

    if (configData.postScript) {
      if (Array.isArray(configData.postScript)) {
        for (const postScript of configData.postScript) {
          await exec(fillScript(postScript, result.name, packageJsonData.version), configData.execOptions)
        }
      } else {
        await exec(fillScript(configData.postScript, result.name, packageJsonData.version), configData.execOptions)
      }
    }

    if (!configData.notClean) {
      rimraf.sync(result.name)
    }
  } catch (error) {
    if (!configData.notClean) {
      rimraf.sync(result.name)
    }
    throw error
  }
}

function fillScript (script: string, dir: string, version: string) {
  return script.split('[dir]').join(dir).split('[version]').join(version)
}

executeCommandLine().catch(error => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  process.exit(1)
})

type ConfigData = {
  include: string[];
  exclude?: string[];
  base?: string;
  postScript?: string | string[];
  releaseRepository?: string;
  releaseBranchName?: string;
  notClean?: boolean;
  askVersion?: boolean;
  changesGitStaged?: boolean;
  execOptions?: childProcess.ExecOptions;
}
