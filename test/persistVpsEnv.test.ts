import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { persistVpsOptionsToEnv } from '../src/util/persistVpsEnv.js'

const tmpEnvPath = () => join(mkdtempSync(join(tmpdir(), 'vps-env-')), '.env')

describe('persistVpsOptionsToEnv', () => {
  test('creates .env with VPS_* entries for defined options only', () => {
    const envPath = tmpEnvPath()
    const written = persistVpsOptionsToEnv(
      { image: 'ubuntu24', duration: '1h', network: 'canary' },
      envPath
    )
    expect(written.sort()).toEqual(['VPS_DURATION', 'VPS_IMAGE', 'VPS_NETWORK'])
    const content = readFileSync(envPath, 'utf-8')
    expect(content).toContain('VPS_IMAGE=ubuntu24')
    expect(content).toContain('VPS_DURATION=1h')
    expect(content).toContain('VPS_NETWORK=canary')
    expect(content).not.toContain('VPS_SSH_PASSWORD')
  })

  test('updates existing keys and preserves unrelated lines', () => {
    const envPath = tmpEnvPath()
    writeFileSync(
      envPath,
      'ACURAST_MNEMONIC=abandon abandon\n# comment\nVPS_IMAGE=ubuntu25\n'
    )
    persistVpsOptionsToEnv({ image: 'ubuntu24', duration: '2d' }, envPath)
    const content = readFileSync(envPath, 'utf-8')
    expect(content).toContain('ACURAST_MNEMONIC=abandon abandon')
    expect(content).toContain('# comment')
    expect(content).toContain('VPS_IMAGE=ubuntu24')
    expect(content).not.toContain('ubuntu25')
    expect(content).toContain('VPS_DURATION=2d')
  })

  test('quotes values containing spaces', () => {
    const envPath = tmpEnvPath()
    persistVpsOptionsToEnv(
      { authorizedSshKey: 'ssh-ed25519 AAAA key@host' },
      envPath
    )
    expect(readFileSync(envPath, 'utf-8')).toContain(
      'VPS_AUTHORIZED_SSH_KEY="ssh-ed25519 AAAA key@host"'
    )
  })

  test('returns empty list and writes nothing when no options set', () => {
    const envPath = tmpEnvPath()
    expect(persistVpsOptionsToEnv({}, envPath)).toEqual([])
    expect(() => readFileSync(envPath, 'utf-8')).toThrow()
  })

  test('round-trips through dotenv-style parsing', async () => {
    const envPath = tmpEnvPath()
    persistVpsOptionsToEnv(
      { authorizedSshKey: 'ssh-ed25519 AAAA key@host', minMemory: '2GB' },
      envPath
    )
    const dotenv = await import('dotenv')
    const parsed = dotenv.parse(readFileSync(envPath))
    expect(parsed.VPS_AUTHORIZED_SSH_KEY).toBe('ssh-ed25519 AAAA key@host')
    expect(parsed.VPS_MIN_MEMORY).toBe('2GB')
  })
})
