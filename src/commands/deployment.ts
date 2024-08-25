import { Command, Option } from 'commander'
import { JobEnvHelper } from '../acurast/env/environmentVars.js'
import { AcurastService } from '../acurast/env/acurastService.js'
import { getProjectEnv, getProjectEnvVars } from '../config.js'
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

export const addCommandDeployment = (program: Command) => {
  program
    .command('deployment [id]')
    .description('Open Acurast websites in your browser')
    .addOption(
      new Option(
        '-e, --update-env-vars',
        'Load the environment variables of a job and update them.'
      )
    )
    .action(
      async (
        id: string,
        options: {
          updateEnvVars?: boolean
        }
      ) => {
        if (!id) {
          console.log('Please provide a deployment ID')
          return
        }

        const acurast = new AcurastService()

        const deploymentFilename = await readFilesInDeployFolder(
          `${toNumber(id)}.json`
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
          return
          // const jobs = await acurast.getAllJobs()

          // job = jobs.find((job) => job.id[1] === Number(id))
        }

        if (!job) {
          console.log('Job not found')
          return
        }

        if (options.updateEnvVars) {
          console.log('Updating environment variables for deployment', id)

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

          const wallet = await getWallet()

          const envVars = job.envVars ?? []

          if (envVars.length === 0) {
            console.log('No environment variables found for deployment', id)
            return
          }

          const jobEnvironmentService = new JobEnvironmentService()
          const res = await jobEnvironmentService.setEnvironmentVariablesMulti(
            wallet,
            jobAssignmentInfos,
            Number(id),
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
              `https://console.acurast.com/job-detail/acurast-${job.id[0].Acurast}-${id}`
            )
          }

          console.log('Deployment:', job)

          acurast.disconnect()

          return
        }
      }
    )
}
