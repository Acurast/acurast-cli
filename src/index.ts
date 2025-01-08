#! /usr/bin/env node

import fs from 'fs'
import path from 'path'

import { Command } from 'commander'
import figlet from 'figlet'
const { textSync } = figlet
import { addCommandInit } from './commands/init.js'
import { addCommandDeploy } from './commands/deploy.js'
import { addCommandLogin } from './commands/login.js'
import { addCommandLogout } from './commands/logout.js'
import { addCommandOpen } from './commands/open.js'
import { addCommandRun } from './commands/run.js'
import { addCommandTest } from './commands/test.js'
import { addCommandLive } from './commands/live.js'
import { addCommandWatch } from './commands/watch.js'
import { acurastColor } from './util.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { addCommandDeployments } from './commands/deployments.js'
import { addCommandNew } from './commands/new.js'
import { ACURAST_CLI_VERSION_CHECK_URL } from './constants.js'
import { filelogger } from './util/fileLogger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read package.json
const packagePath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))

filelogger.debug(`--------------------------------`)
filelogger.debug(`CLI is running version ${packageJson.version}`)
filelogger.debug(`COMMAND: acurast ${process.argv.slice(2).join(' ')}`)

const program = new Command()

program
  .name('acurast')
  .version(packageJson.version, '-v, --version')
  .description(packageJson.description)

addCommandDeploy(program)
addCommandInit(program)
addCommandDeployments(program)
addCommandLive(program)
// addCommandLogin(program)
// addCommandLogout(program)
addCommandOpen(program)
// addCommandRun(program)
// addCommandTest(program)
// addCommandWatch(program)
addCommandNew(program)

if (!process.argv.slice(2).length) {
  console.log(acurastColor(textSync('Acurast CLI')))

  program.outputHelp()

  // TODO: Add info about each command
  // program.commands.forEach((command) => {
  //   console.log();
  //   console.log(`##### ${command.name()} #####`);
  //   console.log();
  //   command.outputHelp();
  // });

  process.exit(0) // If no command is provided, exit the process
}

// Check if there's a newer version available
fetch(ACURAST_CLI_VERSION_CHECK_URL)
  .then((response) => response.json())
  .then((remotePackage) => {
    const localVersion = packageJson.version
    const remoteVersion = remotePackage.version

    if (remoteVersion > localVersion) {
      filelogger.debug(
        `New version available. Local: ${localVersion}, Remote: ${remoteVersion}`
      )
      console.log(
        acurastColor(
          `\nA new version (v${remoteVersion}) is available! You are currently on version v${localVersion}\n` +
            'Update by running: npm install -g @acurast/cli\n'
        )
      )
    }
  })
  .catch(() => {
    // Silently fail if unable to check version
  })
  .finally(() => {
    program.parse(process.argv)
  })
