import fs from 'fs'
import path from 'path'
import { Command } from 'commander'
import { existsSync, writeFileSync } from 'fs'
import { confirm, input, select } from '@inquirer/prompts'
import { ENV_HELP_LINK } from '../constants.js'
import {
  DEFAULT_MAX_ALLOWED_START_DELAY_MS,
  DEFAULT_REWARD,
} from '../acurast/convertConfigToJob.js'
import {
  AcurastCliConfig,
  AcurastProjectConfig,
  AssignmentStrategyVariant,
} from '../types.js'
import { parse } from '../util/parse-duration.js'

// const assignmentStrategy: "single" | "competing" = await select({
//   message: "What assignment strategy should be used?",
//   choices: [
//     {
//       name: "Single Matches",
//       value: "single",
//       description:
//         "Find or specify 1 or more processors for this job at the beginning and use them for all job executions.",
//     },
//     {
//       name: "Competing Matches",
//       value: "competing",
//       description:
//         "Find 1 or more processors just before each job execution.",
//     },
//   ],
// });
export const addCommandInit = (program: Command) => {
  program
    .command('init')
    .description('Create an acurast.json file and .env file')
    .action(async () => {
      console.log('Initializing Acurast CLI')

      if (existsSync('./acurast.json')) {
        console.log('An acurast.json file already exists')
        const newProject = await confirm({
          message: 'Do you want to add another project?',
        })

        if (!newProject) {
          console.log('You can deploy your app using "acurast deploy"')
          return
        }
      }

      const acurastConfig: AcurastCliConfig | undefined = (() => {
        try {
          return JSON.parse(
            fs.readFileSync('./acurast.json', {
              encoding: 'utf-8',
            })
          )
        } catch {
          return undefined
        }
      })()

      const hasEnvFile = existsSync('./.env')
      if (hasEnvFile) {
        console.log(
          `You already have a .env file. Visit ${ENV_HELP_LINK} to learn more.`
        )

        if (!hasEnvFile) {
          const createEnv = await confirm({
            message: "You don't have a .env file. Do you want to create one?",
          })

          if (createEnv) {
            writeFileSync(
              './.env',
              `# ACURAST_MNEMONIC=\n# ACURAST_IPFS_URL=\n# ACURAST_IPFS_API_KEY=\n`
            )
          }
        }
      }

      const packagePath = path.resolve('package.json')
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))

      const projectName = await input({
        message: 'Enter the name of the project:',
        default: packageJson.name,
        validate: (input) => {
          if (!input) {
            return 'Please enter a valid name'
          }
          return true
        },
      })

      if (acurastConfig?.projects[projectName]) {
        throw new Error(`Project "${projectName}" already exists`)
      }

      const deploymentType = await select({
        message: 'Should the app be run one time or in an interval?',
        choices: [
          {
            name: 'One Time',
            value: 'onetime',
            description: 'Select this option if you want the job to run once',
          },
          {
            name: 'Interval',
            value: 'interval',
            description:
              'Select this option if you want the job to run in an interval',
          },
        ],
      })

      let execution:
        | {
            type: 'onetime'
            maxExecutionTimeInMs: number
          }
        | {
            type: 'interval'
            intervalInMs: number
            numberOfExecutions: number
          }

      if (deploymentType === 'onetime') {
        const durationInSeconds = await input({
          message: 'Enter the duration (eg. 1s, 5min or 2h):',
          transformer: (input) => {
            return (parse(input) ?? 0)?.toString()
          },
          validate: (input) => {
            const value = Number(input)
            if (isNaN(value) || value <= 0) {
              return 'Please enter a valid number greater than 0'
            }
            return true
          },
        })

        execution = {
          type: 'onetime',
          maxExecutionTimeInMs: Number(durationInSeconds) * 1000,
        }
      } else if (deploymentType === 'interval') {
        const numberOfExecutions = await input({
          message: 'How many times should the app run?',
          validate: (input) => {
            const value = Number(input)
            if (isNaN(value) || value <= 0) {
              return 'Please enter a valid number greater than 0'
            }
            return true
          },
        })
        const interval = await input({
          message: 'What is the interval (in seconds)?',
          validate: (input) => {
            const value = Number(input)
            if (isNaN(value) || value <= 0) {
              return 'Please enter a valid number greater than 0'
            }
            return true
          },
        })

        execution = {
          type: 'interval',
          intervalInMs: Number(interval) * 1000,
          numberOfExecutions: Number(numberOfExecutions),
        }
      } else {
        throw new Error('Invalid deployment type')
      }

      const fileUrl = await input({
        message: 'What is the bundled javascript file to run?',
        default: packageJson.main,
        validate: (input) => {
          if (!input) {
            return 'Please enter a valid name'
          }
          return true
        },
      })

      const config: AcurastProjectConfig = {
        projectName,
        fileUrl,
        network: 'canary',
        onlyAttestedDevices: true,
        assignmentStrategy: {
          type: AssignmentStrategyVariant.Single,
        },
        execution,
        maxAllowedStartDelayInMs: DEFAULT_MAX_ALLOWED_START_DELAY_MS,
        usageLimit: {
          maxMemory: 0,
          maxNetworkRequests: 0,
          maxStorage: 0,
        },
        numberOfReplicas: 1,
        requiredModules: [],
        minProcessorReputation: 0,
        maxCostPerExecution: DEFAULT_REWARD,
        includeEnvironmentVariables: [],
        processorWhitelist: [],
      }

      if (acurastConfig) {
        acurastConfig.projects[projectName] = config

        fs.writeFileSync(
          './acurast.json',
          JSON.stringify(acurastConfig, null, 2)
        )
      } else {
        fs.writeFileSync(
          './acurast.json',
          JSON.stringify({ projects: { [projectName]: config } }, null, 2)
        )
      }

      console.log('🎉 Successfully created "acurast.json" and ".env" files')
      console.log("You can deploy your app using 'acurast deploy'")
    })
}
