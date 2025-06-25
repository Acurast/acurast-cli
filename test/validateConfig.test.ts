import { RestartPolicy, MultiOrigin } from '../src/types.js'
import { validateConfig } from '../src/util/validateConfig.js'

const simpleExample = {
  projects: {
    'acurast-example-app-fetch': {
      projectName: 'acurast-example-app-fetch',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 30000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      minProcessorVersions: {
        android: 70,
      },
    },
  },
}

const processorVersionAndRuntimeExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 30000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      restartPolicy: RestartPolicy.OnFailure,
    },
  },
}

const mutabilityAndReuseKeysExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 30000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Immutable',
      reuseKeysFrom: [
        MultiOrigin.Acurast,
        '5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL',
        123456,
      ],
    },
  },
}

describe('validateConfig', () => {
  test('should handle a valid simple example', () => {
    const project = simpleExample.projects['acurast-example-app-fetch']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with processor version and runtime', () => {
    const project = processorVersionAndRuntimeExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with mutability and reuseKeysFrom', () => {
    const project = mutabilityAndReuseKeysExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should throw an error when the project name is missing', () => {
    const project = simpleExample.projects['acurast-example-app-fetch']
    delete (project as any).projectName
    const result = validateConfig(project)

    expect(result.success).toEqual(false)
    expect(result.notes).toEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['projectName'],
        message: 'Required',
      },
    ])
  })
})
