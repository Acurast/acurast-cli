import path from 'path'

export const getDirectoryFromFilePath = (filePath: string) => {
  // Normalize the path to use the OS-specific separator
  const normalizedPath = path.normalize(filePath)
  const basename = path.basename(normalizedPath)

  if (!basename.startsWith('.') && basename.includes('.')) {
    // It's a filename, need to cut off last part
    return path.dirname(normalizedPath)
  }

  return normalizedPath
}
