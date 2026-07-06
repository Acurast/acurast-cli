import fs from 'fs'
import os from 'os'
import path from 'path'
import { LocalStorage } from '../src/util/LocalStorage.js'

describe('LocalStorage base path', () => {
  test('writes to a custom base directory when provided', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acurast-ls-'))
    const ls = new LocalStorage('auth.json', 0o600, dir)

    ls.setItem('auth', 'value')

    expect(fs.existsSync(path.join(dir, 'auth.json'))).toBe(true)
    expect(ls.getItem('auth')).toBe('value')
  })
})
