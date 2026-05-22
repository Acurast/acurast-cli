import AdmZip from 'adm-zip'
import { statSync } from 'fs'
import { basename } from 'path'

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const printBundleContents = (
  zipPath: string,
  projectName: string,
  log: (message: string) => void
) => {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries().filter((e) => !e.isDirectory)

  const packageSize = statSync(zipPath).size
  const unpackedSize = entries.reduce((sum, e) => sum + e.header.size, 0)

  const rows = entries.map((e) => ({
    size: formatSize(e.header.size),
    name: e.entryName,
  }))
  const sizeColWidth = rows.reduce((w, r) => Math.max(w, r.size.length), 0)

  log('')
  log(`📦  ${projectName}`)
  log('=== Bundle Contents ===')
  for (const row of rows) {
    log(`  ${row.size.padStart(sizeColWidth)}  ${row.name}`)
  }
  log('=== Bundle Details ===')
  log(`  name:          ${projectName}`)
  log(`  filename:      ${basename(zipPath)}`)
  log(`  package size:  ${formatSize(packageSize)}`)
  log(`  unpacked size: ${formatSize(unpackedSize)}`)
  log(`  total files:   ${entries.length}`)
  log('')
}
