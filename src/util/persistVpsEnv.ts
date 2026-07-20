import { existsSync, readFileSync, writeFileSync } from 'fs'
import { VPS_ENV_MAPPING, type VpsOptions } from './buildVpsConfig.js'

const formatEnvValue = (value: string): string =>
  /[\s#'"\\]/.test(value)
    ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : value

/**
 * Write the given options as `VPS_*` entries to `.env` (creating it if
 * needed). Existing `VPS_*` lines are updated in place; everything else in
 * the file is preserved. Returns the env keys that were written.
 */
export const persistVpsOptionsToEnv = (
  options: VpsOptions,
  envPath: string = '.env'
): string[] => {
  const entries = (
    Object.entries(VPS_ENV_MAPPING) as [keyof VpsOptions, string][]
  )
    .filter(([key]) => options[key] !== undefined)
    .map(([key, envKey]) => [envKey, String(options[key])] as const)

  if (entries.length === 0) {
    return []
  }

  const lines = existsSync(envPath)
    ? readFileSync(envPath, 'utf-8').split(/\r?\n/)
    : []
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  for (const [envKey, value] of entries) {
    const line = `${envKey}=${formatEnvValue(value)}`
    const index = lines.findIndex((existing) =>
      new RegExp(`^\\s*${envKey}=`).test(existing)
    )
    if (index >= 0) {
      lines[index] = line
    } else {
      lines.push(line)
    }
  }

  writeFileSync(envPath, lines.join('\n') + '\n')
  return entries.map(([envKey]) => envKey)
}
