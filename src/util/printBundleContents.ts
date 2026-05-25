import AdmZip from 'adm-zip'
import { statSync } from 'fs'
import { basename } from 'path'

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const formatBundleContents = (
  zipPath: string,
  projectName: string
): string => {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries().filter((e) => !e.isDirectory)

  const packageSize = statSync(zipPath).size
  const unpackedSize = entries.reduce((sum, e) => sum + e.header.size, 0)

  const rows = entries.map((e) => ({
    size: formatSize(e.header.size),
    name: e.entryName,
  }))
  const sizeColWidth = rows.reduce((w, r) => Math.max(w, r.size.length), 0)

  const lines: string[] = []
  lines.push(`📦  ${projectName}`)
  lines.push('=== Bundle Contents ===')
  for (const row of rows) {
    lines.push(`  ${row.size.padStart(sizeColWidth)}  ${row.name}`)
  }
  lines.push('=== Bundle Details ===')
  lines.push(`  name:          ${projectName}`)
  lines.push(`  filename:      ${basename(zipPath)}`)
  lines.push(`  package size:  ${formatSize(packageSize)}`)
  lines.push(`  unpacked size: ${formatSize(unpackedSize)}`)
  lines.push(`  total files:   ${entries.length}`)
  return lines.join('\n')
}

export const printBundleContents = (
  zipPath: string,
  projectName: string,
  log: (message: string) => void
) => {
  log('')
  log(formatBundleContents(zipPath, projectName))
  log('')
}
