import { ApiPromise } from '@polkadot/api'
import type { JobAssignment, JobAssignmentInfo, JobId } from './env/types.js'
import { BigNumber } from 'bignumber.js'
import { Codec } from '@polkadot/types/types'

export const jobAssignments = async (
  api: ApiPromise,
  keys: [string, JobId][]
): Promise<JobAssignmentInfo[]> => {
  const assignments =
    await api.query['acurastMarketplace']['storedMatches'].multi(keys)

  const values = api.registry.createType(
    'Vec<Option<PalletAcurastMarketplaceAssignment>>',
    assignments
  )
  const result: (JobAssignmentInfo | undefined)[] = values
    .map((value, index) => {
      if (value.isSome) {
        const assignment = value.unwrap()
        return {
          id: keys[index][1],
          processor: keys[index][0],
          assignment: codecToJobAssignment(assignment),
        }
      }
      return undefined
    })
    .filter((value) => value !== undefined)
  return result as JobAssignmentInfo[]
}

const codecToJobAssignment = (codec: Codec): JobAssignment => {
  const json = codec.toJSON() as any
  return {
    slot: json.slot,
    startDelay: json.startDelay,
    feePerExecution: new BigNumber(json.feePerExecution),
    acknowledged: json.acknowledged,
    sla: {
      total: new BigNumber(json.sla.total),
      met: new BigNumber(json.sla.met),
    },
    pubKeys: json.pubKeys.map((value: any) => ({
      SECP256r1: value.secp256r1,
      SECP256k1: value.secp256k1,
      ED25519: value.ed25519,
      SECP256r1Encryption: value.secp256r1Encryption,
      SECP256k1Encryption: value.secp256k1Encryption,
    })),
    execution: {
      All: json.execution.all,
      Index: json.execution.index,
    },
  }
}

export const getAcknowledgedProcessors = async (
  api: ApiPromise,
  jobId: JobId
): Promise<JobAssignmentInfo[]> => {
  // First get all assigned processors
  const assignedProcessors =
    await api.query['acurastMarketplace']['assignedProcessors'].entries(jobId)

  // Create keys array for jobAssignments
  const keys: [string, JobId][] = assignedProcessors.map(([key, _]) => {
    const processor = api.createType('AccountId', key.args[1])
    return [processor.toString(), jobId]
  })

  // Get detailed assignment info
  const assignments = await jobAssignments(api, keys)

  return assignments

  // // Filter for acknowledged assignments and return processor addresses
  // return assignments
  //   .filter((info) => info.assignment.acknowledged)
  //   .map((info) => info.processor)
}
