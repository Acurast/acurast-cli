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

const mutableWithValidVersionsExample = {
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
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 91,
        ios: 63353,
      },
    },
  },
}

const mutableWithoutVersionsExample = {
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
      mutability: 'Mutable',
    },
  },
}

const mutableWithInvalidAndroidVersionExample = {
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
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 70,
        ios: 63353,
      },
    },
  },
}

const mutableWithInvalidIOSVersionExample = {
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
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 91,
        ios: 60000,
      },
    },
  },
}

const mutableWithValidAndroidOnlyExample = {
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
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 91,
      },
    },
  },
}

const mutableWithValidIOSOnlyExample = {
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
      mutability: 'Mutable',
      minProcessorVersions: {
        ios: 63353,
      },
    },
  },
}

const mutableWithInvalidVersionsExample = {
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
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 70,
        ios: 60000,
      },
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

  test('should handle a valid example with mutable mutability and valid processor versions', () => {
    const project = mutableWithValidVersionsExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with mutable mutability and valid Android version only', () => {
    const project = mutableWithValidAndroidOnlyExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with mutable mutability and valid iOS version only', () => {
    const project = mutableWithValidIOSOnlyExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  // test('should reject mutable mutability without minProcessorVersions', () => {
  //   const project = mutableWithoutVersionsExample.projects['test']
  //   const result = validateConfig(project)

  //   expect(result.success).toEqual(false)
  //   expect(result.notes).toEqual([
  //     {
  //       code: 'custom',
  //       message:
  //         'When mutability is set to "Mutable", minProcessorVersions must include at least one platform with Android version code 91 or iOS version code 63353.',
  //       path: ['mutability'],
  //     },
  //   ])
  // })

  // test('should reject mutable mutability with invalid versions for both platforms', () => {
  //   const project = mutableWithInvalidVersionsExample.projects['test']
  //   const result = validateConfig(project)

  //   expect(result.success).toEqual(false)
  //   expect(result.notes).toEqual([
  //     {
  //       code: 'custom',
  //       message:
  //         'When mutability is set to "Mutable", minProcessorVersions must include at least one platform with Android version code 91 or iOS version code 63353.',
  //       path: ['mutability'],
  //     },
  //   ])
  // })

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
