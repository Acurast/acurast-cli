import AdmZip from 'adm-zip'
import { mkdtempSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { injectDevtoolsSnippet } from '../src/devtools/injectDevtoolsSnippet.js'

// Point to the compiled snippet in dist/ (built by `npm run build`)
const SNIPPET_DIR = resolve(__dirname, '..', 'dist', 'devtools')

describe('devtools snippet injection', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'devtools-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function createTestZip(
    entrypoint: string,
    entrypointContent: string
  ): string {
    const zipPath = join(tempDir, 'test-bundle.zip')
    const zip = new AdmZip()
    zip.addFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify({ name: 'test', version: 1, entrypoint }),
        'utf-8'
      )
    )
    zip.addFile(entrypoint, Buffer.from(entrypointContent, 'utf-8'))
    zip.writeZip(zipPath)
    return zipPath
  }

  it('should prepend the devtools snippet to the entrypoint', async () => {
    const originalCode = 'console.log("hello world")'
    const zipPath = createTestZip('index.js', originalCode)

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR
    )

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    // Original code should still be present
    expect(content).toContain(originalCode)

    // Snippet should be prepended (original code at the end)
    expect(content.indexOf('httpPOST')).toBeLessThan(
      content.indexOf(originalCode)
    )
  })

  it('should replace the API URL placeholder', async () => {
    const zipPath = createTestZip('index.js', '// user code')
    const apiUrl = 'https://custom-api.example.com'

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      apiUrl,
      SNIPPET_DIR
    )

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    expect(content).toContain(apiUrl)
    expect(content).not.toContain('__DEVTOOLS_API_URL__')
  })

  it('should strip TSC artifacts (export {}, sourcemap comment)', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR
    )

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    expect(content).not.toContain('export {}')
    expect(content).not.toContain('sourceMappingURL')
  })

  it('should throw if entrypoint is not found in zip', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    await expect(
      injectDevtoolsSnippet(
        zipPath,
        'nonexistent.js',
        'https://api.devtools.acurast.com',
        SNIPPET_DIR
      )
    ).rejects.toThrow('Could not find entrypoint')
  })

  it('should not break the manifest or other files in the zip', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    // Add an extra file
    const zip = new AdmZip(zipPath)
    zip.addFile('lib/helper.js', Buffer.from('// helper', 'utf-8'))
    zip.writeZip(zipPath)

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR
    )

    const result = new AdmZip(zipPath)
    const manifest = JSON.parse(
      result.getEntry('manifest.json')!.getData().toString('utf-8')
    )
    expect(manifest.entrypoint).toBe('index.js')

    const helper = result.getEntry('lib/helper.js')!.getData().toString('utf-8')
    expect(helper).toBe('// helper')
  })

  it('should override all console methods in the snippet', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR
    )

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    // The snippet should capture all 5 console methods
    for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
      expect(content).toContain(`console.${method}`)
    }
  })
})
