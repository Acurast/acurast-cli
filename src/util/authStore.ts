import { LocalStorage } from './LocalStorage.js'
import type { CliNetwork } from '../config.js'

/**
 * Local identity persisted by `acurast login`. The CLI stores only the wallet
 * *address* (and its signature scheme) — never a private key. The actual
 * signing is delegated to the browser wallet via the remote-signing bridge.
 */
export interface AuthRecord {
  address: string
  /** sr25519 | ecdsa | ed25519 ... (the wallet's signature scheme). */
  signatureType: string
  /** Network the user logged in for (informational; deploy uses the project config). */
  network?: CliNetwork
  /** ISO timestamp of when the login happened. */
  loggedInAt: string
  /** ISO timestamp of the last time this session signed something. */
  lastUsedAt?: string
}

// Kept separate from `keys.json` (which the SDK KeyStore uses for ECDH keys).
const AUTH_FILE = 'auth.json'
const AUTH_KEY = 'auth'

// Logins older than this are treated as logged-out and require `acurast login`
// again. A remote login only authorises the browser wallet to be prompted, so a
// generous window is fine.
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

// auth.json holds identity metadata — keep it readable only by the owner.
const store = (): LocalStorage => new LocalStorage(AUTH_FILE, 0o600)

const isExpired = (record: AuthRecord): boolean => {
  const at = Date.parse(record.loggedInAt)
  if (Number.isNaN(at)) return false // tolerate older records without a parseable date
  return Date.now() - at > SESSION_MAX_AGE_MS
}

export const getAuth = (): AuthRecord | null => {
  const raw = store().getItem(AUTH_KEY)
  if (!raw) return null
  try {
    const record = JSON.parse(raw) as AuthRecord
    if (isExpired(record)) return null
    return record
  } catch {
    return null
  }
}

export const getLoggedInAddress = (): string | undefined => getAuth()?.address

export const isLoggedIn = (): boolean => getLoggedInAddress() !== undefined

export const setAuth = (record: AuthRecord): void => {
  store().setItem(AUTH_KEY, JSON.stringify(record))
}

/** Update `lastUsedAt` after a successful remote signature (best-effort). */
export const touchAuth = (): void => {
  const record = getAuth()
  if (!record) return
  setAuth({ ...record, lastUsedAt: new Date().toISOString() })
}

export const clearAuth = (): void => {
  store().removeItem(AUTH_KEY)
}

export type SigningMode = 'local' | 'remote'

/**
 * Resolve the signing mode:
 *   - explicit `ACURAST_SIGNING_MODE=local|remote` always wins;
 *   - otherwise auto: `remote` when logged in via `acurast login` AND no
 *     `ACURAST_MNEMONIC` is set; `local` (mnemonic) in every other case.
 *
 * This keeps the mnemonic the default/fallback for CI and existing users.
 * An expired session counts as logged-out (see `getAuth`).
 */
export const getSigningMode = (): SigningMode => {
  const explicit = process.env.ACURAST_SIGNING_MODE
  if (explicit === 'remote' || explicit === 'local') {
    return explicit
  }
  const hasMnemonic = !!process.env.ACURAST_MNEMONIC
  if (isLoggedIn() && !hasMnemonic) {
    return 'remote'
  }
  return 'local'
}
