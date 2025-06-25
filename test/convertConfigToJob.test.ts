import {
  DEFAULT_REWARD,
  convertConfigToJob,
} from '../src/acurast/convertConfigToJob.js'
import {
  AcurastProjectConfig,
  AssignmentStrategyVariant,
  DeploymentRuntime,
  JobRegistration,
  ScriptMutability,
} from '../src/types.js'

describe('convertConfigToJob', () => {
  test('should convert config to job registration with one-time execution', () => {
    const config: AcurastProjectConfig = {
      projectName: 'test',
      fileUrl: './examples/ip.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: { type: AssignmentStrategyVariant.Single },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 5000,
      },
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      maxAllowedStartDelayInMs: 0,
      numberOfReplicas: 1,
      minProcessorReputation: 0,
      maxCostPerExecution: DEFAULT_REWARD,
    }

    const expectedJobRegistration: JobRegistration = {
      script: './examples/ip.js',
      allowedSources: undefined,
      allowOnlyVerifiedSources: true,
      schedule: {
        duration: 5000,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        interval: expect.any(Number),
        maxStartDelay: 0,
      },
      memory: 0,
      networkRequests: 0,
      storage: 0,
      requiredModules: undefined,
      mutability: ScriptMutability.Immutable,
      reuseKeysFrom: undefined,
      extra: {
        requirements: {
          runtime: DeploymentRuntime.NodeJSWithBundle,
          assignmentStrategy: {
            variant: AssignmentStrategyVariant.Single,
            instantMatch: undefined,
          },
          slots: 1,
          reward: DEFAULT_REWARD,
          minReputation: 0,
        },
      },
    }

    const jobRegistration = convertConfigToJob(config)

    expect(jobRegistration).toEqual(expectedJobRegistration)
  })

  test('should throw an error for invalid execution type', () => {
    const config: AcurastProjectConfig = {
      fileUrl: './script.js',
      execution: {
        type: 'invalid',
      } as any,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
    } as any

    expect(() => convertConfigToJob(config)).toThrow('Invalid execution type')
  })
})
