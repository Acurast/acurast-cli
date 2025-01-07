import type { JobId } from '../acurast/env/types.js'

export const jobToNumber = (job: JobId) => {
  return toNumber(job[1].toString())
}

export const toNumber = (jobId: string | number) => {
  if (typeof jobId === 'number') {
    return jobId
  }
  return jobId.split(',').join('')
}
