import { BigNumber } from 'bignumber.js'

export interface EnvVar {
  key: string
  value: string
}

export type AcurastEnvironment = {
  publicKey: string
  variables: string[][]
}

export type AcurastEnvironments = {
  processor: string
  environment: AcurastEnvironment
}[]

export interface EncryptedValue {
  ciphertext: string
  iv: string
  authTag: string
}

export interface EnvVarEncrypted {
  key: string
  encryptedValue: EncryptedValue
}
export interface JobEnvironmentEncrypted {
  publicKey: string
  variables: EnvVarEncrypted[]
}

export type JobEnvironmentsEncrypted = {
  processor: string
  jobEnvironment: JobEnvironmentEncrypted
}[]

export type MultiOrigin = {
  acurast?: string
  tezos?: string
}

export type PubKey = {
  SECP256r1?: string
  SECP256k1?: string
  ED25519?: string
  SECP256r1Encryption?: string
  SECP256k1Encryption?: string
}

export type ExecutionSpecifier = {
  All?: null
  Index?: number
}

export type JobAssignmentSla = {
  total: BigNumber
  met: BigNumber
}

export type JobAssignment = {
  slot: number
  startDelay: number
  feePerExecution: BigNumber
  acknowledged: boolean
  sla: JobAssignmentSla
  pubKeys: PubKey[]
  execution: ExecutionSpecifier
}

export type JobSchedule = {
  duration: number
  startTime: Date
  endTime: Date
  interval: BigNumber
  maxStartDelay: number
}

export type JobModule = 'DataEncryption'

export type JobRegistrationExtra = {
  requirements: JobRequirements
  expectedFulfillmentFee?: BigNumber
}

export type JobRequirements = {
  assignmentStrategy: AssignmentStrategy
  slots: number
  reward: BigNumber
  minReputation?: BigNumber
  processorVersion?: ProcessorVersionRequirements
  runtime: DeploymentRuntime
}

export type ProcessorVersionRequirements = {
  min: Version[]
}

export type Version = {
  platform: number
  buildNumber: number
}

export type AssignmentStrategy = {
  variant: AssignmentStrategyVariant
  instantMatch?: PlannedExecution[]
}

export enum AssignmentStrategyVariant {
  Single = 'Single',
  Competing = 'Competing',
}

export type PlannedExecution = {
  source: string
  startDelay: BigNumber
}

// export type JobRegistration = {
//   script: string
//   allowedSources?: string[]
//   allowOnlyVerifiedSources: boolean
//   schedule: JobSchedule
//   memory: number
//   networkRequests: number
//   storage: number
//   requiredModules?: JobModule[]
//   extra: JobRegistrationExtra
// }

export type Job = {
  id: JobId
  registration: JobRegistration
}

export type JobId = [MultiOrigin, number]

export type JobAssignmentInfo = {
  id: JobId
  processor: string
  assignment: JobAssignment
}

export type EncKeyCurve = 'p256' | 'secp256k1'

export type ProcessorEncryptionKey = {
  publicKey: string
  curve: EncKeyCurve
}

import { RegistryTypes } from '@polkadot/types-codec/types'
import type { DeploymentRuntime, JobRegistration } from '../../types.js'

