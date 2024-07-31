import { Command, Option } from 'commander'
import { loadConfig } from '../acurast/loadConfig.js'
import { getEnv, validateDeployEnvVars } from '../config.js'
import { delay, Listr } from 'listr2'
import { createJob } from '../acurast/createJob.js'
import { storeDeployment } from '../acurast/storeDeployment.js'
import { acurastColor } from '../util.js'
import { humanTime } from '../util/humanTime.js'
import {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const RPC = 'wss://canarynet-ws-1.acurast-h-server-2.papers.tech'

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
    .action(
      async (
        project: string,
        options: {
          dryRun?: boolean
          output: 'text' | 'json'
          exitEarly?: boolean
          // Currently this command has no interactive parts, so this option is not used
          nonInteractive?: boolean
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

          return
        }

        try {
          validateDeployEnvVars() // TODO: Also check the environment variables that need to be added to the deployment
        } catch (e: any) {
          log(e.message)
          return
        }

        log('')
        log(`Deploying project "${config.projectName}"`)
        log('')

        if (configResult.notes) {
          log('⚠️ Project config is valid, but here are some notes:')
          configResult.notes.forEach((issue) => {
            log(`- ${issue.message}`)
          })
          log('')
        }

        const spinner = ora.default('Fetching account balance...')
        spinner.start()

        const wallet = await getWallet()

        const wsProvider = new WsProvider(RPC)
        const api = await ApiPromise.create({
          provider: wsProvider,
          noInitWarn: true,
        })

        const balance = await getBalance(wallet.address, api)

        await api.disconnect()

        spinner.stop()

        if (balance === BigInt(0)) {
          log(
            `Your balance is 0. Visit ${toAcurastColor(
              getFaucetLinkForAddress(wallet.address)
            )} to get some tokens.`
          )
          log('')
          return
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
          return
        }

        log(
          `The deployment will be scheduled to start in ${toAcurastColor(`${humanTime(now - startTime, true)}`)}.`
        )
        log('')

        const hasEnvironmentVariables: boolean =
          (config.includeEnvironmentVariables?.length ?? 0) > 0

        const numberOfExecutions =
          config.execution.type === 'onetime'
            ? 1
            : config.execution.numberOfExecutions
        log(
          `There will be ${toAcurastColor(
            numberOfExecutions.toString()
          )} executions with a cost of ${toAcurastColor(
            (
              (config.maxCostPerExecution *
                config.numberOfReplicas *
                numberOfExecutions) /
              1_000_000_000_000
            ).toString()
          )} cACU each.`
        )
        log('')

        if (options.dryRun) {
          log('🧪 Dry run, not deploying.')
          return
        }

        const originalConfig = structuredClone(config)

        const jobRegistration = createJob(
          config,
          RPC,
          async (status: DeploymentStatus, data) => {
            if (options.output === 'json') {
              log('', JSON.stringify({ status, data }))
            }
            if (status === DeploymentStatus.Uploaded) {
              // ipfsHash
              // console.log(status, data);
            } else if (status === DeploymentStatus.Prepared) {
              // console.log(status, data);
              await storeDeployment(originalConfig, data.job)
            } else if (status === DeploymentStatus.Submit) {
              // txHash
              // console.log(status, data);
            } else if (status === DeploymentStatus.WaitingForMatch) {
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

          jobRegistration
            .then((job) => {
              // console.log(job);
            })
            .catch((err) => {
              console.error(err)
            })

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
                          ` (JobID: ${jobIds
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
                                let allAcknowledged = false
                                // while (!allAcknowledged) {
                                // TODO: Make reactive
                                const { acknowledged } = await awaitStatus(
                                  DeploymentStatus.Acknowledged
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
                          { concurrent: true, exitOnError: false }
                        ),
                    },
                    {
                      title: 'Setting environment variables (NOT IMPLEMENTED)',
                      enabled: () => hasEnvironmentVariables,
                      task: async (ctx, task): Promise<void> => {
                        delay(1000)
                        // const { envVars } = await awaitStatus(
                        //   DeploymentStatus.EnvironmentVariablesSet
                        // );
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

          try {
            await tasks.run()

            process.exit(0)
          } catch (e) {
            console.log('Error', e)
          }
        }
      }
    )
}
