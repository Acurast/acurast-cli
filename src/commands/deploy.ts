import { Command, Option } from 'commander'
import { loadConfig } from '../acurast/loadConfig.js'
import { getEnv, validateDeployEnvVars } from '../config.js'
import { delay, Listr } from 'listr2'
import { DeploymentStatus, createJob } from '../acurast/createJob.js'
import { storeDeployment } from '../acurast/storeDeployment.js'
import { acurastColor } from '../util.js'
import { humanTime } from '../util/humanTime.js'
import {
  DEFAULT_START_DELAY,
  isStartAtMsFromNow,
  isStartAtTimestamp,
} from '../acurast/convertConfigToJob.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
        '-l, --live, --live-code',
        'Run the deploy step and run it on in a live coding environment on a processor.'
      )
    )
    .action(
      async (
        project: string,
        options: { dryRun?: boolean; live?: boolean }
      ) => {
        const DEBUG = getEnv('DEBUG')
        if (DEBUG === 'true' && options) {
          // console.log("Options", options);
        }

        if (options.live) {
          console.log('Live coding not implemented yet')
          return
        }

        validateDeployEnvVars() // TODO: Also check the environment variables that need to be added to the deployment

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

        console.log()
        console.log(`Deploying project "${config.projectName}"`)
        console.log()

        if (config.startAt) {
        }

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
          console.log(`Start time cannot be in the past`)
          return
        }

        console.log(
          `The deployment will be scheduled to start in ${acurastColor(`${humanTime(now - startTime, true)}`)}.`
        )
        console.log()

        const numberOfExecutions =
          config.execution.type === 'onetime'
            ? 1
            : config.execution.numberOfExecutions
        console.log(
          `There will be ${acurastColor(
            numberOfExecutions.toString()
          )} executions with a cost of ${acurastColor(
            (
              (config.maxCostPerExecution *
                config.numberOfReplicas *
                numberOfExecutions) /
              1_000_000_000_000
            ).toString()
          )} cACU each.`
        )
        console.log()

        if (options.dryRun) {
          console.log('🧪 Dry run, not deploying.')
          return
        }

        // const spinner = ora.default("Deploying project");
        // spinner.start();
        // setTimeout(() => {
        //   // spinner.succeed("Project deployed");

        // }, 2000);

        const originalConfig = structuredClone(config)

        const jobRegistration = createJob(
          config,
          (status: DeploymentStatus, data) => {
            if (status === DeploymentStatus.Uploaded) {
              // ipfsHash
              // console.log(status, data);
            } else if (status === DeploymentStatus.Prepared) {
              // console.log(status, data);
              storeDeployment(originalConfig, data.job)
            } else if (status === DeploymentStatus.Submit) {
              // txHash
              // console.log(status, data);
            } else if (status === DeploymentStatus.WaitingForMatch) {
              // jobIds
              // console.log(status, data);
            } else if (status === DeploymentStatus.Matched) {
              // console.log(status, data);
            } else if (status === DeploymentStatus.Acknowledged) {
              // acknowledged
              // console.log(status, data);
            } else if (status === DeploymentStatus.Started) {
              // console.log(status, data);
            } else if (status === DeploymentStatus.ExecutionDone) {
              // console.log(status, data);
            } else if (status === DeploymentStatus.Finalized) {
              // console.log(status, data);
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
              'Deploying project (first execution scheduled in ' + count + 's)'
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
                    task: async (ctx, task): Promise<void> => {
                      await awaitStatus(DeploymentStatus.Matched)
                      task.title = 'Matched'
                    },
                  },
                  {
                    title: 'Waiting for processor acknowledgements',
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
        } catch (e) {
          console.log('Error', e)
        }
      }
    )
}
