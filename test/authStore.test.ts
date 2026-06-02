import { jest } from '@jest/globals'

// In-memory LocalStorage so authStore is tested without touching the filesystem
// (and without the constants/storeDeployment import cycle).
const store = new Map<string, string>()
jest.unstable_mockModule('../src/util/LocalStorage.js', () => ({
  LocalStorage: class {
    constructor(_file?: string, _mode?: number) {}
    getItem(key: string): string | null {
      return store.get(key) ?? null
    }
    setItem(key: string, value: string): void {
      store.set(key, value)
    }
    removeItem(key: string): void {
      store.delete(key)
    }
    clear(): void {
      store.clear()
    }
  },
}))

const { getAuth, setAuth, clearAuth, isLoggedIn, getSigningMode } = await import(
  '../src/util/authStore.js'
)

const baseRecord = {
  address: '5Alice',
  signatureType: 'sr25519',
  network: 'canary' as const,
  loggedInAt: new Date().toISOString(),
}

describe('authStore', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    store.clear()
    delete process.env.ACURAST_SIGNING_MODE
    delete process.env.ACURAST_MNEMONIC
  })
  afterAll(() => {
    process.env = envBackup
  })

  describe('getAuth / expiry', () => {
    test('returns a fresh record', () => {
      setAuth(baseRecord)
      expect(getAuth()?.address).toBe('5Alice')
      expect(isLoggedIn()).toBe(true)
    })

    test('treats an expired session as logged-out', () => {
      const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      setAuth({ ...baseRecord, loggedInAt: old })
      expect(getAuth()).toBeNull()
      expect(isLoggedIn()).toBe(false)
    })

    test('returns null on malformed JSON', () => {
      store.set('auth', '{ not json')
      expect(getAuth()).toBeNull()
    })

    test('clearAuth removes the record', () => {
      setAuth(baseRecord)
      clearAuth()
      expect(getAuth()).toBeNull()
    })
  })

  describe('getSigningMode', () => {
    test('explicit ACURAST_SIGNING_MODE wins', () => {
      process.env.ACURAST_SIGNING_MODE = 'remote'
      expect(getSigningMode()).toBe('remote')
      process.env.ACURAST_SIGNING_MODE = 'local'
      expect(getSigningMode()).toBe('local')
    })

    test('remote when logged in and no mnemonic', () => {
      setAuth(baseRecord)
      expect(getSigningMode()).toBe('remote')
    })

    test('local when a mnemonic is set, even if logged in', () => {
      setAuth(baseRecord)
      process.env.ACURAST_MNEMONIC = 'word '.repeat(12).trim()
      expect(getSigningMode()).toBe('local')
    })

    test('local when not logged in', () => {
      expect(getSigningMode()).toBe('local')
    })
  })
})
