import {
  AcurastProjectConfig,
  AssignmentStrategyVariant,
  JobRegistration,
} from '../types.js'

export const second = 1000
export const minute = 60 * second
export const hour = 60 * minute
export const day = 24 * hour

export const DEFAULT_DURATION_MS = 10_000
export const DEFAULT_REPLICAS = 1
export const DEFAULT_REWARD = 100_000_000_000
export const DEFAULT_MAX_ALLOWED_START_DELAY_MS = 10_000
export const DEFAULT_PROCESSOR_REPUTATION = 0

export const DEFAULT_START_DELAY = 5 * minute

export function isStartAtMsFromNow(
  startAt: { msFromNow: number } | { timestamp: string | number }
): startAt is { msFromNow: number } {
  return (startAt as { msFromNow: number }).msFromNow !== undefined
}

export function isStartAtTimestamp(
  startAt: { msFromNow: number } | { timestamp: string | number }
): startAt is { timestamp: string | number } {
  return (startAt as { timestamp: string | number }).timestamp !== undefined
}

export const convertConfigToJob = (
  config: AcurastProjectConfig
): JobRegistration => {
  const slots = config.numberOfReplicas ?? DEFAULT_REPLICAS
  const rewardPerExecution = config.maxCostPerExecution ?? DEFAULT_REWARD
  const startDelay =
    config.maxAllowedStartDelayInMs ?? DEFAULT_MAX_ALLOWED_START_DELAY_MS
  const processorReputation =
    config.minProcessorReputation ?? DEFAULT_PROCESSOR_REPUTATION

  const now = Date.now()

  let startTime = now + DEFAULT_START_DELAY
  if (config.startAt) {
    if (isStartAtMsFromNow(config.startAt)) {
      startTime = now + config.startAt.msFromNow
    }
    if (isStartAtTimestamp(config.startAt)) {
      startTime = new Date(config.startAt.timestamp).getTime()
    }
  }

  let duration: number | undefined
  let endTime: number | undefined
  let interval: number | undefined

  if (config.execution.type === 'onetime') {
    duration = config.execution.maxExecutionTimeInMs ?? DEFAULT_DURATION_MS
    endTime = startTime + duration + 1 // +1 because end time needs to be greater than start time + duration
    interval = endTime - startTime
  } else if (config.execution.type === 'interval') {
    interval = config.execution.intervalInMs
    endTime =
      startTime +
      config.execution.intervalInMs * config.execution.numberOfExecutions +
      1
    duration =
      config.execution.maxExecutionTimeInMs ?? config.execution.intervalInMs - 1
  } else {
    throw new Error('Invalid execution type')
  }

  const assignmentStrategy =
    config.assignmentStrategy.type === AssignmentStrategyVariant.Single
      ? {
          variant: AssignmentStrategyVariant.Single,
          instantMatch: config.assignmentStrategy.instantMatch?.map((item) => ({
            source: item.processor,
            startDelay: item.maxAllowedStartDelayInMs,
          })),
        }
      : { variant: AssignmentStrategyVariant.Competing }

  return {
    script: config.fileUrl,
    allowedSources:
      config.processorWhitelist && config.processorWhitelist.length > 0
        ? config.processorWhitelist
        : undefined, // Array of processors, whitelist who can execute this job
    allowOnlyVerifiedSources: config.onlyAttestedDevices, // Only allow processors that are attested to execute this job
    schedule: {
      duration, // How is this calculated? Is it cheaper if its shorter?
      startTime,
      endTime,
      interval,
      maxStartDelay: startDelay,
    },
    memory: config.usageLimit.maxMemory,
    networkRequests: config.usageLimit.maxNetworkRequests,
    storage: config.usageLimit.maxStorage,
    requiredModules: config.requiredModules,
    extra: {
      requirements: {
        assignmentStrategy,
        slots: slots,
        reward: rewardPerExecution,
        minReputation: processorReputation,
      },
    },
  }
}
