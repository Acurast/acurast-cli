import { Command, Option } from 'commander'
import { acurastColor } from '../util.js'
import * as ora from '../util/ora.js'
import { sendCode } from '../live-code.js'
import { readFileSync } from 'fs'
import {
  addLiveCodeProcessor,
  readLiveCodeProcessors,
} from '../services/storage.js'
import { loadConfig } from '../acurast/loadConfig.js'
import { parse } from '../util/parse-duration.js'
import { input } from '@inquirer/prompts'
import { createJob } from '../acurast/createJob.js'
import { RPC } from './deploy.js'
import { DeploymentStatus } from '../acurast/types.js'
import { AssignmentStrategyVariant } from '../types.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { shortenString } from '../util/shortenString.js'
import { red, green } from 'ansis'

export const addCommandLive = (program: Command) => {
  program
    .command('live [project]')
    .description(
      'Run the code in a live code environment on a remote processor'
    )
    .addOption(
      new Option(
        '-s, --setup',
        'Set up a live code environment for the project.'
      )
    )
    .action(async (project: string, options: { setup?: boolean }) => {
      if (options.setup) {
        const unparsedDuration = await input({
          message: 'Enter the duration (eg. 1h, 2d):',
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

        const numberOfProcessors = Number(
          await input({
            message: 'On how many processors?:',
            validate: (input) => {
              const value = Number(input)
              if (isNaN(value) || value <= 0) {
                return 'Please enter a valid number greater than 0'
              }
              if (isNaN(value) || value > 10) {
                return 'Please enter a number lower than 10'
              }
              return true
            },
          })
        )

        const spinner = ora.default('Setting up live code environment')
        spinner.start()

        const jobId: any = await new Promise((resolve) => {
          const __filename = fileURLToPath(import.meta.url)
          const __dirname = dirname(__filename)

          const filePath = join(
            __dirname,
            '..',
            'util',
            'live-code-processor.js'
          )

          createJob(
            {
              projectName: 'report',
              fileUrl: filePath,
              network: 'canary',
              onlyAttestedDevices: false,
              startAt: {
                msFromNow: 300000,
              },
              assignmentStrategy: {
                type: AssignmentStrategyVariant.Single,
              },
              execution: {
                type: 'onetime',
                maxExecutionTimeInMs: durationInMilliseconds,
              },
              maxAllowedStartDelayInMs: 60000,
              usageLimit: {
                maxMemory: 0,
                maxNetworkRequests: 0,
                maxStorage: 0,
              },
              numberOfReplicas: numberOfProcessors,
              requiredModules: [],
              minProcessorReputation: 0,
              maxCostPerExecution: 10000000000,
              includeEnvironmentVariables: [],
              processorWhitelist: [],
            },
            RPC,
            (status, data) => {
              if (status === DeploymentStatus.WaitingForMatch) {
                const jobId = data.jobIds[0]
                resolve(jobId)
                spinner.succeed('Live code environment scheduled')
              }
            }
          )
        })

        console.log(
          'Please go to the follow link and copy the "Deployment Public Key" of the assigned processor, (it may take a few minutes until it\'s available)'
        )
        console.log('')

        console.log(
          `https://console.acurast.com/job-detail/acurast-${jobId[0].Acurast}-${jobId[1]
            .split(',')
            .join('')}`
        )
        console.log('')

        const processorPublicKey = await input({
          message: 'Deployment Public Key',
          validate: (input) => {
            if (!input) {
              return 'Please enter a valid public key'
            }
            if (!input.startsWith('0x')) {
              return 'Please enter a valid public key'
            }
            return true
          },
        })

        addLiveCodeProcessor({
          publicKey: processorPublicKey,
        })

        if (numberOfProcessors > 1) {
          console.log(
            'To add more processors to the list, open ".acurast/live-code-processors.json" and add them manually.'
          )
        }

        console.log(
          'Live code environment set up! Run `acurast live` to run your code on that processor.'
        )

        return process.exit(0)
      }

      let config
      try {
        config = loadConfig(project)
      } catch (e: any) {
        console.log(e.message)
        return
      }
      // console.log(config);

      if (!config) {
        throw new Error('No project found')
      }

      const code = readFileSync(config.fileUrl, 'utf-8')

      // TODO: Handle expired
      const liveCodeProcessors = readLiveCodeProcessors()

      if (liveCodeProcessors.length === 0) {
        throw new Error('No processor found. Run `acurast live --setup`')
      }

      const spinner = ora.default(
        `Running code on ${liveCodeProcessors.length} processor${liveCodeProcessors.length > 1 ? 's' : ''}`
      )
      spinner.start()

      let terminations = 0
      const registerTermination = () => {
        terminations++
        if (terminations >= liveCodeProcessors.length) {
          spinner.stop()
          process.exit(0)
        }
      }

      liveCodeProcessors.forEach((processor) => {
        sendCode(
          processor.publicKey,
          code,
          (event: { type: 'log' | 'success' | 'error'; data: any }) => {
            // TODO: Count success and error and abort process if we have all successes and errors.
            spinner.stop()
            // Sometimes messages arrive out of order, so we wait a little bit before exiting
            if (event.type === 'success') {
              console.log(
                `${shortenString(processor.publicKey)} ${green('Success')}`
              )
              registerTermination()
            } else if (event.type === 'error') {
              console.log(
                `${shortenString(processor.publicKey)} ${red('Error')}: ${event.data}`
              )
              registerTermination()
            } else {
              if (Array.isArray(event.data)) {
                console.log(
                  shortenString(processor.publicKey),
                  acurastColor(`Log:`),
                  ...event.data
                )
              } else {
                console.log(
                  shortenString(processor.publicKey),
                  acurastColor(`Log:`),
                  event.data
                )
              }
            }
            spinner.start()
          }
        )
      })
    })
}
