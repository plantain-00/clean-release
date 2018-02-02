import * as tmp from 'tmp'
import * as minimist from 'minimist'
import * as path from 'path'
import * as glob from 'glob'
import * as fs from 'fs'
import cpy = require('cpy')
import * as mkdirp from 'mkdirp'
import * as childProcess from 'child_process'
import * as rimraf from 'rimraf'
import * as inquirer from 'inquirer'
import * as semver from 'semver'
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

function writeFile (filename: string, data: string) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(filename, data, error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function exec (command: string) {
  return new Promise<string>((resolve, reject) => {
    console.log(`${command}...`)
    const subProcess = childProcess.exec(command, (error, stdout, stderr) => {
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
    const status = (await exec(`git status -s`)).trim()
    if (status && status.split('\n').some(s => !s.startsWith('A ') && !s.startsWith('M '))) {
      throw new Error('There are changes not staged for commit.')
    }
  }

  if (configData.askVersion) {
    let newVersionAnswer = await inquirer.prompt({
      type: 'list',
      name: 'identifier',
      message: 'Select a new identifier:',
      choices: [
        '',
        'alpha',
        'beta',
        'rc'
      ]
    })
    const identifier = newVersionAnswer.identifier

    const patchVersion = semver.inc(packageJsonData.version, 'patch')!
    const minorVersion = semver.inc(packageJsonData.version, 'minor')!
    const majorVersion = semver.inc(packageJsonData.version, 'major')!
    const prepatchVersion = semver.inc(packageJsonData.version, 'prepatch', true, identifier)!
    const preminorVersion = semver.inc(packageJsonData.version, 'preminor', true, identifier)!
    const premajorVersion = semver.inc(packageJsonData.version, 'premajor', true, identifier)!
    const prereleaseVersion = semver.inc(packageJsonData.version, 'prerelease', true, identifier)!
    const customVersionChoice = 'Custom'
    newVersionAnswer = await inquirer.prompt({
      type: 'list',
      name: 'newVersion',
      message: 'Select a new version:',
      choices: [
        {
          name: `Patch ${packageJsonData.version} -> ${patchVersion}`,
          value: patchVersion
        },
        {
          name: `Minor ${packageJsonData.version} -> ${minorVersion}`,
          value: minorVersion
        },
        {
          name: `Major ${packageJsonData.version} -> ${majorVersion}`,
          value: majorVersion
        },
        {
          name: `Pre Patch ${packageJsonData.version} -> ${prepatchVersion}`,
          value: prepatchVersion
        },
        {
          name: `Pre Minor ${packageJsonData.version} -> ${preminorVersion}`,
          value: preminorVersion
        },
        {
          name: `Pre Major ${packageJsonData.version} -> ${premajorVersion}`,
          value: premajorVersion
        },
        {
          name: `Pre Release ${packageJsonData.version} -> ${prereleaseVersion}`,
          value: prereleaseVersion
        },
        customVersionChoice
      ]
    })
    if (newVersionAnswer.newVersion === customVersionChoice) {
      newVersionAnswer = await inquirer.prompt({
        type: 'input',
        name: 'newVersion',
        message: 'Enter a custom version:',
        filter: (input: string) => semver.valid(input)!,
        validate: input => input !== null || 'Must be a valid semver version'
      })
    }
    packageJsonData.version = newVersionAnswer.newVersion
    await writeFile(packageJsonPath, JSON.stringify(packageJsonData, null, 2) + '\n')
  }

  const result = tmp.dirSync()
  console.log(`Tmp Dir: ${result.name}`)
  try {
    if (configData.releaseRepository) {
      if (configData.releaseBranchName) {
        await exec(`git clone -b ${configData.releaseBranchName} ${configData.releaseRepository} "${result.name}" --depth=1`)
      } else {
        await exec(`git clone ${configData.releaseRepository} "${result.name}" --depth=1`)
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
      await exec(`cd ${result.name} && git add -A --force && git commit -m "new release" && git push`)
    }

    if (configData.postScript) {
      if (Array.isArray(configData.postScript)) {
        for (const postScript of configData.postScript) {
          await exec(fillScript(postScript, result.name, packageJsonData.version))
        }
      } else {
        await exec(fillScript(configData.postScript, result.name, packageJsonData.version))
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
}
