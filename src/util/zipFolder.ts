import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, statSync } from 'fs'
import { filelogger } from './fileLogger.js'

export const zipFolder = async (
  input: string,
  outputFolder: string,
  manifest: string,
  deploymentName: string
): Promise<{ zipPath: string }> => {
  if (!existsSync(input)) {
    throw new Error(`Input folder ${input} does not exist`)
  }

  mkdirSync(outputFolder, { recursive: true })

  const zip = new AdmZip()

  zip.addFile('manifest.json', Buffer.from(manifest, 'utf8'))

  const stats = statSync(input)
  if (stats.isFile()) {
    zip.addLocalFile(input)
  } else {
    zip.addLocalFolder(input)
  }

  const zipPath = `${outputFolder}/${deploymentName}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
  filelogger.debug(`zipPath: ${zipPath}`)

  zip.writeZip(zipPath, (error) => {
    if (error) {
      filelogger.error(`Error writing zip file: ${error.name} ${error.message}`)
    }
  })

  return { zipPath }
}
