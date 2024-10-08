import { AcurastService } from '../acurast/env/acurastService.js'
import { JobEnvironmentService } from '../acurast/env/jobEnvironmentService.js'
import type { EnvVar, Job, JobId } from '../acurast/env/types.js'
import { getWallet } from './getWallet.js'
import { toNumber } from './jobToNumber.js'

export const setEnvVars = async (
  job: Job & { envVars?: EnvVar[] }
): Promise<{ hash?: string }> => {
  const acurast = new AcurastService()
  const wallet = await getWallet()

  const assignedProcessors = await acurast.assignedProcessors([
    [{ Acurast: job.id[0].Acurast }, Number(toNumber(job.id[1] as any))],
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

  const jobEnvironmentService = new JobEnvironmentService()
  const res = await jobEnvironmentService.setEnvironmentVariablesMulti(
    wallet,
    jobAssignmentInfos,
    Number(toNumber(job.id[1] as any)),
    envVars
  )

  return { hash: res.hash }
}
