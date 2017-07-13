import * as tmp from "tmp";
import * as flatten from "lodash.flatten";
import * as uniq from "lodash.uniq";
import * as minimist from "minimist";
import * as path from "path";
import * as glob from "glob";
import * as minimatch from "minimatch";
import * as fs from "fs";
import cpy = require("cpy");
import * as mkdirp from "mkdirp";
import * as childProcess from "child_process";
import * as packageJson from "../package.json";

function showToolVersion() {
    printInConsole(`Version: ${packageJson.version}`);
}

function printInConsole(message: any) {
    // tslint:disable-next-line:no-console
    console.log(message);
}

function globAsync(pattern: string) {
    return new Promise<string[]>((resolve, reject) => {
        glob(pattern, (error, matches) => {
            if (error) {
                reject(error);
            } else {
                resolve(matches);
            }
        });
    });
}

function mkdirpAsync(dir: string) {
    return new Promise<string>((resolve, reject) => {
        mkdirp(dir, (error, made) => {
            if (error) {
                reject(error);
            } else {
                resolve(made);
            }
        });
    });
}

function exec(command: string) {
    return new Promise<void>((resolve, reject) => {
        printInConsole(`${command}...`);
        childProcess.exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

async function executeCommandLine() {
    const argv = minimist(process.argv.slice(2), { "--": true });

    const showVersion = argv.v || argv.version;
    if (showVersion) {
        showToolVersion();
        return;
    }

    let config: string | undefined = argv.config;
    if (!config) {
        config = "clean-release.config.js";
    }
    const configPath = path.resolve(process.cwd(), config);

    const configData: ConfigData = require(configPath);

    const result = tmp.dirSync();
    printInConsole(`Tmp Dir: ${result.name}`);
    try {
        const files = await Promise.all(configData.include.map(file => globAsync(file)));
        let uniqFiles = uniq(flatten(files));
        if (configData.exclude) {
            uniqFiles = uniqFiles.filter(file => configData.exclude.every(excludeFile => !minimatch(file, excludeFile)));
        }

        for (const file of uniqFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Error: file: "${file}" not exists.`);
            }

            const directoryPath = path.resolve(result.name, path.relative(".", path.dirname(file)));
            await mkdirpAsync(directoryPath);

            await cpy(file, directoryPath);
            printInConsole(`Copied: ${file}`);
        }

        if (configData.postScript) {
            await exec(configData.postScript);
        }
        result.removeCallback();
    } catch (error) {
        result.removeCallback();
        throw error;
    }
}

executeCommandLine().catch(error => {
    printInConsole(error);
    process.exit(1);
});

type ConfigData = {
    include: string[];
    exclude: string[];
    postScript: string;
};
