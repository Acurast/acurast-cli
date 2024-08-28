import { Command, Option } from 'commander'
import { JobEnvHelper } from '../acurast/env/environmentVars.js'
import { AcurastService } from '../acurast/env/acurastService.js'
import { getProjectEnv, getProjectEnvVars, RPC } from '../config.js'
import fs from 'fs'
import { readFilesInDeployFolder } from '../util/readFilesInDeployFolder.js'
import type {
  EnvVar,
  Job,
  JobEnvironmentsEncrypted,
  JobId,
} from '../acurast/env/types.js'
import type { AcurastDeployment } from '../types.js'
import { toNumber } from '../util/jobToNumber.js'
import { JobEnvironmentService } from '../acurast/env/jobEnvironmentService.js'
import { getWallet } from '../util/getWallet.js'
import * as ora from '../util/ora.js'
import { getBalance } from '../util/getBalance.js'
import { ApiPromise, WsProvider } from '@polkadot/api'

export const addCommandDeployments = (program: Command) => {
  program
    .command('deployments [arg]')
    .description('Manage deployments')
    .addOption(
      new Option(
        '-e, --update-env-vars',
        'Load the environment variables of a job and update them.'
      )
    )
    .addOption(
      new Option(
        '-c, --cleanup',
        'Remove old, finished deployments. This will return any unused funds locked in the deployment back to the user.'
      )
    )
    .action(
      async (
        arg: string,
        options: {
          updateEnvVars?: boolean
          cleanup?: boolean
        }
      ) => {
        const acurast = new AcurastService()
        const wallet = await getWallet()
        if (arg === 'ls' || arg === 'list') {
          const spinner = ora.default('Loading deployments...')
          spinner.start()
          const jobs = await acurast.getAllJobs()

          const filteredJobs = jobs
            .filter((job) => job.id[0].Acurast === wallet.address)
            .sort((a, b) => b.id[1] - a.id[1])

          spinner.stop()

          if (filteredJobs.length === 0) {
            console.log('No deployments found')
          } else {
            console.log('You have the following deployments:')

            const now = Date.now()

            filteredJobs.forEach((job) => {
              const status =
                job.registration.schedule.startTime > now
                  ? 'planned'
                  : job.registration.schedule.endTime < now
                    ? 'ended'
                    : 'running'
              console.log(`${job.id[1]} - ${status}`)
            })
          }

          await acurast.disconnect()
          return
        }

        const deploymentId = Number(arg)

        if (options.cleanup) {
          if (deploymentId) {
            const spinner = ora.default(
              `Cleaning up deployment ${deploymentId}...`
            )
            spinner.start()

            await acurast.deregisterJob(wallet, deploymentId)

            spinner.stop()
            console.log(`Done`)
          } else {
            const spinner = ora.default(`Cleaning up old deployments...`)
            spinner.start()
            const jobs = await acurast.getAllJobs()

            const now = Date.now()

            const filteredJobs = jobs
              .filter((job) => job.id[0].Acurast === wallet.address)
              .filter((job) => job.registration.schedule.endTime < now)
              .sort((a, b) => a.id[1] - b.id[1])

            spinner.stop()
            console.log(`Found ${filteredJobs.length} deployments to clean up`)

            const wsProvider = new WsProvider(RPC)
            const api = await ApiPromise.create({
              provider: wsProvider,
              noInitWarn: true,
            })

            let balanceBefore = await getBalance(wallet.address, api)

            for (const job of filteredJobs) {
              spinner.start(`Cleaning up deployment ${job.id[1]}...`)
              await acurast.deregisterJob(wallet, job.id[1])
              const balanceNew = await getBalance(wallet.address, api)
              const diff = balanceNew - balanceBefore
              spinner.succeed(
                `Deployment ${job.id[1]} cleaned up. ${diff > 0 ? `cACU regained: ${diff}` : ``}`
              )
              balanceBefore = balanceNew
            }

            await api.disconnect()

            spinner.stop()
          }
          await acurast.disconnect()
          return
        }

        if (!deploymentId || isNaN(deploymentId)) {
          console.log('Please provide a deployment ID')
          await acurast.disconnect()
          return
        }

        const deploymentFilename = await readFilesInDeployFolder(
          `${toNumber(arg)}.json`
        )

        let job:
          | (Job & {
              envInfo?: {
                localPubKey: string
                envEncrypted: JobEnvironmentsEncrypted
              }
            } & { envVars?: EnvVar[] })
          | undefined

        if (deploymentFilename) {
          // File found, we can read details from file

          const deploymentFileData: AcurastDeployment = JSON.parse(
            fs.readFileSync(`.acurast/deploy/${deploymentFilename}`, 'utf8')
          )

          const envVars = getProjectEnvVars(deploymentFileData.config)

          job = {
            id: deploymentFileData.deploymentId!,
            registration: deploymentFileData.registration,
            envInfo: deploymentFileData.envInfo,
            envVars,
          }
        } else {
          console.log('Could not find deployment file.')
          await acurast.disconnect()
          return
          // const jobs = await acurast.getAllJobs()

          // job = jobs.find((job) => job.id[1] === Number(id))
        }

        if (!job) {
          console.log('Deployment not found')
          return
        }

        if (options.updateEnvVars) {
          console.log(
            'Updating environment variables for deployment',
            deploymentId
          )

          const assignedProcessors = await acurast.assignedProcessors([
            [
              { Acurast: job.id[0].Acurast },
              Number(toNumber(job.id[1] as any)),
            ],
          ])
          const keys: [string, JobId][] = Array.from(
            assignedProcessors.entries()
          ).flatMap(([_, [jobId, processors]]) =>
            processors.map((account) => [account, jobId])
          )

          const jobAssignmentInfos = await acurast.jobAssignments(keys)

          const envVars = job.envVars ?? []

          if (envVars.length === 0) {
            console.log(
              'No environment variables found for deployment',
              deploymentId
            )
            return
          }

          const jobEnvironmentService = new JobEnvironmentService()
          const res = await jobEnvironmentService.setEnvironmentVariablesMulti(
            wallet,
            jobAssignmentInfos,
            deploymentId,
            envVars
          )

          acurast.disconnect()

          console.log('Environment variables set, tx ID:', res.hash)

          // If no file found, have user select the deployment config to be used

          // TODO: Introduce a flag in .env to store or not store encryption key.
          // TODO: Setting of .env var flag should be stored in deployment file
        } else {
          if (job.id) {
            console.log('Click here to open the deployment in your browser:')
            console.log(
              `https://console.acurast.com/job-detail/acurast-${job.id[0].Acurast}-${deploymentId}`
            )
          }

          console.log('Deployment:', job)

          acurast.disconnect()

          return
        }
      }
    )
}
