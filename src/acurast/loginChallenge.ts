import { signatureVerify } from '@polkadot/util-crypto'
import { stringToU8a, u8aWrapBytes } from '@polkadot/util'

/** Fixed first line of the login challenge. Lets the hub reject crafted messages. */
export const LOGIN_CHALLENGE_PREFIX = 'Acurast CLI login v1'

/** Challenges older than this are considered stale. */
export const CHALLENGE_MAX_AGE_MS = 10 * 60_000

/**
 * Build the human-readable message the wallet is asked to sign during
 * `acurast login`. Multi-line so the hub can display it and constrain it to a
 * known prefix; `issuedAt` is injectable for deterministic tests.
 */
export const buildLoginChallenge = (
  nonce: string,
  issuedAt: string = new Date().toISOString(),
): string => `${LOGIN_CHALLENGE_PREFIX}\nChallenge: ${nonce}\nIssued At: ${issuedAt}`

export interface ParsedChallenge {
  nonce: string
  issuedAt: string
}

/** Parse + prefix-validate a challenge string. Returns null when malformed. */
export const parseLoginChallenge = (message: string): ParsedChallenge | null => {
  const lines = message.split('\n')
  if (lines[0] !== LOGIN_CHALLENGE_PREFIX) return null
  const nonce = lines.find((l) => l.startsWith('Challenge: '))?.slice('Challenge: '.length)
  const issuedAt = lines.find((l) => l.startsWith('Issued At: '))?.slice('Issued At: '.length)
  if (!nonce || !issuedAt) return null
  return { nonce, issuedAt }
}

/** True when `issuedAt` is recent (allowing a little clock skew). */
export const isChallengeRecent = (issuedAt: string, maxAgeMs = CHALLENGE_MAX_AGE_MS): boolean => {
  const t = Date.parse(issuedAt)
  if (Number.isNaN(t)) return false
  const age = Date.now() - t
  return age >= -60_000 && age <= maxAgeMs
}

/**
 * Verify the wallet signed exactly `message`. Different providers wrap bytes
 * differently (`<Bytes>…</Bytes>`), so accept both the raw and wrapped forms.
 */
export const verifyLoginSignature = (
  message: string,
  signature: string,
  address: string,
): boolean => {
  const messageU8a = stringToU8a(message)
  return [messageU8a, u8aWrapBytes(messageU8a)].some(
    (m) => signatureVerify(m, signature, address).isValid,
  )
}
