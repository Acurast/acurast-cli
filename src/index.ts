#! /usr/bin/env node

import fs from 'fs'
import path from 'path'

import { Command } from 'commander'
import figlet from 'figlet'
const { textSync } = figlet
import { addCommandInit } from './commands/init.js'
import { addCommandDeploy } from './commands/deploy.js'
import { addCommandJobs } from './commands/jobs.js'
import { addCommandLogin } from './commands/login.js'
import { addCommandLogout } from './commands/logout.js'
import { addCommandOpen } from './commands/open.js'
import { addCommandRun } from './commands/run.js'
import { addCommandTest } from './commands/test.js'
import { addCommandLive } from './commands/live.js'
import { addCommandWatch } from './commands/watch.js'
import { acurastColor } from './util.js'

// Read package.json
const packagePath = path.resolve('package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))

const program = new Command()

program
  .name('acurast')
  .version(packageJson.version, '-v, --version')
  .description(packageJson.description)

addCommandDeploy(program)
addCommandInit(program)
// addCommandJobs(program)
addCommandLive(program)
// addCommandLogin(program)
// addCommandLogout(program)
addCommandOpen(program)
// addCommandRun(program)
// addCommandTest(program)
// addCommandWatch(program)

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

program.parse(process.argv)
