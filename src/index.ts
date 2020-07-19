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
import * as semver from 'semver'
import { executeScriptAsync, logTimes, Time } from 'clean-scripts'
import * as packageJson from '../package.json'
import { Configuration } from './core'

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

function showHelp() {
  console.log(`Version ${packageJson.version}
Syntax:   clean-release [options]
Examples: clean-release
          clean-release --config clean-release.config.js
          clean-release --config clean-release.config.ts
Options:
 -h, --help                                         Print this message.
 -v, --version                                      Print the version
 --config                                           Config file
`)
}

function globAsync(pattern: string, ignore?: string | string[]) {
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

function statAsync(file: string) {
  return new Promise<fs.Stats | undefined>((resolve) => {
    fs.stat(file, (error, stats) => {
      if (error) {
        resolve(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}

const subProcesses: childProcess.ChildProcess[] = []

function exec(command: string, options: childProcess.ExecOptions | undefined) {
  return new Promise<string>((resolve, reject) => {
    console.log(`${command}...`)
    const subProcess = childProcess.exec(command, options || {}, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
    if (subProcess.stdout) {
      subProcess.stdout.pipe(process.stdout)
    }
    if (subProcess.stderr) {
      subProcess.stderr.pipe(process.stderr)
    }
    subProcesses.push(subProcess)
  })
}

async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true }) as {
    config?: string
    v?: unknown
    version?: unknown
    h?: unknown
    help?: unknown
  }

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  if (argv.h || argv.help) {
    showHelp()
    return
  }

  let configFilePath: string
  if (argv.config) {
    configFilePath = path.resolve(process.cwd(), argv.config)
  } else {
    configFilePath = path.resolve(process.cwd(), 'clean-release.config.ts')
    const stats = await statAsync(configFilePath)
    if (!stats || !stats.isFile()) {
      configFilePath = path.resolve(process.cwd(), 'clean-release.config.js')
    }
  }
  if (configFilePath.endsWith('.ts')) {
    require('ts-node/register/transpile-only')
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let configData: Configuration & { default?: Configuration } = require(configFilePath)
  if (configData.default) {
    configData = configData.default;
  }
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJsonData: { version: string } = require(packageJsonPath)

  if (configData.changesGitStaged) {
    const status = (await exec(`git status -s`, configData.execOptions)).trim()
    if (status && status.split('\n').some(s => !s.startsWith('A ') && !s.startsWith('M '))) {
      throw new Error('There are changes not staged for commit.')
    }
  }

  let effectedWorkspacePaths: string[][] | undefined
  if (configData.askVersion) {
    const { version, effectedWorkspaces } = await askVersion()
    packageJsonData.version = version
    if (effectedWorkspaces) {
      effectedWorkspacePaths = effectedWorkspaces.map((w) => w.map((e) => e.path))
    }
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
        await mkdirp(directoryPath)

        await cpy(file, directoryPath)
        console.log(`Copied: ${file} To:  ${relativePath}`)
      }
    }

    if (configData.releaseRepository) {
      await exec(`cd ${result.name} && git add -A --force && git commit -m "${packageJsonData.version}" && git tag -a v${packageJsonData.version} -m 'v${packageJsonData.version}' && git push && git push origin v${packageJsonData.version}`, configData.execOptions)
    }

    if (configData.postScript) {
      const versionData = semver.parse(packageJsonData.version)
      const tag = versionData && versionData.prerelease.length > 0 ? versionData.prerelease[0] : undefined
      if (Array.isArray(configData.postScript)) {
        const totalTime: Time[] = []
        for (const postScript of configData.postScript) {
          if (!postScript) {
            continue
          }
          if (typeof postScript === 'string') {
            await exec(fillScript(postScript, result.name, packageJsonData.version), configData.execOptions)
          } else {
            const script = await postScript({
              dir: result.name,
              version: packageJsonData.version,
              effectedWorkspacePaths,
              tag
            })
            if (script) {
              const times = await executeScriptAsync(script, undefined, undefined, undefined, configData.execOptions)
              totalTime.push(...times)
            }
          }
        }
        logTimes(totalTime)
      } else if (configData.postScript) {
        if (typeof configData.postScript === 'string') {
          await exec(fillScript(configData.postScript, result.name, packageJsonData.version), configData.execOptions)
        } else {
          const script = await configData.postScript({
            dir: result.name,
            version: packageJsonData.version,
            effectedWorkspacePaths,
            tag
          })
          if (script) {
            const times = await executeScriptAsync(script, undefined, undefined, undefined, configData.execOptions)
            logTimes(times)
          }
        }
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

function fillScript(script: string, dir: string, version: string) {
  return script.split('[dir]').join(dir).split('[version]').join(version)
}

function cleanup() {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    const stdout = childProcess.execSync('ps -l').toString()
    const ps = stdout.split('\n')
      .map(s => s.split(' ').filter(s => s))
      .filter((s, i) => i > 0 && s.length >= 2)
      .map(s => ({ pid: +s[1], ppid: +s[2] }))
    const result: number[] = []
    collectPids(process.pid, ps, result)
    for (const pid of result) {
      childProcess.execSync(`kill -9 ${pid}`)
    }
  }

  for (const subProcess of subProcesses) {
    subProcess.kill('SIGINT')
  }
}

executeCommandLine().then(() => {
  cleanup()
  process.exit()
},error => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  cleanup()
  process.exit(1)
})

interface Ps {
  pid: number
  ppid: number
}

function collectPids(pid: number, ps: Ps[], result: number[]) {
  const children = ps.filter(p => p.ppid === pid)
  for (const child of children) {
    result.push(child.pid)
    collectPids(child.pid, ps, result)
  }
}

process.on('SIGINT', () => {
  cleanup()
  process.exit()
})

process.on('SIGTERM', () => {
  cleanup()
  process.exit()
})
