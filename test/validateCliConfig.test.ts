import { validateCliConfig } from '../src/util/validateCliConfig.js'

const baseConfig = {
  projectName: 'test-project',
  fileUrl: 'dist/index.js',
  network: 'canary',
  onlyAttestedDevices: true,
  assignmentStrategy: { type: 'Single' },
  execution: { type: 'onetime', maxExecutionTimeInMs: 60_000 },
  maxAllowedStartDelayInMs: 0,
  usageLimit: { maxMemory: 0, maxNetworkRequests: 0, maxStorage: 0 },
  numberOfReplicas: 1,
  minProcessorReputation: 0,
  maxCostPerExecution: 100_000_000,
}

describe('validateCliConfig upcoming runtime limits', () => {
  describe('minimum execution duration (1 minute)', () => {
    test('accepts a onetime execution of exactly 1 minute', () => {
      const result = validateCliConfig(baseConfig)
      expect(result.success).toBe(true)
    })

    test('rejects a onetime execution below 1 minute', () => {
      const result = validateCliConfig({
        ...baseConfig,
        execution: { type: 'onetime', maxExecutionTimeInMs: 59_999 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('at least 1 minute')
        expect(JSON.stringify(result.error)).toContain('59999ms')
      }
    })

    test('accepts an interval execution with explicit duration of 1 minute', () => {
      const result = validateCliConfig({
        ...baseConfig,
        execution: {
          type: 'interval',
          intervalInMs: 120_000,
          numberOfExecutions: 2,
          maxExecutionTimeInMs: 60_000,
        },
      })
      expect(result.success).toBe(true)
    })

    test('rejects an interval execution with explicit duration below 1 minute', () => {
      const result = validateCliConfig({
        ...baseConfig,
        execution: {
          type: 'interval',
          intervalInMs: 120_000,
          numberOfExecutions: 2,
          maxExecutionTimeInMs: 30_000,
        },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('at least 1 minute')
      }
    })

    test('accepts an interval execution whose derived duration is exactly 1 minute', () => {
      // duration defaults to intervalInMs - 10_000 - 1
      const result = validateCliConfig({
        ...baseConfig,
        execution: {
          type: 'interval',
          intervalInMs: 70_001,
          numberOfExecutions: 2,
        },
      })
      expect(result.success).toBe(true)
    })

    test('rejects an interval execution whose derived duration is below 1 minute', () => {
      const result = validateCliConfig({
        ...baseConfig,
        execution: {
          type: 'interval',
          intervalInMs: 70_000,
          numberOfExecutions: 2,
        },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('intervalInMs')
      }
    })
  })

  describe('maximum start time (24 hours from now)', () => {
    test('accepts a start time exactly 24 hours from now', () => {
      const result = validateCliConfig({
        ...baseConfig,
        startAt: { msFromNow: 24 * 60 * 60 * 1000 },
      })
      expect(result.success).toBe(true)
    })

    test('rejects a start time more than 24 hours from now (msFromNow)', () => {
      const result = validateCliConfig({
        ...baseConfig,
        startAt: { msFromNow: 24 * 60 * 60 * 1000 + 1 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('more than 24 hours')
      }
    })

    test('rejects a start time more than 24 hours from now (timestamp)', () => {
      const result = validateCliConfig({
        ...baseConfig,
        startAt: { timestamp: Date.now() + 25 * 60 * 60 * 1000 },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('more than 24 hours')
      }
    })

    test('accepts a timestamp within the next 24 hours', () => {
      const result = validateCliConfig({
        ...baseConfig,
        startAt: { timestamp: Date.now() + 60 * 60 * 1000 },
      })
      expect(result.success).toBe(true)
    })
  })

  test('limits also apply to devnet configs', () => {
    const result = validateCliConfig({
      ...baseConfig,
      network: 'devnet',
      execution: { type: 'onetime', maxExecutionTimeInMs: 1_000 },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(JSON.stringify(result.error)).toContain('at least 1 minute')
    }
  })
})
