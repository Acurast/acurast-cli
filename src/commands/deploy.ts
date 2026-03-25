import { Command, Option } from 'commander'
import { loadConfig } from '../acurast/loadConfig.js'
import {
  getEnv,
  validateDeployEnvVars,
  getProjectEnvVars,
  getRpcForNetwork,
  getSymbolForNetwork,
  getMatcherUrlForNetwork,
} from '../config.js'
import { delay, Listr } from 'listr2'
import { createJob } from '../acurast/createJob.js'
import { storeDeployment } from '../acurast/storeDeployment.js'
import { acurastColor } from '../util.js'
import { humanTime } from '../util/humanTime.js'
import {
  convertConfigToJob,
  DEFAULT_START_DELAY,
  isStartAtMsFromNow,
  isStartAtTimestamp,
} from '../acurast/convertConfigToJob.js'
import { validateConfig } from '../util/validateConfig.js'
import { DeploymentStatus } from '../acurast/types.js'
import { consoleOutput } from '../util/console-output.js'
import { getWallet } from '../util/getWallet.js'
import { getBalance } from '../util/getBalance.js'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { getFaucetLinkForAddress } from '../constants.js'
import * as ora from '../util/ora.js'
import type { EnvVar, Job } from '../acurast/env/types.js'
import type { JobRegistration, AcurastProjectConfig } from '../types.js'
import { filelogger } from '../util/fileLogger.js'

import { checkMatchWithReward } from '../services/matcherApi.js'
import type { PricingAdvice } from '../util/pricingAdvisor.js'
import { fetchAndDisplayPricing } from '../util/fetchPricingAdvice.js'
import { BigNumber } from 'bignumber.js'
import { confirm, select, input } from '@inquirer/prompts'
import { AssignmentStrategyVariant } from '../types.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const ACURAST_DECIMALS = 12

async function promptPricingAdjustment(
  advice: PricingAdvice,
  config: AcurastProjectConfig,
  matcherUrl: string,
  accountId: string,
  options: { output: 'text' | 'json' }
): Promise<string | 'abort' | undefined> {
  const symbol = getSymbolForNetwork(config.network)

  if (advice.status === 'sufficient') {
    return undefined // No adjustment needed
  }

  if (advice.status === 'overpaying') {
    const suggestedDisplay = advice.suggestedPrice
      ? new BigNumber(advice.suggestedPrice)
          .shiftedBy(-ACURAST_DECIMALS)
          .toFixed()
      : null

    const choices: { value: string; name: string }[] = []
    if (suggestedDisplay && advice.suggestedPrice) {
      choices.push({
        value: 'suggested',
        name: `Lower to suggested price (${suggestedDisplay} ${symbol})`,
      })
    }
    choices.push(
      { value: 'keep', name: 'Keep current price' },
      { value: 'custom', name: 'Enter a custom price' }
    )

    const action = await select({
      message: 'Your price is higher than needed. What would you like to do?',
      choices,
    })

    if (action === 'keep') return undefined
    if (action === 'suggested' && advice.suggestedPrice) {
      return advice.suggestedPrice.toFixed()
    }
    if (action === 'custom') {
      return promptCustomPrice(config, matcherUrl, accountId, symbol)
    }
  }

  if (advice.status === 'insufficient') {
    const suggestedDisplay = advice.suggestedPrice
      ? new BigNumber(advice.suggestedPrice)
          .shiftedBy(-ACURAST_DECIMALS)
          .toFixed()
      : null

    const choices: { value: string; name: string }[] = []
    if (suggestedDisplay && advice.suggestedPrice) {
      choices.push({
        value: 'suggested',
        name: `Use suggested price (${suggestedDisplay} ${symbol} — covers ${advice.requiredProcessors} ${advice.requiredProcessors === 1 ? 'processor' : 'processors'})`,
      })
    }
    choices.push(
      { value: 'custom', name: 'Enter a custom price' },
      { value: 'keep', name: 'Continue with current price (may not match)' },
      { value: 'abort', name: 'Abort deployment' }
    )

    const action = await select({
      message:
        'Not enough processors at your current price. What would you like to do?',
      choices,
    })

    if (action === 'abort') return 'abort'
    if (action === 'keep') return undefined
    if (action === 'suggested' && advice.suggestedPrice) {
      return advice.suggestedPrice.toFixed()
    }
    if (action === 'custom') {
      return promptCustomPrice(config, matcherUrl, accountId, symbol)
    }
  }

  return undefined
}

