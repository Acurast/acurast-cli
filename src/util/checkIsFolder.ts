import { statSync } from 'fs'
import { filelogger } from './fileLogger.js'

export const checkIsFolder = async (path: string): Promise<boolean> => {
  try {
    const stats = statSync(path)
    return stats.isDirectory()
  } catch (error) {
    filelogger.error(`Error checking if path ${path} is a folder: ${error}`)
    throw error
  }
}
