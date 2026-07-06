import * as fs from 'fs'
import { ensureDirectoryExistence } from './ensureDirectoryExistence.js'
import { ACURAST_BASE_PATH } from '../constants.js'

export class LocalStorage {
  private filePath: string
  private mode?: number

  constructor(fileName = 'keys.json', mode?: number, basePath: string = ACURAST_BASE_PATH) {
    this.filePath = `${basePath}/${fileName}`
    this.mode = mode
    this.ensureFile()
  }

  private ensureFile() {
    ensureDirectoryExistence(this.filePath)
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '{}', { encoding: 'utf8', ...(this.mode ? { mode: this.mode } : {}) })
    } else if (this.mode !== undefined) {
      // Best-effort tighten permissions on an existing file (no-op on
      // filesystems that ignore Unix modes, e.g. WSL DrvFs / Windows).
      try {
        fs.chmodSync(this.filePath, this.mode)
      } catch {
        // ignore
      }
    }
  }

  private readStorage(): Record<string, string> {
    const data = fs.readFileSync(this.filePath, 'utf8')
    return JSON.parse(data)
  }

  private writeStorage(storage: Record<string, string>) {
    fs.writeFileSync(this.filePath, JSON.stringify(storage, null, 2), 'utf8')
  }

  getItem(key: string): string | null {
    const storage = this.readStorage()
    return storage[key] || null
  }

  setItem(key: string, value: string) {
    const storage = this.readStorage()
    storage[key] = value
    this.writeStorage(storage)
  }

  removeItem(key: string) {
    const storage = this.readStorage()
    delete storage[key]
    this.writeStorage(storage)
  }

  clear() {
    this.writeStorage({})
  }
}
