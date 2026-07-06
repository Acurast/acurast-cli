import { jest } from '@jest/globals'
import { ACURAST_GLOBAL_BASE_PATH, ACURAST_BASE_PATH } from '../src/constants.js'

// In-memory LocalStorage keyed by base directory, so the global store
// (~/.acurast) and the project store (./.acurast) are independent — exactly
// how authStore routes global vs project auth.
const stores = new Map<string, Map<string, string>>()
const storeFor = (basePath: string): Map<string, string> => {
  if (!stores.has(basePath)) stores.set(basePath, new Map())
  return stores.get(basePath)!
}

jest.unstable_mockModule('../src/util/LocalStorage.js', () => ({
  LocalStorage: class {
    private s: Map<string, string>
    constructor(_file?: string, _mode?: number, basePath: string = ACURAST_BASE_PATH) {
      this.s = storeFor(basePath)
    }
    getItem(key: string): string | null {
      return this.s.get(key) ?? null
    }
    setItem(key: string, value: string): void {
      this.s.set(key, value)
    }
    removeItem(key: string): void {
      this.s.delete(key)
    }
    clear(): void {
      this.s.clear()
    }
  },
}))

const {
  getActiveAuth,
  getGlobalAuth,
  getProjectAuth,
  setAuth,
  clearAuth,
  isLoggedIn,
  getSigningMode,
  getAuthSource,
} = await import('../src/util/authStore.js')

const record = (address: string) => ({
  address,
  signatureType: 'sr25519',
  network: 'canary' as const,
  loggedInAt: new Date().toISOString(),
})

describe('authStore', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    stores.clear()
    delete process.env.ACURAST_SIGNING_MODE
    delete process.env.ACURAST_MNEMONIC
  })
  afterAll(() => {
    process.env = envBackup
  })

  describe('scopes', () => {
    test('global auth is written to the global store and read back', () => {
      setAuth(record('5Global'), 'global')
      expect(getGlobalAuth()?.address).toBe('5Global')
      expect(getProjectAuth()).toBeNull()
      expect(isLoggedIn()).toBe(true)
    })

    test('project auth is written to the project store', () => {
      setAuth(record('5Project'), 'project')
      expect(getProjectAuth()?.address).toBe('5Project')
      expect(getGlobalAuth()).toBeNull()
    })

    test('getActiveAuth prefers the project pin over the global login', () => {
      setAuth(record('5Global'), 'global')
      setAuth(record('5Project'), 'project')
      expect(getActiveAuth()?.address).toBe('5Project')
    })

    test('getActiveAuth falls back to global when no project pin', () => {
      setAuth(record('5Global'), 'global')
      expect(getActiveAuth()?.address).toBe('5Global')
    })

    test('setAuth defaults to global scope', () => {
      setAuth(record('5Default'))
      expect(getGlobalAuth()?.address).toBe('5Default')
    })

    test('clearAuth("project") leaves the global login intact', () => {
      setAuth(record('5Global'), 'global')
      setAuth(record('5Project'), 'project')
      clearAuth('project')
      expect(getProjectAuth()).toBeNull()
      expect(getGlobalAuth()?.address).toBe('5Global')
    })
  })

  describe('expiry', () => {
    test('treats an expired session as logged-out', () => {
      const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      setAuth({ ...record('5Old'), loggedInAt: old }, 'global')
      expect(getGlobalAuth()).toBeNull()
      expect(isLoggedIn()).toBe(false)
    })

    test('returns null on malformed JSON', () => {
      storeFor(ACURAST_GLOBAL_BASE_PATH).set('auth', '{ not json')
      expect(getGlobalAuth()).toBeNull()
    })
  })

  describe('getSigningMode resolution order', () => {
    test('1. explicit ACURAST_SIGNING_MODE wins over everything', () => {
      setAuth(record('5Global'), 'global')
      process.env.ACURAST_SIGNING_MODE = 'local'
      expect(getSigningMode()).toBe('local')
      process.env.ACURAST_MNEMONIC = 'x'
      process.env.ACURAST_SIGNING_MODE = 'remote'
      expect(getSigningMode()).toBe('remote')
    })

    test('2. project pin -> remote, even with a mnemonic present', () => {
      setAuth(record('5Project'), 'project')
      process.env.ACURAST_MNEMONIC = 'x'
      expect(getSigningMode()).toBe('remote')
    })

    test('3. mnemonic -> local, beating an ambient global login', () => {
      setAuth(record('5Global'), 'global')
      process.env.ACURAST_MNEMONIC = 'x'
      expect(getSigningMode()).toBe('local')
    })

    test('4. global login -> remote when no mnemonic', () => {
      setAuth(record('5Global'), 'global')
      expect(getSigningMode()).toBe('remote')
    })

    test('5. nothing -> local', () => {
      expect(getSigningMode()).toBe('local')
    })
  })

  describe('getAuthSource', () => {
    test('project pin', () => {
      setAuth(record('5Project'), 'project')
      expect(getAuthSource()).toBe('project')
    })
    test('global login', () => {
      setAuth(record('5Global'), 'global')
      expect(getAuthSource()).toBe('global')
    })
    test('mnemonic', () => {
      process.env.ACURAST_MNEMONIC = 'x'
      expect(getAuthSource()).toBe('mnemonic')
    })
    test('none', () => {
      expect(getAuthSource()).toBe('none')
    })
  })
})
