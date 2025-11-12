import { suggestCostPerExecution } from '../src/util/suggestCostPerExecution.js'
import { BigNumber } from 'bignumber.js'

describe('suggestCostPerExecution', () => {
  test('should calculate cost for basic duration and storage', () => {
    const duration = 1000 // 1 second
    const storage = 1024 // 1 KB

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (1 * 1000) + (1 * 1024) + 2000000000 + 30000000000
    // = 1000 + 1024 + 2000000000 + 30000000000 = 32000002024
    expect(result).toBe('32000002024')
  })

  test('should calculate cost for zero duration and storage', () => {
    const duration = 0
    const storage = 0

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (1 * 0) + (1 * 0) + 2000000000 + 30000000000
    // = 0 + 0 + 2000000000 + 30000000000 = 32000000000
    expect(result).toBe('32000000000')
  })

  test('should calculate cost for large duration and storage', () => {
    const duration = 3600000 // 1 hour
    const storage = 1048576 // 1 MB

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (1 * 3600000) + (1 * 1048576) + 2000000000 + 30000000000
    // = 3600000 + 1048576 + 2000000000 + 30000000000 = 32004648576
    expect(result).toBe('32004648576')
  })

  test('should return human readable format when specified', () => {
    const duration = 1000 // 1 second
    const storage = 1024 // 1 KB

    const result = suggestCostPerExecution(duration, storage, true)

    // Expected: 32000002024 / 10^12 = 0.032000002024
    expect(result).toBe('0.032000002024')
  })

  test('should handle very small values correctly', () => {
    const duration = 1 // 1 millisecond
    const storage = 1 // 1 byte

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (1 * 1) + (1 * 1) + 2000000000 + 30000000000
    // = 1 + 1 + 2000000000 + 30000000000 = 32000000002
    expect(result).toBe('32000000002')
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

    // Expected: (1 * -1000) + (1 * 1024) + 2000000000 + 30000000000
    // = -1000 + 1024 + 2000000000 + 30000000000 = 32000000024
    expect(result).toBe('32000000024')
  })

  test('should handle negative storage (edge case)', () => {
    const duration = 1000
    const storage = -1024

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (1 * 1000) + (1 * -1024) + 2000000000 + 30000000000
    // = 1000 + (-1024) + 2000000000 + 30000000000 = 31999999976
    expect(result).toBe('31999999976')
  })

  test('should maintain precision for large numbers', () => {
    const duration = 86400000 // 24 hours
    const storage = 1073741824 // 1 GB

    const result = suggestCostPerExecution(duration, storage)

    // Expected: (1 * 86400000) + (1 * 1073741824) + 2000000000 + 30000000000
    // = 86400000 + 1073741824 + 2000000000 + 30000000000 = 33160141824
    expect(result).toBe('33160141824')
  })
})