async function promptCustomPrice(
  config: AcurastProjectConfig,
  matcherUrl: string,
  accountId: string,
  symbol: string,
  retries: number = 3
): Promise<string | 'abort' | undefined> {
  for (let i = 0; i < retries; i++) {
    const priceStr = await input({
      message: `Enter price in ${symbol} (e.g., 0.05):`,
      validate: (val) => {
        const n = new BigNumber(val)
        if (n.isNaN() || n.lte(0)) return 'Please enter a valid positive number'
        return true
      },
    })

    const priceSatoshi = new BigNumber(priceStr)
      .shiftedBy(ACURAST_DECIMALS)
      .integerValue(BigNumber.ROUND_CEIL)

    // Verify match with the new price
    const job = convertConfigToJob({
      ...config,
      maxCostPerExecution: priceSatoshi.toNumber(),
    })
    const result = await checkMatchWithReward(
      matcherUrl,
      config,
      job,
      accountId,
      priceSatoshi.toFixed()
    )

    if (result.ok) {
      const matched = result.data.matched_processors
      console.log(
        `  At ${priceStr} ${symbol}: ${matched} ${matched === 1 ? 'processor' : 'processors'} matched (${config.numberOfReplicas} required)`
      )

      if (result.data.matched_processors >= config.numberOfReplicas) {
        const proceed = await confirm({
          message: `Use ${priceStr} ${symbol} per execution?`,
          default: true,
        })
        if (proceed) return priceSatoshi.toFixed()
      } else {
        if (i < retries - 1) {
          console.log('  Still not enough processors. Try a higher price.')
        }
      }
    } else {
      console.log(`  Could not verify price: ${result.error}`)
    }
  }

  const action = await select({
    message: 'Could not find a sufficient price. What would you like to do?',
    choices: [
      { value: 'keep', name: 'Continue with original price' },
      { value: 'abort', name: 'Abort deployment' },
    ],
  })

  return action === 'abort' ? 'abort' : undefined
}

