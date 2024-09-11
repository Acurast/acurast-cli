import path from 'path'

export const getDirectoryFromFilePath = (filePath: string) => {
  const basename = path.basename(filePath)

  if (!basename.startsWith('.') && basename.includes('.')) {
    // It's a filename, need to cut off last part
    return filePath.substring(0, filePath.lastIndexOf(path.sep))
  }

  return filePath
}
