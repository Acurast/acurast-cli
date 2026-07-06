import { requiredEnvVariablesForSigning } from '../src/commands/init.js'

describe('requiredEnvVariablesForSigning', () => {
  test('browser mode omits ACURAST_MNEMONIC', () => {
    const vars = requiredEnvVariablesForSigning('browser')
    expect(vars).not.toContain('ACURAST_MNEMONIC')
    expect(vars).toContain('ACURAST_IPFS_URL')
  })

  test('mnemonic mode includes ACURAST_MNEMONIC first', () => {
    const vars = requiredEnvVariablesForSigning('mnemonic')
    expect(vars[0]).toBe('ACURAST_MNEMONIC')
  })
})