export const addCommandDeploy = (program: Command) => {
  program
    .command('deploy [project]')
    .description('Deploy the current project to the Acurast platform.')
    .addOption(
      new Option(
        '-d, --dry-run',
        'Run the deploy step without actually deploying the project.'
      )
    )
    .addOption(
      new Option(
        '-o, --output <format>',
        'Output a json on each of the steps of the deployment process. This is useful if the CLI is started from a script or another program.'
      )
        .choices(['text', 'json'])
        .default('text')
    )
    .addOption(
      new Option(
        '-ee, --exit-early',
        'Do not wait for the deployment to finish. The CLI will exit as soon as it has submitted the deployment to the Acurast platform. Note: If environment variables are set, the CLI will have to wait longer.'
      )
    )
    .addOption(
      new Option(
        '-n, --non-interactive',
        'Do not ask for any input. Use this when triggering the CLI in a CD/CI pipeline.'
      )
    )
    .addOption(new Option('-u, --only-upload', 'Only upload to IPFS and quit.'))
    .action(
      async (
        project: string,
        options: {
          dryRun?: boolean
          output: 'text' | 'json'
          exitEarly?: boolean
          // Currently this command has no interactive parts, so this option is not used
          nonInteractive?: boolean
          onlyUpload?: boolean
        }
      ) => {
        const log = consoleOutput(options.output)
        const toAcurastColor = (text: string) => {
          if (options.output === 'json') {
            return text
          }
          return acurastColor(text)
        }
        const DEBUG = getEnv('DEBUG')
        if (DEBUG === 'true' && options) {
          // console.log("Options", options);
        }

        let config
        try {
          config = loadConfig(project)
        } catch (e: any) {
          log(e.message)
          return
        }
        // console.log(config);

        if (!config) {
          throw new Error('No project found')
        }

        const configResult = validateConfig(config)

        if (!configResult.success) {
          log('')
          log('⚠️ Project config is invalid:')
          log('')
          log(configResult.error)

          filelogger.error(
            `Config is invalid ${JSON.stringify(configResult.error)}`
          )

          return
        }

        try {
          validateDeployEnvVars()
        } catch (e: any) {
          filelogger.error(
            `Deploy env vars are invalid ${JSON.stringify(e.message)}`
          )
          log(e.message)
          return
        }

        let envVars: EnvVar[] = []

        try {
          envVars = getProjectEnvVars(config)
        } catch (e: any) {
          filelogger.error(
            `Project env vars are invalid ${JSON.stringify(e.message)}`
          )
          log(e.message)
          return
        }

        log('')
        log(`Deploying project "${config.projectName}"`)
        log('')

        if (configResult.notes) {
          filelogger.warn(
            `Project config is valid, but here are some notes: ${JSON.stringify(
              configResult.notes
            )}`
          )
          log('⚠️ Project config is valid, but here are some notes:')
          configResult.notes.forEach((issue) => {
            log(`- ${issue.message}`)
          })
          log('')
        }

        const spinner = ora.default('Fetching account balance...')
        spinner.start()

        const wallet = await getWallet()

        const rpcEndpoint = getRpcForNetwork(config.network)
        const wsProvider = new WsProvider(rpcEndpoint)
        const api = await ApiPromise.create({
          provider: wsProvider,
          noInitWarn: true,
        })

        const balance = await getBalance(wallet.address, api)

        const symbol = getSymbolForNetwork(config.network)

        filelogger.debug(`Balance: ${balance} ${symbol}`)

        await api.disconnect()

        spinner.stop()

        if (balance === 0) {
          if (config.network === 'canary') {
            log(
              `Your balance is 0. Visit ${toAcurastColor(
                getFaucetLinkForAddress(wallet.address)
              )} to get some tokens.`
            )
          } else {
            log(
              `Your balance is 0. You need ${symbol} tokens to deploy. Visit ${toAcurastColor('https://acurast.com')} to learn how to acquire ${symbol}.`
            )
          }
          log('')
          return
        } else if (balance < 1) {
          if (config.network === 'canary') {
            log(
              `Your balance is low. Visit ${toAcurastColor(
                getFaucetLinkForAddress(wallet.address)
              )} to get some tokens.`
            )
          } else {
            log(
              `Your balance is low. You need more ${symbol} tokens to deploy. Visit ${toAcurastColor('https://acurast.com')} to learn how to acquire ${symbol}.`
            )
          }
          log('')
        }

        log('The CLI will use the following address: ' + wallet.address)
        log('')

        // TODO: Deduplicate this code
        const now = Date.now()
        let startTime = now + DEFAULT_START_DELAY
        if (config.startAt) {
          if (isStartAtMsFromNow(config.startAt)) {
            startTime = now + config.startAt.msFromNow
          }
          if (isStartAtTimestamp(config.startAt)) {
            startTime = new Date(config.startAt.timestamp).getTime()
          }
        }

        if (startTime < now) {
          log(`Start time cannot be in the past`)
          filelogger.error(`Start time cannot be in the past: ${startTime}`)
          return
        }

        filelogger.debug(`Start time: ${startTime}`)

        filelogger.debug(
          `The deployment will be scheduled to start in ${humanTime(now - startTime, true)}. (${new Date(startTime).toLocaleString()}) It will run for ${
            config.execution.type === 'onetime'
              ? humanTime(config.execution.maxExecutionTimeInMs, true)
              : humanTime(
                  config.execution.numberOfExecutions *
                    config.execution.intervalInMs
                )
          }.`
        )

        log(
          `The deployment will be scheduled to start in ${toAcurastColor(
            `${humanTime(now - startTime, true)}`
          )}. (${new Date(startTime).toLocaleString()}) It will run for ${toAcurastColor(
            config.execution.type === 'onetime'
              ? humanTime(config.execution.maxExecutionTimeInMs, true)
              : humanTime(
                  config.execution.numberOfExecutions *
                    config.execution.intervalInMs
                )
          )}.`
        )
        log('')

        const hasEnvironmentVariables: boolean =
          (config.includeEnvironmentVariables?.length ?? 0) > 0

        // --- Pricing check via matcher API ---
        const matcherUrl = getMatcherUrlForNetwork(config.network)
        const isInteractive =
          !options.nonInteractive && options.output === 'text'
        const hasInstantMatch =
          config.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
          config.assignmentStrategy.instantMatch &&
          config.assignmentStrategy.instantMatch.length > 0

        if (hasInstantMatch) {
          log(
            'Instant match processors specified — skipping market pricing check.'
          )
          log('')
        }

        const pricingSpinner = ora.default('Checking processor pricing...')
        const pricingAdvice = await fetchAndDisplayPricing(
          config,
          wallet.address,
          options,
          pricingSpinner
        )

        // Interactive pricing adjustment (deploy-specific)
        if (pricingAdvice && isInteractive && !options.dryRun && matcherUrl) {
          const adjustedPrice = await promptPricingAdjustment(
            pricingAdvice,
            config,
            matcherUrl,
            wallet.address,
            options
          )
          if (adjustedPrice === 'abort') {
            log('Deployment aborted.')
            return
          }
          if (adjustedPrice !== undefined) {
            config.maxCostPerExecution = Number(adjustedPrice)
            log(
              `Updated max cost per execution to ${toAcurastColor(
                new BigNumber(adjustedPrice).shiftedBy(-12).toFixed()
              )} ${symbol}`
            )
            log('')
          }
        }

        if (options.dryRun) {
          filelogger.debug('🧪 Dry run, not deploying.')
          log('🧪 Dry run, not deploying.')
          return
        }

        filelogger.debug('🚀 Deploying...')
        log('🚀 Deploying...')
        log('')

        const originalConfig = structuredClone(config)

        const deploymentTime = new Date()
        let jobRegistrationTemp: JobRegistration | undefined = undefined

        const job = convertConfigToJob(config)

        const jobRegistration = createJob(
          config,
          job,
          rpcEndpoint,
          envVars,
          options.onlyUpload ?? false,
          async (status: DeploymentStatus, data) => {
            // console.log(status, data)
            if (options.output === 'json') {
              log('', JSON.stringify({ status, data }))
            }
            if (status === DeploymentStatus.Uploaded) {
              // ipfsHash
              // console.log(status, data);
            } else if (status === DeploymentStatus.Prepared) {
              // console.log(status, data);
              jobRegistrationTemp = data.job as JobRegistration

              await storeDeployment(
                deploymentTime,
                originalConfig,
                jobRegistrationTemp
              )
            } else if (status === DeploymentStatus.Submit) {
              // txHash
              // console.log(status, data);
            } else if (status === DeploymentStatus.WaitingForMatch) {
              if (!jobRegistrationTemp) {
                throw new Error('Deployment Registration is null!')
              }
              await storeDeployment(
                deploymentTime,
                originalConfig,
                jobRegistrationTemp,
                data.jobIds[0]
              )

              if (
                options.output === 'json' &&
                options.exitEarly &&
                !hasEnvironmentVariables
              ) {
                process.exit(0)
              }
              // jobIds
              // console.log(status, data);
            } else if (status === DeploymentStatus.Matched) {
              // console.log(status, data);
            } else if (status === DeploymentStatus.Acknowledged) {
              // acknowledged
              // console.log(status, data);
            } else if (status === DeploymentStatus.Started) {
              // console.log(status, data);
            } else if (status === DeploymentStatus.EnvironmentVariablesSet) {
              // console.log(status, data);
              if (
                options.output === 'json' &&
                options.exitEarly &&
                hasEnvironmentVariables
              ) {
                process.exit(0)
              }
            } else if (status === DeploymentStatus.ExecutionDone) {
              // console.log(status, data);
            } else if (status === DeploymentStatus.Finalized) {
              // console.log(status, data);
              process.exit(0)
            } else {
              throw new Error('Unknown status')
            }

            if (statusPromises[status]) {
              statusPromises[status].resolve(data)
            }
          }
        )

        type StatusPromises = {
          [key in DeploymentStatus]: {
            promise: Promise<any>
            resolve: (data: any) => void
          }
        }

        const statusPromises: StatusPromises = {
          [DeploymentStatus.Uploaded]: createStatusPromise(),
          [DeploymentStatus.Prepared]: createStatusPromise(),
          [DeploymentStatus.Submit]: createStatusPromise(),
          [DeploymentStatus.WaitingForMatch]: createStatusPromise(),
          [DeploymentStatus.Matched]: createStatusPromise(),
          [DeploymentStatus.Acknowledged]: createStatusPromise(),
          [DeploymentStatus.EnvironmentVariablesSet]: createStatusPromise(),
          [DeploymentStatus.Started]: createStatusPromise(),
          [DeploymentStatus.ExecutionDone]: createStatusPromise(),
          [DeploymentStatus.Finalized]: createStatusPromise(),
        }

        function createStatusPromise() {
          let resolveFunction
          const promise = new Promise<any>((resolve) => {
            resolveFunction = resolve
          })
          return { promise, resolve: resolveFunction! }
        }

        if (options.output === 'text') {
          async function awaitStatus(status: DeploymentStatus) {
            return statusPromises[status].promise
          }

          let count = 1_000_000 // TODO: replace with duration until start time
          let deployingTimer: NodeJS.Timeout
          const cancelUpdateTitle = (
            task: { title?: string | undefined },
            success: boolean
          ) => {
            deployingTimer && clearTimeout(deployingTimer)
            task.title = 'Deploying project'

            if (!success) {
              tasks.tasks.forEach((task) => {
                task.complete()
              })
            }
          }
          const updateTitle = (task: { title?: string | undefined }) => {
            deployingTimer = setTimeout(() => {
              task.title =
                'Deploying project (first execution scheduled in ' +
                count +
                's)'
              // task.title =
              //   'Waiting for executions (first execution scheduled in ' +
              //   count +
              //   's)'
              if (count > 0) {
                count--
                updateTitle(task)
              } else {
                cancelUpdateTitle(task, false)
              }
            }, 1000)
          }

          const tasks = new Listr(
            [
              {
                title: 'Deploying project',
                task: (ctx, deployTask): Listr =>
                  deployTask.newListr([
                    {
                      title: 'Submit to Acurast',
                      task: async (ctx, task): Promise<void> => {
                        const { job } = await awaitStatus(
                          DeploymentStatus.Prepared
                        )

                        count = Math.floor(
                          (job.schedule.startTime - Date.now()) / 1000
                        )

                        updateTitle(tasks.tasks[0])

                        task.title = `Submitted to Acurast (${job.script})`
                      },
                    },
                    {
                      title: 'Waiting for deployment to be registered',
                      task: async (ctx, task): Promise<void> => {
                        await awaitStatus(DeploymentStatus.Submit)

                        const { jobIds } = await awaitStatus(
                          DeploymentStatus.WaitingForMatch
                        )

                        task.title =
                          'Deployment registered' +
                          ` (ID: ${jobIds
                            .map((jobId: any) => jobId[1])
                            .join(' | ')})`
                      },
                    },
                    {
                      title:
                        'Waiting for deployment to be matched with processors',
                      enabled: () =>
                        !options.exitEarly ||
                        (options.exitEarly && hasEnvironmentVariables),
                      task: async (ctx, task): Promise<void> => {
                        await awaitStatus(DeploymentStatus.Matched)
                        task.title = 'Matched'
                      },
                    },
                    {
                      title: 'Waiting for processor acknowledgements',
                      enabled: () =>
                        !options.exitEarly ||
                        (options.exitEarly && hasEnvironmentVariables),
                      task: (ctx, task): Listr =>
                        task.newListr(
                          [
                            {
                              title: `Acknowledged by 0/${config.numberOfReplicas}`,
                              task: async (ctx, task): Promise<void> => {
                                filelogger.info(
                                  `Waiting for processor acknowledgements: ${config.numberOfReplicas} expected`
                                )
                                let allAcknowledged = false
                                // while (!allAcknowledged) {
                                // TODO: Make reactive
                                const { acknowledged } = await awaitStatus(
                                  DeploymentStatus.Acknowledged
                                )

                                filelogger.info(
                                  `Acknowledged by ${acknowledged}/${config.numberOfReplicas}`
                                )
                                task.title = `Acknowledged by ${acknowledged}/${config.numberOfReplicas}`
                                // }
                              },
                            },
                            // {
                            //   title: 'DEMO: 5Ffda...fdkga',
                            //   task: async (ctx, task): Promise<void> => {
                            //     await delay(3000)
                            //   },
                            // },
                            // {
                            //   title: 'DEMO: 5Dcar...gdahs',
                            //   task: async (ctx, task): Promise<void> => {
                            //     await delay(2000)
                            //     throw new Error(
                            //       task.title + ' Processor did not acknowledge'
                            //     )
                            //   },
                            // },
                            // {
                            //   title: 'DEMO: 5Dacs...lwpfd',
                            //   task: async (ctx, task): Promise<void> => {
                            //     await delay(1000)
                            //   },
                            // },
                          ],
                          { concurrent: true, exitOnError: true }
                        ),
                    },
                    {
                      title: 'Setting environment variables',
                      enabled: () => hasEnvironmentVariables,
                      task: async (ctx, task): Promise<void> => {
                        const { envVars } = await awaitStatus(
                          DeploymentStatus.EnvironmentVariablesSet
                        )
                        task.title = `Environment variables set`
                      },
                    },
                  ]),
              },
              // {
              //   title:
              //     'Waiting for executions (this may take a while, feel free to cancel this task and check back later)',
              //   task: (ctx, task): Listr =>
              //     task.newListr(
              //       [
              //         {
              //           title: 'Waiting for Execution',
              //           task: async (ctx, task): Promise<void> => {
              //             await delay(3000)
              //             task.title = 'DEMO: Execution succeeded'
              //           },
              //         },
              //         {
              //           title: 'Waiting for Execution',
              //           task: async (ctx, task): Promise<void> => {
              //             await delay(3000)
              //             throw new Error('DEMO: Execution failed')
              //           },
              //         },
              //       ],
              //       { exitOnError: false }
              //     ),
              // },
              // {
              //   title: 'Waiting for job to Finalize',
              //   task: async (ctx, task): Promise<void> => {
              //     await delay(3000)
              //     task.title = 'Finalized'
              //   },
              // },
            ],
            { concurrent: false, rendererOptions: { collapseSubtasks: false } }
          )

          jobRegistration
            .then((job) => {
              // console.log(job);
            })
            .catch((err) => {
              // console.error(err)
              // if (err.message) {
              //   throw new Error(err.message)
              // }
              throw err
            })
          try {
            await tasks.run()

            process.exit(0)
          } catch (e) {
            console.log('Error', e)
            process.exit(1)
          }
        }
      }
    )
}
