import fs, { appendFileSync } from 'fs'
import path from 'path'
import { Command, Option } from 'commander'
import type { CliNetwork } from '../config.js'
import { existsSync, writeFileSync } from 'fs'
import { confirm, input, select } from '@inquirer/prompts'
import {
  ENV_HELP_LINK,
  E2E_CANARY_INSTANT_MATCH_PROCESSOR,
  getFaucetLinkForAddress,
} from '../constants.js'
import {
  DEFAULT_MAX_ALLOWED_START_DELAY_MS,
  DEFAULT_REWARD,
  walletFromMnemonic,
} from '@acurast/sdk/chain'
import {
  type AcurastCliConfig,
  type AcurastProjectConfig,
  AssignmentStrategyVariant,
} from '@acurast/sdk/types'
import { parse } from '../util/parse-duration.js'
import { generateMnemonic } from 'bip39'
import { getEnv } from '../config.js'
import { acurastColor } from '../util.js'

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

const appendGitignoreEntries = () => {
  const hasGitignore = existsSync('./.gitignore')
  if (!hasGitignore) {
    return
  }

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

const writeAcurastConfig = (
  projectName: string,
  config: AcurastProjectConfig,
  acurastConfig: AcurastCliConfig | undefined
) => {
  if (acurastConfig) {
    acurastConfig.projects[projectName] = config
    fs.writeFileSync('./acurast.json', JSON.stringify(acurastConfig, null, 2))
  } else {
    fs.writeFileSync(
      './acurast.json',
      JSON.stringify({ projects: { [projectName]: config } }, null, 2)
    )
  }
}

export const addCommandInit = (program: Command) => {
  program
    .command('init')
    .description('Create an acurast.json and .env file')
    .addOption(
      new Option(
        '--defaults',
        'Use package.json name/main, onetime 5s execution, without prompts (for CI/e2e).'
      )
    )
    .addOption(
      new Option(
        '--network <network>',
        'Network when using --defaults (mainnet, canary, or devnet).'
      )
        .choices(['mainnet', 'canary', 'devnet'])
        .default('mainnet')
    )
    .addOption(
      new Option(
        '--instant-match',
        'Pin a known canary processor in acurast.json (requires --defaults; for e2e).'
      )
    )
    .action(
      async (options: {
        defaults?: boolean
        network: CliNetwork
        instantMatch?: boolean
      }) => {
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

      const packagePath = path.resolve('package.json')
      let projectNameFromPackageJson: string | undefined
      let mainFileLocationFromPackageJson: string | undefined

      if (existsSync(packagePath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
          projectNameFromPackageJson = packageJson.name
          mainFileLocationFromPackageJson = packageJson.main
        } catch {}
      }

      if (options.instantMatch && !options.defaults) {
        throw new Error('--instant-match requires --defaults')
      }

      if (options.defaults) {
        const projectName = projectNameFromPackageJson
        if (!projectName) {
          throw new Error(
            '--defaults requires package.json with a "name" field'
          )
        }
        const fileUrl = mainFileLocationFromPackageJson ?? 'dist/bundle.js'
        const durationMs = Number(parse('5s') ?? 5000)

        const assignmentStrategy = options.instantMatch
          ? {
              type: AssignmentStrategyVariant.Single,
              instantMatch: [
                {
                  processor: E2E_CANARY_INSTANT_MATCH_PROCESSOR,
                  maxAllowedStartDelayInMs: 10000,
                },
              ],
            }
          : {
              type: AssignmentStrategyVariant.Single,
            }

        const config = {
          projectName,
          fileUrl,
          network: options.network,
          onlyAttestedDevices: true,
          assignmentStrategy,
          execution: {
            type: 'onetime',
            maxExecutionTimeInMs: durationMs,
          },
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
        } as AcurastProjectConfig

        writeAcurastConfig(projectName, config, acurastConfig)
        appendGitignoreEntries()

        console.log()
        console.log('🎉 Successfully created "acurast.json" and ".env" files')
        console.log()
        console.log("You can deploy your app using 'acurast deploy'")
        console.log()
        return
      }

      const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
        name: 'AcurastCli',
      })
      console.log('')
      console.log('The CLI will use the following address: ' + wallet.address)
      console.log('')
      const usesCanary = acurastConfig
        ? Object.values(acurastConfig.projects ?? {}).some(
            (p) => p?.network === 'canary'
          )
        : false

      console.log(
        `To deploy on mainnet, acquire ACU tokens (see ${acurastColor('https://docs.acurast.com/token-holders/how-to-get-acu/')}) and send them to the address above.`
      )
      if (usesCanary) {
        console.log(
          `For canary network testing, use the faucet: ${getFaucetLinkForAddress(wallet.address)}`
        )
      }
      console.log('')

      if (!existsSync(packagePath)) {
        console.log(
          'No package.json file found. This is unusual. Are you sure you are in the right directory?'
        )
      }

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
        network: 'mainnet',
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

      writeAcurastConfig(projectName, config, acurastConfig)
      appendGitignoreEntries()

      console.log()
      console.log('🎉 Successfully created "acurast.json" and ".env" files')
      console.log()
      console.log("You can deploy your app using 'acurast deploy'")
      console.log()
    }
    )
}
