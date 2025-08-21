import { suggestCostPerExecution } from '../src/util/suggestCostPerExecution.js'
import { BigNumber } from 'bignumber.js'

describe('suggestCostPerExecution', () => {
  test('should calculate cost for basic duration and storage', () => {
    const duration = 1000 // 1 second
    const storage = 1024 // 1 KB

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (12538 * 1000) + (1 * 1024) + 2000000000 + 30000000000
    // = 12538000 + 1024 + 2000000000 + 30000000000 = 32012539024
    expect(result).toBe('32012539024')
  })

  test('should calculate cost for zero duration and storage', () => {
    const duration = 0
    const storage = 0

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (12538 * 0) + (1 * 0) + 2000000000 + 30000000000
    // = 0 + 0 + 2000000000 + 30000000000 = 32000000000
    expect(result).toBe('32000000000')
  })

  test('should calculate cost for large duration and storage', () => {
    const duration = 3600000 // 1 hour
    const storage = 1048576 // 1 MB

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (12538 * 3600000) + (1 * 1048576) + 2000000000 + 30000000000
    // = 45136800000 + 1048576 + 2000000000 + 30000000000 = 77137848576
    expect(result).toBe('77137848576')
  })

  test('should return human readable format when specified', () => {
    const duration = 1000 // 1 second
    const storage = 1024 // 1 KB

    const result = suggestCostPerExecution(duration, storage, true)

    // Expected: 32012539024 / 10^12 = 0.032012539024
    expect(result).toBe('0.032012539024')
  })

  test('should handle very small values correctly', () => {
    const duration = 1 // 1 millisecond
    const storage = 1 // 1 byte

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (12538 * 1) + (1 * 1) + 2000000000 + 30000000000
    // = 12538 + 1 + 2000000000 + 30000000000 = 32000012539
    expect(result).toBe('32000012539')
  })

  test('should throw error for null duration', () => {
    const duration = null as any
    const storage = 1024

    expect(() => suggestCostPerExecution(duration, storage)).toThrow(
      'Invalid duration'
    )
  })

  test('should handle negative duration (edge case)', () => {
    const duration = -1000
    const storage = 1024

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (12538 * -1000) + (1 * 1024) + 2000000000 + 30000000000
    // = -12538000 + 1024 + 2000000000 + 30000000000 = 31987463024
    expect(result).toBe('31987463024')
  })

  test('should handle negative storage (edge case)', () => {
    const duration = 1000
    const storage = -1024

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (12538 * 1000) + (1 * -1024) + 2000000000 + 30000000000
    // = 12538000 + (-1024) + 2000000000 + 30000000000 = 32012536976
    expect(result).toBe('32012536976')
  })

  test('should maintain precision for large numbers', () => {
    const duration = 86400000 // 24 hours
    const storage = 1073741824 // 1 GB

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (12538 * 86400000) + (1 * 1073741824) + 2000000000 + 30000000000
    // = 1083283200000 + 1073741824 + 2000000000 + 30000000000 = 1116356941824
    expect(result).toBe('1116356941824')
  })
})
