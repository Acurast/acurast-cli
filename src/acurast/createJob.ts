import '@polkadot/api-augment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { uploadScript } from './uploadToIpfs.js'
import {
  AcurastProjectConfig,
  JobRegistration,
  RestartPolicy,
} from '../types.js'
import { DeploymentStatus } from './types.js'
import { registerJob } from './registerJob.js'
import { getWallet } from '../util/getWallet.js'
import type { EnvVar, JobId } from './env/types.js'
import { setEnvVars } from '../util/setEnvVars.js'
import { filelogger } from '../util/fileLogger.js'
import { zipFolder } from '../util/zipFolder.js'
import { createManifest } from '../util/createManifest.js'
import { checkIsFolder } from '../util/checkIsFolder.js'
import { basename } from 'node:path'

const BUNDLE_FOLDER = '.acurast/bundles'

export const createJob = async (
  config: AcurastProjectConfig,
  job: JobRegistration,
  rpc: string,
  envVars: EnvVar[],
  onlyUpload: boolean,
  statusCallback: (
    status: DeploymentStatus,
    data?: JobRegistration | any
  ) => void
) => {
  const wsProvider = new WsProvider(rpc)
  const api = await ApiPromise.create({
    provider: wsProvider,
    noInitWarn: true,
  })

  const wallet = await getWallet()

  let ipfsHash: string | undefined

  if (config.fileUrl.startsWith('ipfs://')) {
    ipfsHash = config.fileUrl
    filelogger.debug(`config.fileUrl is an IPFS hash, so we this: ${ipfsHash}`)
  } else {
    filelogger.debug(
      `config.fileUrl is not an IPFS hash, so we zip it: ${config.fileUrl}`
    )

    // Check if the fileUrl is a folder
    const isFolder = await checkIsFolder(config.fileUrl)
    if (isFolder) {
      if (!config.entrypoint) {
        filelogger.error('entrypoint is required for folders')
        throw new Error('entrypoint is required for folders')
      }
      filelogger.debug(
        `config.fileUrl is a folder, so we use the entrypoint: ${config.entrypoint}`
      )
    }

    let { zipPath } = await zipFolder(
      config.fileUrl,
      BUNDLE_FOLDER,
      createManifest(
        config.projectName,
        config.entrypoint ?? basename(config.fileUrl),
        config.restartPolicy ?? RestartPolicy.OnFailure
      ),
      config.projectName
    )

    filelogger.log(`zipPath ${zipPath}`)

    ipfsHash = await uploadScript({ file: zipPath })

    filelogger.debug(`ipfsHash: ${ipfsHash}`)
  }

  statusCallback(DeploymentStatus.Uploaded, { ipfsHash })
  config.fileUrl = ipfsHash
  job.script = ipfsHash

  statusCallback(DeploymentStatus.Prepared, { job })

  let envHasBeenSet = false

  const TWO_MINUTES = 2 * 60 * 1000

  let timeout: NodeJS.Timeout | undefined

  if (!onlyUpload) {
    let jobId: JobId | undefined
    // We want to wrap the status callback to set the environment variables
    const statusCallbackWrapper = (
      status: DeploymentStatus,
      data?: JobRegistration | any
    ) => {
      if (status === DeploymentStatus.WaitingForMatch) {
        jobId = data.jobIds[0]
        if (jobId) {
          filelogger.setJobId(jobId)
        }
      }
      if (status === DeploymentStatus.Acknowledged) {
        if (envHasBeenSet) {
          filelogger.log(
            'Setting Environment Variables: Env has been set, but new acks have been received.'
          )
          return statusCallback(status, data)
        }

        const timeToJobStart = job.schedule.startTime - Date.now()

        const setEnv = async () => {
          envHasBeenSet = true
          if (timeout) {
            clearTimeout(timeout)
          }

          timeout = undefined
          filelogger.debug(
            'Setting Environment Variables: Preparing transaction'
          )

          if (!jobId) {
            filelogger.error('Setting Environment Variables: JobId not set')
            throw new Error('DeploymentId not set')
          }

          const envs = await setEnvVars({
            id: jobId,
            registration: job,
            envVars,
          })

          filelogger.debug(
            `Setting Environment Variables: Done ${envs.hash ? `(hash: ${envs.hash})` : ''}`
          )
          statusCallback(DeploymentStatus.EnvironmentVariablesSet, envs)
        }

        if (data.acknowledged >= config.numberOfReplicas) {
          // Now we can set env vars
          filelogger.debug(
            'Setting Environment Variables: Have all acknowledgements, so we can set the env vars now.'
          )
          setEnv()
        } else {
          // If start time is within specified timeframe, set env vars now, regardless if all acks are here.
          if (timeToJobStart <= TWO_MINUTES) {
            filelogger.debug(
              'Setting Environment Variables: Start is scheduled within 2 minutes, so we do it now.'
            )
            setEnv()
          } else {
            // If start time is in the future, set timeout to 2 mins before start time
            if (!timeout) {
              filelogger.debug(
                `Setting Environment Variables: Start is in the future, timeout will trigger in ${
                  timeToJobStart - TWO_MINUTES
                }ms, 2 minutes before start time.`
              )
              timeout = setTimeout(() => {
                filelogger.debug(
                  'Setting Environment Variables: Was in the future, timeout was awaited, now it will be set.'
                )
                setEnv()
              }, timeToJobStart - TWO_MINUTES)
            }
          }
        }
      }

      statusCallback(status, data)
    }

    const result = await registerJob(api, wallet, job, statusCallbackWrapper)

    statusCallback(DeploymentStatus.Submit, { txHash: result })
  }

  return job
}
