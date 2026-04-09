import AdmZip from 'adm-zip'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Reads devtools-snippet.js from snippetDir, replaces placeholders,
 * and prepends it to the entrypoint file inside the zip bundle.
 */
export async function injectDevtoolsSnippet(
  zipPath: string,
  entrypoint: string,
  devtoolsApiUrl: string,
  deployerAddress: string,
  snippetDir: string
): Promise<string> {
  const snippetPath = join(snippetDir, 'devtools-snippet.js')
  let snippet = readFileSync(snippetPath, 'utf-8')

  // Strip TSC module/sourcemap artifacts that shouldn't be in the injected snippet
  snippet = snippet
    .replace(/^export\s*\{\s*\}\s*;?\s*$/m, '')
    .replace(/^\/\/#\s*sourceMappingURL=.*$/m, '')
    .trim()

  snippet = snippet.replace(/__DEVTOOLS_API_URL__/g, devtoolsApiUrl)
  snippet = snippet.replace(/__DEVTOOLS_DEPLOYER__/g, deployerAddress)

  const zip = new AdmZip(zipPath)
  const entry = zip.getEntry(entrypoint)

  if (!entry) {
    throw new Error(
      `Could not find entrypoint "${entrypoint}" in bundle to inject devtools snippet`
    )
  }

  const originalContent = entry.getData().toString('utf-8')
  const injectedContent = snippet + '\n' + originalContent

  zip.updateFile(entrypoint, Buffer.from(injectedContent, 'utf-8'))
  zip.writeZip(zipPath)

  return zipPath
}
