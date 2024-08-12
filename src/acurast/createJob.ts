import '@polkadot/api-augment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { uploadScript } from './uploadToIpfs.js'
import { AcurastProjectConfig, JobRegistration } from '../types.js'
import { convertConfigToJob } from './convertConfigToJob.js'
import { DeploymentStatus } from './types.js'
import { registerJob } from './registerJob.js'
import { getWallet } from '../util/getWallet.js'
import type { EnvVar, JobId } from './env/types.js'
import { JobEnvironmentService } from './env/jobEnvironmentService.js'
import { JobEnvHelper } from './env/environmentVars.js'

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

  // We want to wrap the status callback to set the environment variables
  const statusCallbackWrapper = (
    status: DeploymentStatus,
    data?: JobRegistration | any
  ) => {
    if (status === DeploymentStatus.WaitingForMatch) {
      console.log('WRAPPER', status, data)
      const envVarsService = new JobEnvHelper()

      data.jobIds.forEach((jobId: JobId) => {
        envVarsService.setEnvVars({ id: jobId, registration: job }, envVars)
      })
    }

    statusCallback(status, data)
  }

  const result = await registerJob(api, wallet, job, statusCallbackWrapper)

  statusCallback(DeploymentStatus.Submit, { txHash: result })
}
