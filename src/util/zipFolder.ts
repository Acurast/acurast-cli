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

  // Set fixed timestamp for all entries. This is needed to make the zip file deterministic. Otherwise, the zip file and the IPFS hash will be different.
  // Using January 1, 1980 00:00:00 UTC because zip files use the DOS timestamp epoch
  const CREATED_AT = new Date('1980-01-01T00:00:00.000Z')

  zip.addFile('manifest.json', Buffer.from(manifest, 'utf8'))

  const stats = statSync(input)
  if (stats.isFile()) {
    zip.addLocalFile(input)
  } else {
    zip.addLocalFolder(input)
  }

  zip.getEntries().forEach((entry) => {
    entry.header.time = CREATED_AT
  })

  const zipPath = `${outputFolder}/${deploymentName}.zip`
  filelogger.debug(`zipPath: ${zipPath}`)

  zip.writeZip(zipPath, (error) => {
    if (error) {
      filelogger.error(`Error writing zip file: ${error.name} ${error.message}`)
    }
  })

  return { zipPath }
}
