import '@polkadot/api-augment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { uploadScript } from './uploadToIpfs.js'
import { AcurastProjectConfig, JobRegistration } from '../types.js'
import { convertConfigToJob } from './convertConfigToJob.js'
import { DeploymentStatus } from './types.js'
import { registerJob } from './registerJob.js'
import { getWallet } from '../util/getWallet.js'

export const createJob = async (
  config: AcurastProjectConfig,
  rpc: string,
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

  const result = await registerJob(api, wallet, job, statusCallback)

  statusCallback(DeploymentStatus.Submit, { txHash: result })
}
