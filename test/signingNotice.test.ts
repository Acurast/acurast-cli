import { signingNoticeLine } from '../src/util/signingNotice.js'

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
