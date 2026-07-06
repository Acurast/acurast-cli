import { existsSync, mkdirSync } from 'fs'
import { getDirectoryFromFilePath } from './getDirectoryFromFilePath.js'

/**
 * Ensure the directory containing `filePath` exists, creating it (recursively)
 * if needed. Lives here — with no dependency on `constants.js` — so that
 * `constants.js` can use it at load time without an import cycle.
 */
export const ensureDirectoryExistence = (filePath: string) => {
  const dir = getDirectoryFromFilePath(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
