import fs, { appendFileSync } from 'fs'
import path from 'path'
import { Command } from 'commander'
import { existsSync, writeFileSync } from 'fs'
import { confirm, input, select } from '@inquirer/prompts'
import { ENV_HELP_LINK, getFaucetLinkForAddress } from '../constants.js'
import {
  DEFAULT_MAX_ALLOWED_START_DELAY_MS,
  DEFAULT_REWARD,
  DEFAULT_TIME_BETWEEN_EXECUTIONS_MS,
  MIN_EXECUTION_DURATION_MS,
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
import { getGlobalAuth } from '../util/authStore.js'
import { runLogin } from './login.js'

export type SigningChoice = 'browser' | 'mnemonic'

/**
 * Environment variables `init` sets up, depending on the chosen signing method.
 * Browser-wallet signing stores no private key, so `ACURAST_MNEMONIC` is
 * omitted; local signing keeps it first (it is the one generated with a value).
 */
export const requiredEnvVariablesForSigning = (mode: SigningChoice): string[] => {
  const ipfsVars = ['ACURAST_IPFS_URL', 'ACURAST_IPFS_API_KEY']
  return mode === 'mnemonic' ? ['ACURAST_MNEMONIC', ...ipfsVars] : ipfsVars
}

const setupEnvFile = (mode: SigningChoice) => {
  const requiredEnvVariables = requiredEnvVariablesForSigning(mode)
  const wantsMnemonic = mode === 'mnemonic'

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

    if (wantsMnemonic) {
      const envVarsText = requiredEnvVariables
        .slice(1)
        .map((el) => `\n# ${el}=`)
        .join('')
      process.env['ACURAST_MNEMONIC'] = mnemonic
      writeFileSync('./.env', `ACURAST_MNEMONIC=${mnemonic}${envVarsText}`)
    } else {
      const envVarsText = requiredEnvVariables.map((el) => `# ${el}=`).join('\n')
      writeFileSync('./.env', envVarsText)
    }

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
    .action(async () => {
      console.log('Initializing Acurast CLI')

      if (existsSync('./acurast.json')) {
        console.log('An acurast.json file already exists')

        // Topping up an existing project: keep the legacy behaviour of ensuring
        // a local mnemonic in .env, and don't prompt (this path is also used
        // non-interactively).
        setupEnvFile('mnemonic')
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

      // Only ask how to sign when we can actually prompt. Without a TTY (piped
      // or scripted), fall back to the local mnemonic — browser login needs an
      // interactive session anyway.
      const signingMode: SigningChoice = process.stdin.isTTY
        ? await select({
            message: 'How do you want to sign deployments?',
            choices: [
              {
                name: 'Browser wallet — no private key stored (recommended)',
                value: 'browser',
                description:
                  'Sign with a browser wallet via `acurast login`. Works across all your projects.',
              },
              {
                name: 'Local mnemonic — generate & store in .env',
                value: 'mnemonic',
                description:
                  'Generate a mnemonic and store it in this project’s .env. The private key lives on disk.',
              },
            ],
            default: 'browser',
          })
        : 'mnemonic'

      setupEnvFile(signingMode)

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

      let address: string | undefined
      if (signingMode === 'mnemonic') {
        const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
          name: 'AcurastCli',
        })
        address = wallet.address
        console.log('')
        console.log('The CLI will use the following address: ' + address)
      } else {
        const existing = getGlobalAuth()
        if (existing) {
          address = existing.address
          console.log('')
          console.log(`You are logged in as ${address} (browser wallet).`)
        } else {
          console.log('')
          const loginNow = await confirm({
            message: 'Log in with your browser wallet now?',
            default: true,
          })
          if (loginNow) {
            address = (await runLogin({ network: 'mainnet', scope: 'global' })) ?? undefined
          } else {
            console.log('Run `acurast login` when you are ready to deploy.')
          }
        }
      }
      console.log('')

      const usesCanary = acurastConfig
        ? Object.values(acurastConfig.projects ?? {}).some(
            (p) => p?.network === 'canary'
          )
        : false

      if (address) {
        console.log(
          `To deploy on mainnet, acquire ACU tokens (see ${acurastColor('https://docs.acurast.com/token-holders/how-to-get-acu/')}) and send them to the address above.`
        )
        if (usesCanary) {
          console.log(
            `For canary network testing, use the faucet: ${getFaucetLinkForAddress(address)}`
          )
        }
        console.log('')
      }

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
          message: 'Enter the duration (eg. 1m, 5min or 2h):',
          validate: (input) => {
            const parsed = (parse(input) ?? 0).toString()
            const value = Number(parsed)
            if (isNaN(value) || value <= 0) {
              return 'Please enter a valid number greater than 0'
            }
            if (value < MIN_EXECUTION_DURATION_MS) {
              return 'Deployments must run for at least 1 minute'
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
          message: 'What is the interval duration (eg. 2m, 5min or 2h)?',
          validate: (input) => {
            const parsed = (parse(input) ?? 0).toString()
            const value = Number(parsed)
            if (isNaN(value) || value <= 0) {
              return 'Please enter a valid number greater than 0'
            }
            // The execution duration is derived from the interval minus the
            // gap between executions and must stay above the 1 minute minimum.
            if (
              value <
              MIN_EXECUTION_DURATION_MS + DEFAULT_TIME_BETWEEN_EXECUTIONS_MS + 1
            ) {
              return 'The interval must be at least 1 minute and 11 seconds so each execution can run for at least 1 minute'
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
    })
}
