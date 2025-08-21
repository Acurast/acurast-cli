import { convertConfigToJob } from '../acurast/convertConfigToJob.js'
import type { AcurastProjectConfig } from '../types.js'
import { suggestCostPerExecution } from './suggestCostPerExecution.js'
import { BigNumber } from 'bignumber.js'

const ACURAST_DECIMALS: number = 12
export const toCacu = (satoshi: BigNumber) =>
  satoshi.shiftedBy(-ACURAST_DECIMALS)

export const getFeeAnalysis = (config: AcurastProjectConfig) => {
  const job = convertConfigToJob(config)

  const suggestedCostPerExecution = BigNumber(
    suggestCostPerExecution(job.schedule.duration, job.storage)
  )

  const maxCostPerExecution = BigNumber(config.maxCostPerExecution)
  const suggestedCostPerExecutionBN = BigNumber(suggestedCostPerExecution)

  const excessCostPerExecutionBN = maxCostPerExecution.minus(
    suggestedCostPerExecutionBN
  )

  const excessCostPerExecutionPercentage = excessCostPerExecutionBN.dividedBy(
    suggestedCostPerExecutionBN
  )

  const numberOfExecutions = BigNumber(
    config.execution.type === 'onetime'
      ? 1
      : config.execution.numberOfExecutions
  )

  const numberOfReplicas = BigNumber(config.numberOfReplicas)

  const maxCostPerExecutionPerReplica =
    maxCostPerExecution.times(numberOfExecutions)
  const maxCostPerExecutionPerReplicaCACU = toCacu(
    maxCostPerExecutionPerReplica
  )

  const totalCost = numberOfReplicas.times(maxCostPerExecutionPerReplica)

  const maxCostPerExecutionCACU = toCacu(maxCostPerExecution)

  const maxTotalCostCACU = toCacu(totalCost)

  const totalRuns = numberOfExecutions.times(numberOfReplicas)

  return {
    project: config.projectName,
    numberOfExecutions,
    numberOfReplicas,
    totalRuns,
    maxCostPerExecution,
    maxCostPerExecutionCACU,
    maxCostPerExecutionPerReplica,
    maxCostPerExecutionPerReplicaCACU,
    maxTotalCostCACU,
    excessCostPerExecution: excessCostPerExecutionBN,
    excessCostPerExecutionPercentage,
    suggestedCostPerExecution,
  }
}
