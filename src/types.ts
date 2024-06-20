export interface AcurastProjectConfig {
  projectName: string
  fileUrl: string
  network: 'mainnet' | 'canary'
  onlyAttestedDevices: boolean
  assignmentStrategy:
    | {
        type: AssignmentStrategyVariant.Single
        instantMatch?: { processor: string; startDelay: number }[]
      }
    | {
        type: AssignmentStrategyVariant.Competing
      }
  execution:
    | {
        type: 'onetime'
        maxExecutionTimeInMs: number
      }
    | {
        type: 'interval'
        intervalInMs: number
        numberOfExecutions: number
      }
  maxAllowedStartDelayInMs: number
  usageLimit: {
    maxMemory: number
    maxNetworkRequests: number
    maxStorage: number
  }
  numberOfReplicas: number
  requiredModules?: ['DataEncryption'] | []
  minProcessorReputation: number
  maxCostPerExecution: number
  includeEnvironmentVariables?: string[]
  processorWhitelist?: string[]
}

export interface AcurastDeployment {
  transactionId?: string

  deploymentId?: string

  deployedAt: number

  assignments: {
    processorId: string
    status: 'matched' | 'acknowledged' | 'failed'
  }[]

  status: 'init' | 'deployed' | 'failed'
  config: AcurastProjectConfig
  registration: JobRegistration
}

export interface AcurastCliConfig {
  projects: {
    [projectName: string]: AcurastProjectConfig
  }
}

export enum AssignmentStrategyVariant {
  Single = 'Single',
  Competing = 'Competing',
}

export interface JobRegistration {
  script: string
  allowedSources?: string[]
  allowOnlyVerifiedSources: boolean
  schedule: {
    duration: number
    startTime: number
    endTime: number
    interval: number
    maxStartDelay: number
  }
  memory: number
  networkRequests: number
  storage: number
  requiredModules?: any[]
  extra: {
    requirements: {
      assignmentStrategy: {
        variant: AssignmentStrategyVariant
        instantMatch?: { source: string; startDelay: number }[]
      }
      slots: number
      reward: number
      minReputation?: number
      instantMatch?: { source: string; startDelay: number }[]
    }
  }
}
