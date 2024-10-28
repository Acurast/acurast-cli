import fs, { appendFileSync } from 'fs'
import path from 'path'
import { Command } from 'commander'
import { existsSync, writeFileSync } from 'fs'
import { confirm, input, select } from '@inquirer/prompts'
import { ENV_HELP_LINK, getFaucetLinkForAddress } from '../constants.js'
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
import { generateMnemonic } from 'bip39'
import { getWallet } from '../util/getWallet.js'

const setupEnvFile = () => {
  const requiredEnvVariables = [
    'ACURAST_MNEMONIC',
    'ACURAST_IPFS_URL',
    'ACURAST_IPFS_API_KEY',
  ]

  const mnemonic = generateMnemonic()

  const hasEnvFile = existsSync('./.env')
  if (hasEnvFile) {
    // Check if we already have the env variables in the .env file
    const envFileContent = fs.readFileSync('./.env', {
      encoding: 'utf-8',
    })

    const missingEnvVariables = requiredEnvVariables.filter(
      (envVar) => !envFileContent.includes(envVar)
    )

    if (missingEnvVariables.length === 0) {
      console.log('All required environment variables are already set')
    } else {
      console.log(
        `You already have a .env file. The following variables will be added to it:`
      )

      requiredEnvVariables.forEach((envVar) => {
        console.log(`- ${envVar}`)
      })

      appendFileSync('./.env', `\n\n# Acurast CLI`)

      if (missingEnvVariables.includes('ACURAST_MNEMONIC')) {
        process.env['ACURAST_MNEMONIC'] = mnemonic
        appendFileSync('./.env', `\nACURAST_MNEMONIC=${mnemonic}`)
      }

      missingEnvVariables.forEach((envVar) => {
        appendFileSync('./.env', `\n# ${envVar}=`)
      })
    }
  }

  if (!hasEnvFile) {
    console.log('There is no .env file, creating one now...')

    const envVarsText = requiredEnvVariables
      .slice(1)
      .map((el) => `\n# ${el}=`)
      .join('')

    process.env['ACURAST_MNEMONIC'] = mnemonic
    writeFileSync('./.env', `ACURAST_MNEMONIC=${mnemonic}${envVarsText}`)

    console.log(`.env file created. Visit ${ENV_HELP_LINK} to learn more.`)
  }
}

export const addCommandInit = (program: Command) => {
  program
    .command('init')
    .description('Create an acurast.json and .env file')
    .action(async () => {
      console.log('Initializing Acurast CLI')

      if (existsSync('./acurast.json')) {
        console.log('An acurast.json file already exists')

        setupEnvFile()
        return
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

      setupEnvFile()

      const wallet = await getWallet()
      console.log('')
      console.log('The CLI will use the following address: ' + wallet.address)
      console.log('')
      console.log(
        `Visit the faucet to get some tokens: ${getFaucetLinkForAddress(wallet.address)}`
      )
      console.log('')

      const packagePath = path.resolve('package.json')
      if (!existsSync(packagePath)) {
        console.log(
          'No package.json file found. This is unusual. Are you sure you are in the right directory?'
        )
      }

      let projectNameFromPackageJson = undefined
      let mainFileLocationFromPackageJson = undefined

      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))

        projectNameFromPackageJson = packageJson.name
        mainFileLocationFromPackageJson = packageJson.main
      } catch {}

      const projectName = await input({
        message: 'Enter the name of the project:',
        default: projectNameFromPackageJson,
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
            description:
              'Select this option if you want the deployment to run once',
          },
          {
            name: 'Interval',
            value: 'interval',
            description:
              'Select this option if you want the deployment to run in an interval',
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
        const unparsedDuration = await input({
          message: 'Enter the duration (eg. 1s, 5min or 2h):',
          validate: (input) => {
            const parsed = (parse(input) ?? 0).toString()
            const value = Number(parsed)
            if (isNaN(value) || value <= 0) {
              return 'Please enter a valid number greater than 0'
            }
            return true
          },
        })

        const parsedDuration = (parse(unparsedDuration) ?? 0).toString()
        const durationInMilliseconds = Number(parsedDuration)

        execution = {
          type: 'onetime',
          maxExecutionTimeInMs: durationInMilliseconds,
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
        const unparsedInterval = await input({
          message: 'What is the interval duration (eg. 1s, 5min or 2h)?',
          validate: (input) => {
            const parsed = (parse(input) ?? 0).toString()
            const value = Number(parsed)
            if (isNaN(value) || value <= 0) {
              return 'Please enter a valid number greater than 0'
            }
            return true
          },
        })

        const parsedDuration = (parse(unparsedInterval) ?? 0).toString()
        const durationInMilliseconds = Number(parsedDuration)

        execution = {
          type: 'interval',
          intervalInMs: Number(durationInMilliseconds),
          numberOfExecutions: Number(numberOfExecutions),
        }
      } else {
        throw new Error('Invalid deployment type')
      }

      const fileUrl = await input({
        message: 'What is the bundled javascript file to run?',
        default: mainFileLocationFromPackageJson,
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

      const hasGitignore = existsSync('./.gitignore')
      if (hasGitignore) {
        const gitignoreContent = fs.readFileSync('./.gitignore', {
          encoding: 'utf-8',
        })

        const hasAcurastFolderInGitignore = gitignoreContent
          .split('\n')
          .some((line) => line.startsWith('.acurast'))

        const hasEnvFileInGitignore = gitignoreContent
          .split('\n')
          .some((line) => line.startsWith('.env'))

        let toAdd = ''

        if (!hasAcurastFolderInGitignore) {
          toAdd += '\n.acurast'
        }

        if (!hasEnvFileInGitignore) {
          toAdd += '\n.env'
        }

        if (toAdd.length > 0) {
          appendFileSync('./.gitignore', `\n\n# Acurast CLI${toAdd}`)
        }
      }

      console.log()
      console.log('🎉 Successfully created "acurast.json" and ".env" files')
      console.log()
      console.log("You can deploy your app using 'acurast deploy'")
      console.log()
    })
}
