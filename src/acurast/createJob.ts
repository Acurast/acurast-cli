import '@polkadot/api-augment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { uploadScript } from './uploadToIpfs.js'
import { AcurastProjectConfig, JobRegistration } from '../types.js'
import { convertConfigToJob } from './convertConfigToJob.js'
import { DeploymentStatus } from './types.js'
import { registerJob } from './registerJob.js'
import { getWallet } from '../util/getWallet.js'
import type { EnvVar, JobId } from './env/types.js'
import { setEnvVars } from '../util/setEnvVars.js'

export const createJob = async (
  config: AcurastProjectConfig,
  rpc: string,
  envVars: EnvVar[],
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

  const ipfsHash = await uploadScript({ file: config.fileUrl })

  statusCallback(DeploymentStatus.Uploaded, { ipfsHash })
  config.fileUrl = ipfsHash

  const job = convertConfigToJob(config)

  statusCallback(DeploymentStatus.Prepared, { job })

  let envHasBeenSet = false

  const TWO_MINUTES = 2 * 60 * 1000

  let timeout: NodeJS.Timeout | undefined

  let jobId: JobId | undefined
  // We want to wrap the status callback to set the environment variables
  const statusCallbackWrapper = (
    status: DeploymentStatus,
    data?: JobRegistration | any
  ) => {
    if (status === DeploymentStatus.WaitingForMatch) {
      jobId = data.jobIds[0]
    }
    if (status === DeploymentStatus.Acknowledged) {
      if (envHasBeenSet) {
        // console.log('ENV HAS BEEN SET, BUT NEW ACKS HAVE BEEN RECEIVED')
        return statusCallback(status, data)
      }

      const timeToJobStart = job.schedule.startTime - Date.now()

      const setEnv = () => {
        envHasBeenSet = true
        timeout = undefined
        // console.log('SETTING ENV')

        if (!jobId) {
          throw new Error('DeploymentId not set')
        }

        const envs = setEnvVars({
          id: jobId,
          registration: job,
          envVars,
        })
        statusCallback(DeploymentStatus.EnvironmentVariablesSet, envs)
      }

      // If start time is within specified timeframe, set env vars now, regardless if all acks are here.
      if (timeToJobStart <= TWO_MINUTES) {
        // console.log('START IS SOON TRIGGERED')
        setEnv()
        return statusCallback(status, data)
      }

      // If start time is in the future, set timout to 2 mins before start time
      if (!timeout) {
        timeout = setTimeout(() => {
          // console.log('TIMEOUT TRIGGERED')
          setEnv()
        }, timeToJobStart - TWO_MINUTES)
      }

      if (data.acknowledged >= config.numberOfReplicas) {
        // Now we can set env vars
        // console.log('HAVE ALL ACKS', data)
        setEnv()
      }
    }

    statusCallback(status, data)
  }

  const result = await registerJob(api, wallet, job, statusCallbackWrapper)

  statusCallback(DeploymentStatus.Submit, { txHash: result })
}
