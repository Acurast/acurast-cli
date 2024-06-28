import { validateConfig } from '../src/util/validateConfig.js'

const example = {
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
    },
  },
}

describe('convertConfigToJob', () => {
  test('should throw an error for invalid execution type', () => {
    const project = example.projects['acurast-example-app-fetch']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })
})
