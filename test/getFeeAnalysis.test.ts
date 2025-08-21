import { getFeeAnalysis } from '../src/util/getFeeAnalysis.js'
import type { AcurastProjectConfig } from '../src/types.js'
import { AssignmentStrategyVariant } from '../src/types.js'

describe('getFeeAnalysis', () => {
  const createBasicConfig = (
    overrides: Partial<AcurastProjectConfig> = {}
  ): AcurastProjectConfig => ({
    projectName: 'test-project',
    fileUrl: './examples/test.js',
    network: 'canary',
    onlyAttestedDevices: true,
    assignmentStrategy: { type: AssignmentStrategyVariant.Single },
    execution: {
      type: 'onetime',
      maxExecutionTimeInMs: 5000,
    },
    usageLimit: {
      maxMemory: 1024 * 1024, // 1 MB
      maxNetworkRequests: 10,
      maxStorage: 1024 * 1024, // 1 MB
    },
    maxAllowedStartDelayInMs: 1000,
    numberOfReplicas: 2,
    minProcessorReputation: 100,
    maxCostPerExecution: 1000000000000, // 1 cACU in smallest denomination
    ...overrides,
  })

  test('should analyze fees for one-time execution', () => {
    const config = createBasicConfig()

    const result = getFeeAnalysis(config)

    expect(result.project).toBe('test-project')
    expect(result.numberOfExecutions.toString()).toBe('1')
    expect(result.numberOfReplicas.toString()).toBe('2')
    expect(result.suggestedCostPerExecution).toBeDefined()
    expect(result.excessCostPerExecution).toBeDefined()
    expect(result.excessCostPerExecutionPercentage).toBeDefined()
    expect(result.totalRuns.toString()).toBe('2')
    expect(result.maxCostPerExecutionCACU).toBeDefined()
    expect(result.maxCostPerExecutionPerReplicaCACU).toBeDefined()
    expect(result.maxTotalCostCACU).toBeDefined()
  })

  test('should analyze fees for interval execution', () => {
    const config = createBasicConfig({
      execution: {
        type: 'interval',
        intervalInMs: 60000, // 1 minute
        numberOfExecutions: 5,
        maxExecutionTimeInMs: 30000, // 30 seconds
      },
    })

    const result = getFeeAnalysis(config)

    expect(result.numberOfExecutions.toString()).toBe('5')
    expect(result.numberOfReplicas.toString()).toBe('2')
    expect(result.totalRuns.toString()).toBe('10')
  })

  test('should calculate cost differences correctly', () => {
    const config = createBasicConfig({
      maxCostPerExecution: 2000000000000, // 2 cACU
    })

    const result = getFeeAnalysis(config)

    // excessCostPerExecution should be positive when maxCost > suggested
    expect(result.excessCostPerExecution.isGreaterThan(0)).toBe(true)
    expect(result.excessCostPerExecutionPercentage.isGreaterThan(0)).toBe(true)
  })

  test('should handle zero cost per execution', () => {
    const config = createBasicConfig({
      maxCostPerExecution: 0,
    })

    const result = getFeeAnalysis(config)

    expect(result.excessCostPerExecution.isLessThan(0)).toBe(true)
    expect(result.excessCostPerExecutionPercentage.isLessThan(0)).toBe(true)
  })

  test('should handle single replica', () => {
    const config = createBasicConfig({
      numberOfReplicas: 1,
    })

    const result = getFeeAnalysis(config)

    expect(result.numberOfReplicas.toString()).toBe('1')
    expect(result.totalRuns.toString()).toBe('1')
  })

  test('should handle multiple replicas', () => {
    const config = createBasicConfig({
      numberOfReplicas: 10,
    })

    const result = getFeeAnalysis(config)

    expect(result.numberOfReplicas.toString()).toBe('10')
    expect(result.totalRuns.toString()).toBe('10')
  })

  test('should handle very short execution time', () => {
    const config = createBasicConfig({
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 1, // 1 millisecond
      },
    })

    const result = getFeeAnalysis(config)

    expect(result.suggestedCostPerExecution).toBeDefined()
    expect(result.numberOfExecutions.toString()).toBe('1')
  })

  test('should handle very long execution time', () => {
    const config = createBasicConfig({
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 86400000, // 24 hours
      },
    })

    const result = getFeeAnalysis(config)

    expect(result.suggestedCostPerExecution).toBeDefined()
    expect(result.numberOfExecutions.toString()).toBe('1')
  })

  test('should handle zero storage and memory', () => {
    const config = createBasicConfig({
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
    })

    const result = getFeeAnalysis(config)

    expect(result.suggestedCostPerExecution).toBeDefined()
  })

  test('should handle large storage and memory', () => {
    const config = createBasicConfig({
      usageLimit: {
        maxMemory: 1024 * 1024 * 1024, // 1 GB
        maxNetworkRequests: 1000,
        maxStorage: 1024 * 1024 * 1024, // 1 GB
      },
    })

    const result = getFeeAnalysis(config)

    expect(result.suggestedCostPerExecution).toBeDefined()
  })

  test('should handle edge case with very high max cost', () => {
    const config = createBasicConfig({
      maxCostPerExecution: 1000000000000000, // 1000 cACU
    })

    const result = getFeeAnalysis(config)

    expect(result.excessCostPerExecution.isGreaterThan(0)).toBe(true)
    expect(result.excessCostPerExecutionPercentage.isGreaterThan(0)).toBe(true)
  })

  test('should handle edge case with very low max cost', () => {
    const config = createBasicConfig({
      maxCostPerExecution: 100000000000, // 0.1 cACU
    })

    const result = getFeeAnalysis(config)

    // The max cost (0.1 cACU) is actually higher than the suggested cost (~0.032 cACU)
    // So excessCostPerExecution should be positive
    expect(result.excessCostPerExecution.isGreaterThan(0)).toBe(true)
    expect(result.excessCostPerExecutionPercentage.isGreaterThan(0)).toBe(true)
  })

  test('should handle multiple interval executions with different intervals', () => {
    const config = createBasicConfig({
      execution: {
        type: 'interval',
        intervalInMs: 300000, // 5 minutes
        numberOfExecutions: 10,
        maxExecutionTimeInMs: 60000, // 1 minute
      },
    })

    const result = getFeeAnalysis(config)

    expect(result.numberOfExecutions.toString()).toBe('10')
    expect(result.numberOfReplicas.toString()).toBe('2')
    expect(result.totalRuns.toString()).toBe('20')
  })

  test('should maintain BigNumber precision in calculations', () => {
    const config = createBasicConfig({
      maxCostPerExecution: 1234567890123, // Specific value to test precision
    })

    const result = getFeeAnalysis(config)

    // All numeric values should be BigNumber instances
    expect(result.numberOfExecutions).toBeInstanceOf(require('bignumber.js'))
    expect(result.numberOfReplicas).toBeInstanceOf(require('bignumber.js'))
    expect(result.totalRuns).toBeInstanceOf(require('bignumber.js'))
    expect(result.excessCostPerExecution).toBeInstanceOf(
      require('bignumber.js')
    )
    expect(result.excessCostPerExecutionPercentage).toBeInstanceOf(
      require('bignumber.js')
    )
    expect(result.maxCostPerExecutionCACU).toBeInstanceOf(
      require('bignumber.js')
    )
    expect(result.maxCostPerExecutionPerReplicaCACU).toBeInstanceOf(
      require('bignumber.js')
    )
    expect(result.maxTotalCostCACU).toBeInstanceOf(require('bignumber.js'))
  })

  test('should calculate CACU values correctly', () => {
    const config = createBasicConfig({
      maxCostPerExecution: 1000000000000, // 1 cACU
    })

    const result = getFeeAnalysis(config)

    // CACU values should be properly converted from satoshi
    expect(result.maxCostPerExecutionCACU.toString()).toBe('1')
    expect(result.maxCostPerExecutionPerReplicaCACU.toString()).toBe('1')
    expect(result.maxTotalCostCACU.toString()).toBe('2')
  })
})
