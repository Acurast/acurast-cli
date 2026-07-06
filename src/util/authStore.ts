import { LocalStorage } from './LocalStorage.js'
import { ACURAST_GLOBAL_BASE_PATH } from '../constants.js'
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

/**
 * Where a login is stored:
 *   - `global`  — `~/.acurast/auth.json`, shared across every project.
 *   - `project` — `./.acurast/auth.json`, pins an account for this directory
 *                 (overrides the global login).
 */
export type AuthScope = 'global' | 'project'

// Kept separate from `keys.json` (which the SDK KeyStore uses for ECDH keys).
const AUTH_FILE = 'auth.json'
const AUTH_KEY = 'auth'

// Logins older than this are treated as logged-out and require `acurast login`
// again. A remote login only authorises the browser wallet to be prompted, so a
// generous window is fine.
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

// auth.json holds identity metadata — keep it readable only by the owner.
// The project store uses LocalStorage's default (cwd) base path.
const store = (scope: AuthScope): LocalStorage =>
  scope === 'global'
    ? new LocalStorage(AUTH_FILE, 0o600, ACURAST_GLOBAL_BASE_PATH)
    : new LocalStorage(AUTH_FILE, 0o600)

const isExpired = (record: AuthRecord): boolean => {
  const at = Date.parse(record.loggedInAt)
  if (Number.isNaN(at)) return false // tolerate older records without a parseable date
  return Date.now() - at > SESSION_MAX_AGE_MS
}

const read = (scope: AuthScope): AuthRecord | null => {
  const raw = store(scope).getItem(AUTH_KEY)
  if (!raw) return null
  try {
    const record = JSON.parse(raw) as AuthRecord
    if (isExpired(record)) return null
    return record
  } catch {
    return null
  }
}

export const getGlobalAuth = (): AuthRecord | null => read('global')
export const getProjectAuth = (): AuthRecord | null => read('project')

/** The account that will actually be used: a project pin wins over the global login. */
export const getActiveAuth = (): AuthRecord | null => getProjectAuth() ?? getGlobalAuth()

export const getLoggedInAddress = (): string | undefined => getActiveAuth()?.address

export const isLoggedIn = (): boolean => getLoggedInAddress() !== undefined

export const setAuth = (record: AuthRecord, scope: AuthScope = 'global'): void => {
  store(scope).setItem(AUTH_KEY, JSON.stringify(record))
}

export const clearAuth = (scope: AuthScope): void => {
  store(scope).removeItem(AUTH_KEY)
}

/** Update `lastUsedAt` on whichever scope provided the active account (best-effort). */
export const touchAuth = (): void => {
  const now = new Date().toISOString()
  const project = getProjectAuth()
  if (project) {
    setAuth({ ...project, lastUsedAt: now }, 'project')
    return
  }
  const global = getGlobalAuth()
  if (global) {
    setAuth({ ...global, lastUsedAt: now }, 'global')
  }
}

export type SigningMode = 'local' | 'remote'

/**
 * Resolve the signing mode, highest priority first:
 *   1. explicit `ACURAST_SIGNING_MODE=local|remote`;
 *   2. a project pin (`./.acurast/auth.json`) → `remote`;
 *   3. `ACURAST_MNEMONIC` present → `local`;
 *   4. a global login (`~/.acurast/auth.json`) → `remote`;
 *   5. otherwise `local`.
 *
 * An ambient global login never silently changes how an existing mnemonic
 * project signs (step 3 beats step 4). A deliberate project pin does (step 2).
 * Expired sessions count as logged-out (see `read`).
 */
export const getSigningMode = (): SigningMode => {
  const explicit = process.env.ACURAST_SIGNING_MODE
  if (explicit === 'remote' || explicit === 'local') {
    return explicit
  }
  if (getProjectAuth()) return 'remote'
  if (process.env.ACURAST_MNEMONIC) return 'local'
  if (getGlobalAuth()) return 'remote'
  return 'local'
}

export type AuthSource = 'project' | 'global' | 'mnemonic' | 'none'

/** Where the account/key that will be used comes from — for `whoami` and deploy output. */
export const getAuthSource = (): AuthSource => {
  if (getSigningMode() === 'remote') {
    if (getProjectAuth()) return 'project'
    if (getGlobalAuth()) return 'global'
    return 'none'
  }
  return process.env.ACURAST_MNEMONIC ? 'mnemonic' : 'none'
}
