import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { stringToU8a, u8aWrapBytes, u8aToHex } from '@polkadot/util'
import {
  LOGIN_CHALLENGE_PREFIX,
  buildLoginChallenge,
  parseLoginChallenge,
  isChallengeRecent,
  verifyLoginSignature,
} from '../src/acurast/loginChallenge.js'

describe('loginChallenge', () => {
  describe('buildLoginChallenge', () => {
    test('uses the fixed prefix and includes nonce + issuedAt', () => {
      const msg = buildLoginChallenge('abc123', '2026-06-02T00:00:00.000Z')
      expect(msg.split('\n')[0]).toBe(LOGIN_CHALLENGE_PREFIX)
      expect(msg).toContain('Challenge: abc123')
      expect(msg).toContain('Issued At: 2026-06-02T00:00:00.000Z')
    })
  })

  describe('parseLoginChallenge', () => {
    test('round-trips a built challenge', () => {
      const issuedAt = '2026-06-02T00:00:00.000Z'
      const parsed = parseLoginChallenge(buildLoginChallenge('nonce-xyz', issuedAt))
      expect(parsed).toEqual({ nonce: 'nonce-xyz', issuedAt })
    })

    test('rejects a message without the known prefix', () => {
      expect(parseLoginChallenge('Please sign in\nChallenge: x\nIssued At: y')).toBeNull()
    })
  })

  describe('isChallengeRecent', () => {
    test('true for now', () => {
      expect(isChallengeRecent(new Date().toISOString())).toBe(true)
    })
    test('false for an old timestamp', () => {
      expect(isChallengeRecent('2000-01-01T00:00:00.000Z')).toBe(false)
    })
    test('false for an unparseable timestamp', () => {
      expect(isChallengeRecent('not-a-date')).toBe(false)
    })
  })

  describe('verifyLoginSignature', () => {
    let pair: ReturnType<Keyring['addFromUri']>
    beforeAll(async () => {
      await cryptoWaitReady()
      pair = new Keyring({ type: 'sr25519' }).addFromUri('//Alice')
    })

    test('accepts a raw (unwrapped) signature over the message', () => {
      const message = buildLoginChallenge('n1', '2026-06-02T00:00:00.000Z')
      const sig = u8aToHex(pair.sign(stringToU8a(message)))
      expect(verifyLoginSignature(message, sig, pair.address)).toBe(true)
    })

    test('accepts a <Bytes>-wrapped signature (extension style)', () => {
      const message = buildLoginChallenge('n2', '2026-06-02T00:00:00.000Z')
      const sig = u8aToHex(pair.sign(u8aWrapBytes(stringToU8a(message))))
      expect(verifyLoginSignature(message, sig, pair.address)).toBe(true)
    })

    test('rejects a signature over a different message', () => {
      const sig = u8aToHex(pair.sign(stringToU8a('something else')))
      const message = buildLoginChallenge('n3', '2026-06-02T00:00:00.000Z')
      expect(verifyLoginSignature(message, sig, pair.address)).toBe(false)
    })

    test('rejects a signature from a different address', () => {
      const other = new Keyring({ type: 'sr25519' }).addFromUri('//Bob')
      const message = buildLoginChallenge('n4', '2026-06-02T00:00:00.000Z')
      const sig = u8aToHex(pair.sign(stringToU8a(message)))
      expect(verifyLoginSignature(message, sig, other.address)).toBe(false)
    })
  })
})
