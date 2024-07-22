import '@polkadot/api-augment'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { KeyringPair } from '@polkadot/keyring/types'
import { uploadScript } from './uploadToIpfs.js'
import { getEnv } from '../config.js'
import {
  AcurastProjectConfig,
  AssignmentStrategyVariant,
  JobRegistration,
} from '../types.js'
import { convertConfigToJob } from './convertConfigToJob.js'
import { DeploymentStatus } from './types.js'
import { registerJob } from './registerJob.js'

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

  const keyring = new Keyring({ type: 'sr25519' })
  const wallet = keyring.addFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
    name: 'AcurastCli',
  })

  const ipfsHash = await uploadScript({ file: config.fileUrl })

  statusCallback(DeploymentStatus.Uploaded, { ipfsHash })
  config.fileUrl = ipfsHash

  const job = convertConfigToJob(config)

  statusCallback(DeploymentStatus.Prepared, { job })

  const result = await registerJob(api, wallet, job, statusCallback)

  statusCallback(DeploymentStatus.Submit, { txHash: result })
}
