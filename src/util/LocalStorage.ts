import * as fs from 'fs'
import { ensureDirectoryExistence } from '../acurast/storeDeployment.js'
import { ACURAST_BASE_PATH } from '../constants.js'

export class LocalStorage {
  private filePath: string

  constructor(fileName = 'keys.json') {
    this.filePath = `${ACURAST_BASE_PATH}/${fileName}`
    this.ensureFile()
  }

  private ensureFile() {
    ensureDirectoryExistence(this.filePath)
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '{}', 'utf8')
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