export const CUSTOM_TYPES: RegistryTypes = {
  PalletAcurastMarketplacePartialJobRegistration: {
    allowedSources: 'Option<Vec<AccountId>>',
    allowOnlyVerifiedSources: 'bool',
    schedule: 'Option<AcurastCommonSchedule>',
    memory: 'Option<u32>',
    networkRequests: 'Option<u32>',
    requiredModules: 'Vec<AcurastCommonJobModule>',
    slots: 'Option<u8>',
    reward: 'u128',
    minReputation: 'Option<u128>',
  },
  AcurastCommonSchedule: {
    duration: 'u64',
    startTime: 'u64',
    endTime: 'u64',
    interval: 'u64',
    maxStartDelay: 'u64',
  },
  AcurastCommonJobModule: {
    _enum: ['DataEncryption'],
  },
  PalletAcurastMarketplacePlannedExecution: {
    source: 'AccountId',
    startDelay: 'u64',
  },
  PalletAcurastMarketplaceJobRequirements: {
    assignment_strategy: 'PalletAcurastMarketplaceAssignmentStrategy',
    slots: 'u8',
    reward: 'u128',
    minReputation: 'Option<u128>',
  },
  PalletAcurastMarketplaceRegistrationExtra: {
    requirements: 'PalletAcurastMarketplaceJobRequirements',
    expectedFulfillmentFee: 'u128',
  },
  AcurastCommonJobRegistration: {
    script: 'Bytes',
    allowedSources: 'Option<Vec<AccountId32>>',
    schedule: 'AcurastCommonSchedule',
    memory: 'u32',
    networkRequests: 'u32',
    storage: 'u32',
    requiredModules: 'Vec<AcurastCommonJobModule>',
    extra: 'PalletAcurastMarketplaceRegistrationExtra',
  },
  PalletAcurastMarketplaceJobStatus: {
    _enum: {
      Open: null,
      Matched: null,
      Assigned: 'u8',
    },
  },
  PalletAcurastMarketplaceSLA: {
    total: 'u64',
    met: 'u64',
  },
  PalletAcurastMarketplacePubKey: {
    _enum: {
      SECP256r1: 'Bytes',
      SECP256k1: 'Bytes',
      ED25519: 'Bytes',
      SECP256r1Encryption: 'Bytes',
      SECP256k1Encryption: 'Bytes',
    },
  },
  PalletAcurastMarketplaceAssignment: {
    slot: 'u8',
    start_delay: 'u64',
    fee_per_execution: 'u128',
    acknowledged: 'bool',
    sla: 'PalletAcurastMarketplaceSLA',
    pub_keys: 'Vec<PalletAcurastMarketplacePubKey>',
    execution: 'PalletAcurastMarketplaceExecutionSpecifier',
  },
  PalletAcurastMarketplaceExecutionSpecifier: {
    _enum: {
      All: null,
      Index: 'u64',
    },
  },
  ReputationBetaParameters: {
    r: 'u128',
    s: 'u128',
  },
  PalletAcurastMarketplaceAdvertisementRestriction: {
    maxMemory: 'u32',
    networkRequestQuota: 'u8',
    storageCapacity: 'u32',
    allowedConsumers: 'Option<Vec<AccountId>>',
    availableModules: 'Vec<AcurastCommonJobModule>',
  },
  PalletAcurastMarketplaceSchedulingWindow: {
    end: 'u64',
  },
  PalletAcurastMarketplacePricing: {
    feePerMillisecond: 'u128',
    feePerStorageByte: 'u128',
    baseFeePerExecution: 'u128',
    schedulingWindow: 'PalletAcurastMarketplaceSchedulingWindow',
  },
  PalletAcurastMarketplaceAdvertisement: {
    pricing: 'PalletAcurastMarketplacePricing',
    maxMemory: 'u32',
    networkRequestQuota: 'u8',
    storageCapacity: 'u32',
    allowedConsumers: 'Option<Vec<AcurastCommonMultiOrigin>>',
    availableModules: 'Vec<AcurastCommonJobModule>',
  },
  AcurastCommonMultiOrigin: {
    acurast: 'Option<AccountId32>',
    tezos: 'Option<Bytes>',
  },
  PalletAcurastMarketplaceAssignmentStrategy: {
    _enum: {
      Single: 'Option<Vec<PalletAcurastMarketplacePlannedExecution>>',
      Competing: null,
    },
  },
  AcurastCommonEnvironment: {
    publicKey: 'Bytes',
    variables: 'Vec<(Bytes, Bytes)>',
  },
}
