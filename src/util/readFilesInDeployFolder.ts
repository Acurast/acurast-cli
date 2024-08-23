import { readdir } from 'fs/promises'

export const readFilesInDeployFolder = async (searchString: string) => {
  // Read all files from a folder, check if string is in any of the filenames
  const folderPath = '.acurast/deploy/'

  const files = await readdir(folderPath)

  console.log('files', files)

  const file = files.find((file) => file.includes(searchString))

  if (file) {
    console.log('Matching file:', file)
  } else {
    console.log('No matching file found')
  }

  return file
}
