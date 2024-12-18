import { appendFileSync } from 'fs'
import { AcurastService } from '../acurast/env/acurastService.js'
import { JobEnvironmentService } from '../acurast/env/jobEnvironmentService.js'
import type { EnvVar, Job, JobId } from '../acurast/env/types.js'
import { getWallet } from './getWallet.js'
import { toNumber } from './jobToNumber.js'
import { KeyringPair } from '@polkadot/keyring/types'

export const setEnvVars = async (
  job: Job & { envVars?: EnvVar[] },
  wallet?: KeyringPair
): Promise<{ hash?: string }> => {
  const acurast = new AcurastService()
  // If a wallet is not provided, get the one from the environment configuration
  wallet ||= await getWallet()

  const assignedProcessors = await acurast.assignedProcessors([
    [{ acurast: job.id[0].acurast }, Number(toNumber(job.id[1]))],
  ])

  const keys: [string, JobId][] = Array.from(
    assignedProcessors.entries()
  ).flatMap(([_, [jobId, processors]]) =>
    processors.map((account) => [account, jobId])
  )

  const jobAssignmentInfos = await acurast.jobAssignments(keys)

  const envVars = job.envVars ?? []

  if (envVars.length === 0) {
    console.log('No environment variables found for deployment', job.id[1])
    return {}
  }

  if (
    jobAssignmentInfos.length === 0 ||
    jobAssignmentInfos.every((info) => info.assignment.pubKeys.length === 0)
  ) {
    // If no pubkeys are present, it means that the match is done, but has not been acknowledged.
    // We wait a little and try again.
    await new Promise((resolve) => setTimeout(resolve, 30_000))

    return setEnvVars(job)
  }

  const jobEnvironmentService = new JobEnvironmentService()
  const res = await jobEnvironmentService.setEnvironmentVariablesMulti(
    wallet,
    jobAssignmentInfos,
    Number(toNumber(job.id[1] as any)),
    envVars
  )

  return { hash: res.hash }
}
