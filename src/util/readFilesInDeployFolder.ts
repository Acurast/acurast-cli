import { readdir } from 'fs/promises'
import { ACURAST_DEPLOYMENTS_PATH } from '../constants.js'

export const readFilesInDeployFolder = async (searchString: string) => {
  // Read all files from a folder, check if string is in any of the filenames
  const folderPath = ACURAST_DEPLOYMENTS_PATH

  const files = await readdir(folderPath)

  const file = files.find((file) => file.includes(searchString))

  if (!file) {
    console.log('No matching file found')
  }

  return file
}
