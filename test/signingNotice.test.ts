import {
  signingNoticeLine,
  expiredSessionMessage,
} from '../src/util/signingNotice.js'

describe('signingNoticeLine', () => {
  test('local mnemonic notice names the address and warns about key on disk', () => {
    const line = signingNoticeLine('local', '5Alice')
    expect(line).toContain('5Alice')
    expect(line.toLowerCase()).toContain('mnemonic')
    expect(line.toLowerCase()).toContain('key')
  })

  test('remote notice names the address and mentions the browser wallet', () => {
    const line = signingNoticeLine('remote', '5Bob')
    expect(line).toContain('5Bob')
    expect(line.toLowerCase()).toContain('browser wallet')
  })
})

describe('expiredSessionMessage', () => {
  const staleRecord = (address: string, days: number) => ({
    address,
    signatureType: 'sr25519',
    network: 'canary' as const,
    loggedInAt: new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString(),
  })

  test('names the account, the age, and both ways out', () => {
    const message = expiredSessionMessage({
      scope: 'global',
      record: staleRecord('5Alice', 21),
    })
    expect(message).toContain('5Alice')
    expect(message).toContain('21 days ago')
    expect(message).toContain('acurast login')
    expect(message).toContain('ACURAST_MNEMONIC')
  })

  test('says the project is pinned when the expired login is a project pin', () => {
    const message = expiredSessionMessage({
      scope: 'project',
      record: staleRecord('5Bob', 30),
    })
    expect(message.toLowerCase()).toContain('project')
    expect(message.toLowerCase()).toContain('pinned')
  })

  test('omits the age when loggedInAt is unparseable', () => {
    const message = expiredSessionMessage({
      scope: 'global',
      record: { ...staleRecord('5Carol', 21), loggedInAt: 'not-a-date' },
    })
    expect(message).toContain('5Carol')
    expect(message).not.toContain('NaN')
    expect(message).toContain('acurast login')
  })
})
